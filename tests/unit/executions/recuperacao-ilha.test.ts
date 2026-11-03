import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExecucaoAberta, OperadorDaIlha } from '../../../modules/executions/domain/execucao.ts';
import {
  bloquearTerminal, darBaixa, ErroApiIlha, iniciarExecucao, pausarExecucao, retomarExecucao, trocarOperacao,
} from '../../../modules/executions/presentation/api-client.ts';
import { consultarSituacaoOperador, exigeAtualizacaoSituacao } from '../../../modules/executions/presentation/recuperacao-ilha.ts';
import { criarControleRequisicoesIlha } from '../../../modules/executions/presentation/requisicoes-ilha.ts';

const identidade = { id: 'operador-1', matricula: 'AS-PES1' };
const destino = { ordemId: 'ordem-1', etapaId: 'etapa-1', postoId: 'posto-1' };
const instante = '2026-11-02T12:00:00.000Z';
const execucao: ExecucaoAberta = {
  id: 'execucao-1', status: 'EM_EXECUCAO',
  ordem: { id: 'ordem-1', numero: 'OP-0001', quantidade: 10, unidade: 'un' },
  produto: { codigo: 'PRD-1', nome: 'Produto' },
  etapa: { id: 'etapa-1', ordem: 1, operacao: 'Corte' },
  posto: { id: 'posto-1', codigo: 'COR1', nome: 'Posto' },
  eventos: [{ tipo: 'INICIO', dataHora: instante, motivo: null }],
};
const operadorCom = (aberta: ExecucaoAberta | null): OperadorDaIlha => ({ ...identidade, nome: 'Ana', setor: null, execucaoAberta: aberta });

test('ilha: entrada rejeitada mantém correção do formulário; conflitos e resultados incertos exigem consulta', () => {
  assert.equal(exigeAtualizacaoSituacao(new ErroApiIlha(400, 'Quantidade inválida')), false);
  for (const status of [401, 404, 409, 500, 503]) assert.equal(exigeAtualizacaoSituacao(new ErroApiIlha(status, 'Falha')), true);
  assert.equal(exigeAtualizacaoSituacao(new TypeError('Failed to fetch')), true);
});

const cenarios = [
  { nome: 'início', gravar: () => iniciarExecucao(identidade.matricula, destino), depois: operadorCom(execucao) },
  { nome: 'pausa', gravar: () => pausarExecucao(identidade.matricula, execucao.id, 'motivo-1'), depois: operadorCom({ ...execucao, status: 'PAUSADA', eventos: [...execucao.eventos, { tipo: 'PAUSA', dataHora: instante, motivo: 'Falta de material' }] }) },
  { nome: 'retomada', gravar: () => retomarExecucao(identidade.matricula, execucao.id), depois: operadorCom(execucao) },
  { nome: 'troca', gravar: () => trocarOperacao(identidade.matricula, execucao.id, destino), depois: operadorCom({ ...execucao, id: 'nova-execucao' }) },
  { nome: 'baixa', gravar: () => darBaixa(identidade.matricula, execucao.id, { quantidadeBoa: 10, quantidadeRetrabalho: 0, quantidadeRefugo: 0 }), depois: operadorCom(null) },
];

for (const cenario of cenarios) {
  test(`ilha: recupera ${cenario.nome} gravada com resposta perdida usando somente GET, sem repetir POST`, async (t) => {
    let registro = operadorCom(null);
    const pedidos: string[] = [];
    const controller = new AbortController();
    t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
      pedidos.push(options.method ?? 'GET');
      if (options.method === 'POST') {
        registro = cenario.depois;
        throw new TypeError('Resposta perdida depois de gravar');
      }
      assert.equal(url, '/api/ilha/operadores/AS-PES1');
      assert.equal(options.signal, controller.signal);
      assert.equal(options.cache, 'no-store');
      assert.equal(options.credentials, 'same-origin');
      return Response.json(registro);
    });
    await assert.rejects(cenario.gravar, exigeAtualizacaoSituacao);
    assert.deepEqual(await consultarSituacaoOperador(identidade, controller.signal), cenario.depois);
    assert.deepEqual(pedidos, ['POST', 'GET']);
  });
}

