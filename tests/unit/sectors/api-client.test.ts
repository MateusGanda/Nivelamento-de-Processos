import test from 'node:test';
import assert from 'node:assert/strict';
import { cadastrarSetor, listarSetores, ErroApiSetores } from '../../../modules/sectors/presentation/api-client.ts';

const setor = { id: '1', codigo: 'COS1', nome: 'Costura', descricao: null, ativo: true, createdAt: '2026-10-13T12:00:00Z', updatedAt: '2026-10-13T12:00:00Z' };

test('setor: cliente usa REST da mesma origem, GET sem cache e POST somente com os campos permitidos', async (t) => {
  const pedidos: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
    assert.equal(input, '/api/setores');
    pedidos.push(options);
    return Response.json(options.method === 'POST' ? setor : [setor], { status: options.method === 'POST' ? 201 : 200 });
  });
  assert.deepEqual(await listarSetores(), [setor]);
  assert.equal(pedidos[0].cache, 'no-store');
  assert.equal(pedidos[0].credentials, 'same-origin');
  assert.deepEqual(await cadastrarSetor({ nome: ' Costura ', descricao: ' Área ' }), setor);
  assert.equal(pedidos[1].credentials, 'same-origin');
  assert.equal(pedidos[1].method, 'POST');
  assert.deepEqual(JSON.parse(String(pedidos[1].body)), { nome: ' Costura ', descricao: ' Área ' });
});

test('setor: cliente preserva status de conflito e sessão inválida/inativa', async (t) => {
  let status = 409;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { codigo: 'CONFLITO', mensagem: 'Nome de setor já cadastrado.' } }, { status }));
  await assert.rejects(() => cadastrarSetor({ nome: 'Costura' }), (erro: unknown) => erro instanceof ErroApiSetores && erro.status === 409 && erro.message === 'Nome de setor já cadastrado.');
  for (status of [401, 403]) {
    await assert.rejects(() => listarSetores(), (erro: unknown) => erro instanceof ErroApiSetores && erro.status === status);
  }
});

test('setor: cliente rejeita HTML de erro e respostas inválidas sem expor conteúdo interno', async (t) => {
  let resposta = new Response('<html>detalhe-interno</html>', { status: 500 });
  t.mock.method(globalThis, 'fetch', async () => resposta);
  await assert.rejects(() => listarSetores(), (erro: unknown) => erro instanceof ErroApiSetores && !erro.message.includes('detalhe-interno'));
  for (const corpo of [{}, [null], [{ ...setor, descricao: 1 }], [{ ...setor, createdAt: 'inválida' }], [{ ...setor, updatedAt: null }]]) {
    resposta = Response.json(corpo);
    await assert.rejects(() => listarSetores(), /Resposta inválida/);
  }
  resposta = Response.json({});
  await assert.rejects(() => cadastrarSetor({ nome: 'Costura' }), /Verifique a lista antes de tentar novamente/);
});
