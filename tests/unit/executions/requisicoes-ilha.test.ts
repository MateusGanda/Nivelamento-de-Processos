import test from 'node:test';
import assert from 'node:assert/strict';
import { criarControleRequisicoesIlha } from '../../../modules/executions/presentation/requisicoes-ilha.ts';
import { ErroApiIlha } from '../../../modules/executions/presentation/api-client.ts';

function pendente<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => { resolver = resolve; rejeitar = reject; });
  return { promise, resolver, rejeitar };
}

function efeitos<T>(eventos: unknown[]) {
  return {
    iniciar: () => { eventos.push('inicio'); },
    concluir: (valor: T) => { eventos.push(valor); },
    falhar: (erro: unknown) => { eventos.push(erro); },
    finalizar: () => { eventos.push('fim'); },
  };
}

test('ilha: pedido em andamento bloqueia envio repetido e troca de identificação', async () => {
  const controle = criarControleRequisicoesIlha();
  const resposta = pendente<string>();
  const eventos: unknown[] = [];
  let envios = 0;
  const primeiro = controle.executar(() => { envios++; return resposta.promise; }, efeitos<string>(eventos));
  assert.equal(controle.emAndamento(), true);
  await controle.executar(async () => { envios++; return 'outro operador'; }, efeitos<string>(eventos));
  assert.equal(envios, 1);
  assert.deepEqual(eventos, ['inicio']);
  resposta.resolver('operador atual');
  await primeiro;
  assert.equal(controle.emAndamento(), false);
  assert.deepEqual(eventos, ['inicio', 'operador atual', 'fim']);
});

test('ilha: sucesso atrasado não restaura identificação, mensagem ou modo após limpeza', async () => {
  const controle = criarControleRequisicoesIlha();
  const resposta = pendente<string>();
  const eventos: unknown[] = [];
  const pedido = controle.executar(() => resposta.promise, efeitos<string>(eventos));
  controle.invalidar();
  assert.equal(controle.emAndamento(), false);
  resposta.resolver('operador que saiu');
  await pedido;
  assert.deepEqual(eventos, ['inicio']);
});

test('ilha: erro atrasado inclusive de acesso não afeta o próximo operador nem dispara refresh', async () => {
  for (const erro of [new Error('Rede indisponível'), new ErroApiIlha(401, 'Terminal não liberado'), new ErroApiIlha(503, 'Ilha não configurada')]) {
    const controle = criarControleRequisicoesIlha();
    const anterior = pendente<string>();
    const eventosAntigos: unknown[] = [];
    const eventosNovos: unknown[] = [];
    const pedido = controle.executar(() => anterior.promise, efeitos<string>(eventosAntigos));
    controle.invalidar();
    await controle.executar(async () => 'novo operador', efeitos<string>(eventosNovos));
    anterior.rejeitar(erro);
    await pedido;
    assert.deepEqual(eventosAntigos, ['inicio']);
    assert.deepEqual(eventosNovos, ['inicio', 'novo operador', 'fim']);
  }
});

test('ilha: finalização de gravação invalidada não libera o bloqueio ou pedido mais novo', async () => {
  const controle = criarControleRequisicoesIlha();
  const gravacao = pendente<string>();
  const bloqueio = pendente<string>();
  const antigos: unknown[] = [];
  const atuais: unknown[] = [];
  const pedidoAntigo = controle.executar(() => gravacao.promise, efeitos<string>(antigos));
  controle.invalidar();
  const pedidoAtual = controle.executar(() => bloqueio.promise, efeitos<string>(atuais));
  gravacao.resolver('gravado');
  await pedidoAntigo;
  assert.equal(controle.emAndamento(), true);
  assert.deepEqual(antigos, ['inicio']);
  let indevido = false;
  await controle.executar(async () => { indevido = true; return 'trocar operador'; }, efeitos<string>(atuais));
  assert.equal(indevido, false);
  bloqueio.resolver('terminal bloqueado');
  await pedidoAtual;
  assert.deepEqual(atuais, ['inicio', 'terminal bloqueado', 'fim']);
});

test('ilha: invalidar aborta identificação e ignora AbortError ao encerrar a tela', async () => {
  const controle = criarControleRequisicoesIlha();
  const eventos: unknown[] = [];
  let signalRecebido: AbortSignal | undefined;
  const pedido = controle.executar((signal) => {
    signalRecebido = signal;
    return new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Cancelada', 'AbortError')), { once: true });
    });
  }, efeitos<string>(eventos));
  controle.invalidar();
  await pedido;
  assert.equal(signalRecebido?.aborted, true);
  assert.equal(controle.emAndamento(), false);
  assert.deepEqual(eventos, ['inicio']);
});

test('ilha: falha atual permite tentar novamente e só o sucesso confirma o bloqueio', async () => {
  const controle = criarControleRequisicoesIlha();
  const erro = new Error('Falha ao bloquear');
  const eventos: unknown[] = [];
  await controle.executar(async () => { throw erro; }, efeitos<string>(eventos));
  assert.equal(controle.emAndamento(), false);
  assert.deepEqual(eventos, ['inicio', erro, 'fim']);
  await controle.executar(async () => 'bloqueio confirmado', efeitos<string>(eventos));
  assert.deepEqual(eventos, ['inicio', erro, 'fim', 'inicio', 'bloqueio confirmado', 'fim']);
});

test('ilha: mesmo operador reidentificado não recebe uma resposta da identificação anterior', async () => {
  const controle = criarControleRequisicoesIlha();
  const anterior = pendente<{ id: string; status: string }>();
  const atual = pendente<{ id: string; status: string }>();
  const eventos: unknown[] = [];
  const primeiro = controle.executar(() => anterior.promise, efeitos(eventos));
  controle.invalidar();
  const segundo = controle.executar(() => atual.promise, efeitos(eventos));
  atual.resolver({ id: 'mesmo-operador', status: 'PAUSADA' });
  await segundo;
  anterior.resolver({ id: 'mesmo-operador', status: 'EM_EXECUCAO' });
  await primeiro;
  assert.deepEqual(eventos, ['inicio', 'inicio', { id: 'mesmo-operador', status: 'PAUSADA' }, 'fim']);
});
