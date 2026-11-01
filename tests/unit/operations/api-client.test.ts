import test from 'node:test';
import assert from 'node:assert/strict';
import { alterarOperacao, cadastrarOperacao, definirStatusOperacao, listarOperacoes, ErroApiOperacoes } from '../../../modules/operations/presentation/api-client.ts';

const operacao = { id: '1', nome: 'Corte', descricao: null, ativo: true, createdAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z' };

test('operação: cliente REST usa mesma origem, GET sem cache, abort e corpos permitidos', async (t) => {
  const pedidos: { url: string; options: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    pedidos.push({ url, options });
    return Response.json(options.method ? operacao : [operacao], { status: options.method === 'POST' ? 201 : 200 });
  });
  const controller = new AbortController();
  assert.deepEqual(await listarOperacoes(controller.signal), [operacao]);
  assert.equal(pedidos[0].url, '/api/operacoes');
  assert.equal(pedidos[0].options.cache, 'no-store');
  assert.equal(pedidos[0].options.signal, controller.signal);
  assert.deepEqual(await cadastrarOperacao({ nome: ' Corte ', descricao: ' Área ' }), operacao);
  assert.equal(pedidos[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(String(pedidos[1].options.body)), { nome: ' Corte ', descricao: ' Área ' });
  assert.deepEqual(await alterarOperacao('id/com espaço', { descricao: null }), operacao);
  assert.equal(pedidos[2].url, '/api/operacoes/id%2Fcom%20espa%C3%A7o');
  assert.equal(pedidos[2].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(pedidos[2].options.body)), { descricao: null });
  assert.deepEqual(await definirStatusOperacao('1', false), operacao);
  assert.equal(pedidos[3].url, '/api/operacoes/1/status');
  assert.equal(pedidos[3].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(pedidos[3].options.body)), { ativo: false });
  assert.ok(pedidos.every((p) => p.options.credentials === 'same-origin'));
});

test('operação: cliente preserva erro de conflito, autorização e inexistência', async (t) => {
  let status = 409;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { codigo: 'CONFLITO', mensagem: 'Nome de operação já cadastrado.' } }, { status }));
  for (status of [400, 401, 403, 404, 409, 500]) {
    for (const executar of [() => listarOperacoes(), () => cadastrarOperacao({ nome: 'Corte' }), () => alterarOperacao('1', { nome: 'Corte' })]) {
      await assert.rejects(executar, (erro: unknown) => erro instanceof ErroApiOperacoes && erro.status === status && erro.message === 'Nome de operação já cadastrado.');
    }
  }
});

test('operação: cliente rejeita HTML, registros incompletos e datas inválidas', async (t) => {
  let resposta = new Response('<html>detalhe-interno</html>', { status: 500 });
  t.mock.method(globalThis, 'fetch', async () => resposta.clone());
  await assert.rejects(() => listarOperacoes(), (erro: unknown) => erro instanceof ErroApiOperacoes && !erro.message.includes('detalhe-interno'));
  for (const corpo of [{}, [null], [{ ...operacao, descricao: 1 }], [{ ...operacao, createdAt: 'inválida' }], [{ ...operacao, updatedAt: null }], [{ ...operacao, ativo: undefined }]]) {
    resposta = Response.json(corpo);
    await assert.rejects(() => listarOperacoes(), /Resposta inválida/);
  }
  resposta = Response.json({});
  await assert.rejects(() => cadastrarOperacao({ nome: 'Corte' }), /Verifique a lista antes de tentar novamente/);
  await assert.rejects(() => alterarOperacao('1', { nome: 'Corte' }), /Verifique a lista antes de tentar novamente/);
});

test('operação: falha de transporte não repete automaticamente a gravação', async (t) => {
  let pedidos = 0;
  t.mock.method(globalThis, 'fetch', async () => { pedidos++; throw new TypeError('Failed to fetch'); });
  await assert.rejects(() => cadastrarOperacao({ nome: 'Corte' }), /Failed to fetch/);
  assert.equal(pedidos, 1);
  await assert.rejects(() => alterarOperacao('1', { descricao: null }), /Failed to fetch/);
  assert.equal(pedidos, 2);
});
