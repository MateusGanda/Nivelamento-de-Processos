import test from 'node:test';
import assert from 'node:assert/strict';
import type { OrdemDisponivel } from '../../../modules/executions/domain/execucao.ts';
import { codigoQrDaOrdem, idDaOrdemNoQr } from '../../../modules/production-orders/domain/identificacao-ordem.ts';
import { consultarOrdemPorQr, ErroLeituraOrdem } from '../../../modules/executions/presentation/ordem-por-qr.ts';
import { ErroApiIlha } from '../../../modules/executions/presentation/api-client.ts';
import { criarControleRequisicoesIlha } from '../../../modules/executions/presentation/requisicoes-ilha.ts';
import { destinoSelecionado, filtrarOrdensManuais, reduzirSelecaoDestino, selecaoDestinoInicial, type EstadoSelecaoDestino } from '../../../modules/executions/presentation/selecao-destino.ts';

const id = (numero: number) => `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;
const ordem: OrdemDisponivel = {
  id: 'c6eb45de-c043-4f93-9c83-eecfc5741e95', numero: 'OP-0001', quantidade: 50, unidade: 'un', plano: 'PL-2026-11',
  produto: { codigo: 'PRD-001', nome: 'Sapato de Teste' }, etapas: [
    { id: id(11), ordem: 1, operacao: 'Pesponto', baixada: false, postos: [{ id: id(21), codigo: 'PES-1', nome: 'Máquina de pesponto' }] },
    { id: id(12), ordem: 2, operacao: 'Costura', baixada: false, postos: [{ id: id(22), codigo: 'COS-1', nome: 'Costura 1' }, { id: id(23), codigo: 'COS-2', nome: 'Costura 2' }] },
    { id: id(13), ordem: 3, operacao: 'Montagem', baixada: true, postos: [{ id: id(24), codigo: 'MON-1', nome: 'Montagem' }] },
    { id: id(14), ordem: 4, operacao: 'Acabamento', baixada: false, postos: [] },
  ],
};
const outra: OrdemDisponivel = { ...ordem, id: id(2), numero: 'OP-0002' };
const qr = codigoQrDaOrdem(ordem.id);

function recebida(ordens = [ordem, outra], ordemId = ordem.id): EstadoSelecaoDestino {
  const inicio = reduzirSelecaoDestino(selecaoDestinoInicial, { tipo: 'iniciarConsulta' });
  const resultado = reduzirSelecaoDestino(inicio, { tipo: 'receberOrdens', ordens, ordemId });
  return reduzirSelecaoDestino(resultado, { tipo: 'finalizarConsulta' });
}

function consultaControlada() {
  const controle = criarControleRequisicoesIlha();
  let estado = selecaoDestinoInicial;
  const falhas: unknown[] = [];
  return {
    controle, falhas, estado: () => estado,
    ler: (codigo: string) => controle.executar((signal) => consultarOrdemPorQr(codigo, signal), {
      iniciar: () => { estado = reduzirSelecaoDestino(estado, { tipo: 'iniciarConsulta' }); },
      concluir: (resultado) => { estado = reduzirSelecaoDestino(estado, { tipo: 'receberOrdens', ...resultado }); },
      falhar: (erro: unknown) => { falhas.push(erro); estado = reduzirSelecaoDestino(estado, { tipo: 'falharConsulta', mensagem: erro instanceof Error ? erro.message : 'Falha' }); },
      finalizar: () => { estado = reduzirSelecaoDestino(estado, { tipo: 'finalizarConsulta' }); },
    }),
  };
}

test('ilha: decodifica o QR da ficha, sem diferença de caixa e com terminador do leitor', () => {
  for (const codigo of [qr, qr.toLowerCase(), ` ${qr}\r\n`]) assert.equal(idDaOrdemNoQr(codigo), ordem.id);
  for (const codigo of ['LG-01', 'OP-0001', ordem.id, 'https://exemplo/ordem/' + ordem.id, qr + qr, 'GUNP-OP-invalido', 'GUNP-USUARIO-' + ordem.id]) {
    assert.equal(idDaOrdemNoQr(codigo), null);
  }
});

test('ilha: QR seleciona pelo ID atual, não filtra o texto do código como número/produto e não envia POST', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/ilha/ordens'); assert.equal(options.method, undefined);
    assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.signal, controller.signal);
    return Response.json([outra, { ...ordem, numero: 'OP-RENOMEADA', id: ordem.id.toUpperCase() }]);
  });
  const resultado = await consultarOrdemPorQr(qr.toLowerCase(), controller.signal);
  assert.equal(resultado.ordemId, ordem.id.toUpperCase());
  assert.equal(resultado.ordens.find((item) => item.id === resultado.ordemId)?.numero, 'OP-RENOMEADA');
});

test('ilha: crachá ou QR inválido no campo da ordem orienta pesquisa manual sem consultar API', async (t) => {
  let consultas = 0;
  t.mock.method(globalThis, 'fetch', async () => { consultas++; return Response.json([ordem]); });
  for (const texto of ['LG-01', 'OP-0001', 'GUNP-OP-errado', qr + qr]) {
    await assert.rejects(() => consultarOrdemPorQr(texto, new AbortController().signal),
      (falha: unknown) => falha instanceof ErroLeituraOrdem && falha.message.includes('Leia o QR Code da ficha da ordem'));
  }
  assert.equal(consultas, 0);
});

test('ilha: cada leitura consulta disponibilidade novamente e ordem ausente não é declarada concluída', async (t) => {
  let consultas = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json(++consultas === 1 ? [ordem] : []));
  await consultarOrdemPorQr(qr, new AbortController().signal);
  await assert.rejects(() => consultarOrdemPorQr(qr, new AbortController().signal),
    (falha: unknown) => falha instanceof ErroLeituraOrdem && falha.message.includes('ordens disponíveis') && !falha.message.includes('concluída'));
  assert.equal(consultas, 2);
});

test('ilha: leitura não mascara falha de rede, acesso ao terminal ou resposta malformada', async (t) => {
  let status = 401;
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { mensagem: 'Acesso indisponível.' } }, { status }));
  for (status of [401, 503]) await assert.rejects(() => consultarOrdemPorQr(qr, new AbortController().signal),
    (falha: unknown) => falha instanceof ErroApiIlha && falha.status === status);
  mock.mock.restore();
  const malformado = t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...ordem, etapas: [null] }]));
  await assert.rejects(() => consultarOrdemPorQr(qr, new AbortController().signal), ErroApiIlha);
  malformado.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Falha de rede'); });
  await assert.rejects(() => consultarOrdemPorQr(qr, new AbortController().signal), TypeError);
});

test('ilha: Enter repetido durante leitura gera somente um GET e não escolhe etapa/posto nem inicia execução', async (t) => {
  let responder!: (resposta: Response) => void; let consultas = 0;
  t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => {
    assert.equal(options.method, undefined); consultas++;
    return new Promise<Response>((resolve) => { responder = resolve; });
  });
  const leitura = consultaControlada();
  const primeiro = leitura.ler(qr);
  await leitura.ler(qr);
  assert.equal(consultas, 1); assert.equal(destinoSelecionado(leitura.estado()), null);
  responder(Response.json([ordem])); await primeiro;
  assert.equal(leitura.estado().ordemId, ordem.id);
  assert.equal(leitura.estado().etapaId, ''); assert.equal(leitura.estado().postoId, '');
  assert.equal(destinoSelecionado(leitura.estado()), null);
});

test('ilha: cancelar, sair ou bloquear invalida consulta de QR e ignora sucesso/erro antigo', async (t) => {
  for (const resposta of [Response.json([ordem]), Response.json({ erro: { mensagem: 'Terminal revogado.' } }, { status: 401 })]) {
    let responder!: (resposta: Response) => void;
    const mock = t.mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => { responder = resolve; }));
    const leitura = consultaControlada();
    const pendente = leitura.ler(qr);
    leitura.controle.invalidar();
    responder(resposta); await pendente;
    assert.equal(leitura.estado().ordemId, ''); assert.deepEqual(leitura.falhas, []);
    mock.mock.restore();
  }
});

test('ilha: leitura antiga terminando durante consulta nova não libera confirmação nem substitui a ordem', async (t) => {
  const respostas: ((valor: Response) => void)[] = [];
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => respostas.push(resolve)));
  const leitura = consultaControlada();
  const antigo = leitura.ler(qr); leitura.controle.invalidar();
  const novo = leitura.ler(codigoQrDaOrdem(outra.id));
  respostas[0](Response.json([ordem])); await antigo;
  assert.equal(leitura.estado().carregando, true); assert.equal(leitura.estado().ordemId, '');
  respostas[1](Response.json([outra])); await novo;
  assert.equal(leitura.estado().ordemId, outra.id); assert.equal(leitura.estado().carregando, false);
});

test('ilha: erro seguido de nova leitura refaz somente GET e não reaproveita seleção antiga', async (t) => {
  let consultas = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++consultas === 1) throw new TypeError('Falha de rede');
    return Response.json([ordem]);
  });
  const leitura = consultaControlada();
  await leitura.ler(qr); assert.equal(destinoSelecionado(leitura.estado()), null);
  await leitura.ler(qr);
  assert.equal(consultas, 2); assert.equal(leitura.estado().erro, '');
  assert.equal(leitura.estado().ordemId, ordem.id); assert.equal(destinoSelecionado(leitura.estado()), null);
});

test('ilha: seleção exige etapa e posto compatível, escolhendo automaticamente somente posto único', () => {
  let estado = recebida();
  assert.equal(destinoSelecionado(estado), null);
  estado = reduzirSelecaoDestino(estado, { tipo: 'selecionarEtapa', id: id(12) });
  assert.equal(estado.postoId, ''); assert.equal(destinoSelecionado(estado), null);
  estado = reduzirSelecaoDestino(estado, { tipo: 'selecionarPosto', id: id(21) });
  assert.equal(destinoSelecionado(estado), null);
  estado = reduzirSelecaoDestino(estado, { tipo: 'selecionarPosto', id: id(22) });
  assert.deepEqual(destinoSelecionado(estado), { ordemId: ordem.id, etapaId: id(12), postoId: id(22) });
  estado = reduzirSelecaoDestino(estado, { tipo: 'selecionarEtapa', id: id(11) });
  assert.equal(estado.postoId, id(21));
});

test('ilha: outra ordem, outro modo e nova consulta limpam etapa/posto antes de confirmar', () => {
  const selecionada = reduzirSelecaoDestino(recebida(), { tipo: 'selecionarEtapa', id: id(11) });
  assert.ok(destinoSelecionado(selecionada));
  for (const estado of [
    reduzirSelecaoDestino(selecionada, { tipo: 'selecionarOrdem', id: outra.id }),
    reduzirSelecaoDestino(selecionada, { tipo: 'mudarEntrada', entrada: 'qr' }),
    reduzirSelecaoDestino(selecionada, { tipo: 'mudarEntrada', entrada: 'manual' }),
    reduzirSelecaoDestino(selecionada, { tipo: 'iniciarConsulta' }),
    reduzirSelecaoDestino(selecionada, { tipo: 'receberOrdens', ordens: [ordem], ordemId: ordem.id }),
  ]) { assert.equal(estado.etapaId, ''); assert.equal(estado.postoId, ''); assert.equal(destinoSelecionado(estado), null); }
});

test('ilha: etapa baixada, sem posto ou atual fica bloqueada; mesma etapa em outra ordem permanece disponível', () => {
  for (const etapaId of [id(13), id(14)]) {
    const estado = reduzirSelecaoDestino(recebida(), { tipo: 'selecionarEtapa', id: etapaId });
    assert.equal(estado.etapaId, ''); assert.equal(destinoSelecionado(estado), null);
  }
  const atual = { ordemId: ordem.id, etapaId: id(11) };
  const bloqueada = reduzirSelecaoDestino(recebida(), { tipo: 'selecionarEtapa', id: id(11), atual });
  assert.equal(bloqueada.etapaId, '');
  const outraSelecionada = reduzirSelecaoDestino(recebida([ordem, outra], outra.id), { tipo: 'selecionarEtapa', id: id(11), atual });
  assert.deepEqual(destinoSelecionado(outraSelecionada, atual), { ordemId: outra.id, etapaId: id(11), postoId: id(21) });
});

test('ilha: consulta, gravação, erro ou disponibilidade removida não libera destino antigo', () => {
  const estado = reduzirSelecaoDestino(recebida(), { tipo: 'selecionarEtapa', id: id(11) });
  assert.equal(destinoSelecionado(estado, undefined, true), null);
  assert.equal(destinoSelecionado({ ...estado, carregando: true }), null);
  assert.equal(destinoSelecionado({ ...estado, erro: 'Falha' }), null);
  assert.equal(destinoSelecionado({ ...estado, ordens: [] }), null);
  assert.equal(destinoSelecionado(estado, { ordemId: ordem.id, etapaId: id(11) }), null);
  const bloqueada = reduzirSelecaoDestino({ ...estado, carregando: true }, { tipo: 'selecionarOrdem', id: outra.id });
  assert.equal(bloqueada.ordemId, ordem.id);
});

test('ilha: pesquisa manual mantém busca por número/produto, caixa e acentos, sem confundir QR com texto', () => {
  const lista = [ordem, { ...outra, produto: { codigo: 'OUT-002', nome: 'Calçado especial' } }];
  assert.deepEqual(filtrarOrdensManuais(lista, 'OP-0001').map((item) => item.id), [ordem.id]);
  assert.deepEqual(filtrarOrdensManuais(lista, ' calcado ').map((item) => item.id), [outra.id]);
  assert.deepEqual(filtrarOrdensManuais(lista, 'out-002').map((item) => item.id), [outra.id]);
  assert.deepEqual(filtrarOrdensManuais(lista, ''), lista); assert.deepEqual(filtrarOrdensManuais(null, ''), []);
  assert.equal(filtrarOrdensManuais(lista, qr).length, 0);
  assert.equal(idDaOrdemNoQr(qr), ordem.id);
});
