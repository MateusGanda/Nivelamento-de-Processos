import test from 'node:test';
import assert from 'node:assert/strict';
import { ErroApiIlha, listarMotivosPausa, listarOrdensDisponiveis } from '../../../modules/executions/presentation/api-client.ts';

const ordem = {
  id: 'ordem-1', numero: 'OP-0001', quantidade: 10, unidade: 'un', plano: 'PL-1', produto: { codigo: 'PRD-1', nome: 'Produto' },
  etapas: [{ id: 'etapa-1', ordem: 1, operacao: 'Corte', baixada: false, postos: [{ id: 'posto-1', codigo: 'COR1', nome: 'Posto de corte' }] }],
};

test('ilha: consultas de ordens e motivos usam GET sem cache e permitem abortar a carga', async (t) => {
  const controller = new AbortController();
  const pedidos: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    pedidos.push(url);
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    assert.ok(!options.method || options.method === 'GET');
    return Response.json(url.endsWith('/ordens') ? [ordem] : [{ id: 'motivo-1', nome: 'Falta de material' }]);
  });
  assert.deepEqual(await listarOrdensDisponiveis(controller.signal), [ordem]);
  assert.deepEqual(await listarMotivosPausa(controller.signal), [{ id: 'motivo-1', nome: 'Falta de material' }]);
  assert.deepEqual(pedidos, ['/api/ilha/ordens', '/api/ilha/motivos']);
});

test('ilha: consultas vazias são válidas e uma nova consulta obtém os dados atualizados', async (t) => {
  let ordens = false;
  let motivos = false;
  t.mock.method(globalThis, 'fetch', async (url: string) => Response.json(url.endsWith('/ordens') ? (ordens ? [ordem] : []) : (motivos ? [{ id: 'novo', nome: 'Novo motivo' }] : [])));
  assert.deepEqual(await listarOrdensDisponiveis(), []);
  assert.deepEqual(await listarMotivosPausa(), []);
  ordens = motivos = true;
  assert.deepEqual(await listarOrdensDisponiveis(), [ordem]);
  assert.deepEqual(await listarMotivosPausa(), [{ id: 'novo', nome: 'Novo motivo' }]);
});

test('ilha: falha de consulta permite nova tentativa e preserva erros de acesso/configuração', async (t) => {
  let status = 500;
  let recuperar = false;
  t.mock.method(globalThis, 'fetch', async () => recuperar ? Response.json([ordem]) : Response.json({ erro: { codigo: 'ERRO', mensagem: 'Consulta indisponível.' } }, { status }));
  for (const consulta of [listarOrdensDisponiveis, listarMotivosPausa]) {
    for (status of [401, 503, 500]) {
      await assert.rejects(() => consulta(), (erro: unknown) => erro instanceof ErroApiIlha && erro.status === status && erro.message === 'Consulta indisponível.');
    }
  }
  recuperar = true;
  assert.deepEqual(await listarOrdensDisponiveis(), [ordem]);
});

test('ilha: abortar uma consulta não transforma cancelamento em lista vazia', async (t) => {
  const controller = new AbortController();
  const falha = new DOMException('Consulta cancelada', 'AbortError');
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.equal(options.signal, controller.signal);
    throw falha;
  });
  controller.abort();
  for (const consulta of [listarOrdensDisponiveis, listarMotivosPausa]) {
    await assert.rejects(() => consulta(controller.signal), (erro: unknown) => erro === falha);
  }
});

test('ilha: respostas de ordens malformadas são recusadas antes de renderizar seletores', async (t) => {
  let corpo: unknown;
  t.mock.method(globalThis, 'fetch', async () => Response.json(corpo));
  for (corpo of [
    {}, [null], [{ ...ordem, quantidade: '10' }], [{ ...ordem, produto: null }],
    [{ ...ordem, etapas: [null] }], [{ ...ordem, etapas: [{ ...ordem.etapas[0], baixada: 'não' }] }],
    [{ ...ordem, etapas: [{ ...ordem.etapas[0], postos: [{ id: 'posto-1' }] }] }],
  ]) {
    await assert.rejects(() => listarOrdensDisponiveis(), /Resposta inválida ao carregar as ordens/);
  }
});

test('ilha: motivos malformados e HTML de erro não quebram a lista nem expõem detalhes internos', async (t) => {
  let resposta = new Response('<html>detalhe interno</html>', { status: 500 });
  t.mock.method(globalThis, 'fetch', async () => resposta);
  await assert.rejects(() => listarMotivosPausa(), (erro: unknown) => erro instanceof ErroApiIlha && erro.status === 500 && !erro.message.includes('detalhe interno'));
  for (const corpo of [{}, [null], [{ id: '1' }], [{ id: 1, nome: 'Pausa' }]]) {
    resposta = Response.json(corpo);
    await assert.rejects(() => listarMotivosPausa(), /Resposta inválida ao carregar os motivos/);
  }
});