test('ilha: falha ao consultar não é convertida em operador sem execução', async (t) => {
  let status = 500;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { mensagem: 'Consulta indisponível' } }, { status }));
  for (status of [401, 404, 409, 500, 503]) {
    await assert.rejects(() => consultarSituacaoOperador(identidade), (erro: unknown) => erro instanceof ErroApiIlha && erro.status === status);
  }
});

test('ilha: consulta só libera dados completos que a execução consegue apresentar', async (t) => {
  let resposta: unknown;
  t.mock.method(globalThis, 'fetch', async () => Response.json(resposta));
  for (resposta of [
    {}, { ...operadorCom(null), execucaoAberta: undefined },
    operadorCom({ ...execucao, ordem: undefined } as unknown as ExecucaoAberta),
    operadorCom({ ...execucao, produto: undefined } as unknown as ExecucaoAberta),
    operadorCom({ ...execucao, posto: undefined } as unknown as ExecucaoAberta),
    operadorCom({ ...execucao, eventos: [{ tipo: 'INICIO', dataHora: 'inválida', motivo: null }] }),
  ]) {
    await assert.rejects(() => consultarSituacaoOperador(identidade), (erro: unknown) => erro instanceof ErroApiIlha && erro.status === 500);
  }
});

test('ilha: consulta de recuperação recusa resposta de outra identificação', async (t) => {
  let resposta = { ...operadorCom(execucao), id: 'outro-operador' };
  t.mock.method(globalThis, 'fetch', async () => Response.json(resposta));
  await assert.rejects(() => consultarSituacaoOperador(identidade), /confirmar a identificação/);
  resposta = { ...operadorCom(execucao), matricula: 'OUTRA-MATRICULA' };
  await assert.rejects(() => consultarSituacaoOperador(identidade), /confirmar a identificação/);
});

test('ilha: tentar atualizar novamente repete só a consulta, sem enviar apontamento', async (t) => {
  let consultas = 0;
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.ok(!options.method || options.method === 'GET');
    if (++consultas === 1) throw new TypeError('Sem conexão');
    return Response.json(operadorCom(null));
  });
  await assert.rejects(() => consultarSituacaoOperador(identidade), /Sem conexão/);
  assert.deepEqual(await consultarSituacaoOperador(identidade), operadorCom(null));
  assert.equal(consultas, 2);
});

test('ilha: bloqueio descarta recuperação atrasada e não restaura dados nem libera o próximo pedido', async (t) => {
  const controle = criarControleRequisicoesIlha();
  let responder!: (resposta: Response) => void;
  let signalRecebido: AbortSignal | null | undefined;
  const pendente = new Promise<Response>((resolve) => { responder = resolve; });
  const resultados: unknown[] = [];
  const pedidos: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    pedidos.push(options.method ?? 'GET');
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    signalRecebido = options.signal;
    return pendente;
  });
  const efeitos = { iniciar: () => {}, concluir: (valor: unknown) => { resultados.push(valor); }, falhar: (erro: unknown) => { resultados.push(erro); }, finalizar: () => {} };
  const consulta = controle.executar((signal) => consultarSituacaoOperador(identidade, signal), efeitos);
  controle.invalidar();
  await controle.executar(() => bloquearTerminal(), { ...efeitos, concluir: () => { resultados.push('bloqueado'); } });
  responder(Response.json(operadorCom(execucao)));
  await consulta;
  assert.equal(signalRecebido?.aborted, true);
  assert.deepEqual(resultados, ['bloqueado']);
  assert.deepEqual(pedidos, ['GET', 'DELETE']);
});

test('ilha: gravação com resposta incompleta exige consulta em vez de nova gravação', async (t) => {
  const pedidos: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    pedidos.push(options.method ?? 'GET');
    return Response.json(options.method === 'POST' ? { ...identidade, nome: 'Ana', setor: null, execucaoAberta: {} } : operadorCom(execucao));
  });
  await assert.rejects(() => iniciarExecucao(identidade.matricula, destino), exigeAtualizacaoSituacao);
  assert.deepEqual(await consultarSituacaoOperador(identidade), operadorCom(execucao));
  assert.deepEqual(pedidos, ['POST', 'GET']);
});
