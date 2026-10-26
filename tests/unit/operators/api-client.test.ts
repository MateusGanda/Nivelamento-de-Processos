import test from 'node:test';
import assert from 'node:assert/strict';
import { alterarOperador, cadastrarOperador, definirStatusOperador, listarOperadores, ErroApiOperadores } from '../../../modules/operators/presentation/api-client.ts';

const operador = { id: '1', nome: 'Ana', matricula: 'op-001', ativo: true, funcao: null, setorPrincipal: null, createdAt: '2026-10-13T12:00:00Z', updatedAt: '2026-10-13T12:00:00Z' };

test('cliente PATCH preserva campos omitidos, envia função nula e codifica o identificador', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
    assert.equal(input, '/api/operadores/id%2Fteste');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(options.body)), { funcao: null });
    return Response.json(operador);
  });
  assert.deepEqual(await alterarOperador('id/teste', { funcao: null }), operador);
});

test('cliente consome REST com sessão da mesma origem e envia somente os dados do cadastro', async (t) => {
  const pedidos: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
    assert.equal(input, '/api/operadores');
    pedidos.push(options);
    return Response.json(options.method === 'POST' ? operador : [operador], { status: options.method === 'POST' ? 201 : 200 });
  });
  assert.deepEqual(await listarOperadores(), [operador]);
  assert.equal(pedidos[0].cache, 'no-store');
  assert.equal(pedidos[0].credentials, 'same-origin');
  assert.deepEqual(await cadastrarOperador({ nome: ' Ana ', setorPrincipalId: 'setor-1', funcao: 'Auxiliar' }), operador);
  assert.equal(pedidos[1].credentials, 'same-origin');
  assert.deepEqual(JSON.parse(String(pedidos[1].body)), { nome: ' Ana ', setorPrincipalId: 'setor-1', funcao: 'Auxiliar' });
});

test('cliente preserva o status para tratar sessão e mostra erro de conflito da API', async (t) => {
  let status = 409;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { codigo: 'CONFLITO', mensagem: 'Matrícula já cadastrada.' } }, { status }));
  await assert.rejects(() => cadastrarOperador({ nome: 'Ana', setorPrincipalId: 'setor-1' }), (erro: unknown) => erro instanceof ErroApiOperadores && erro.status === 409 && erro.message === 'Matrícula já cadastrada.');
  for (status of [401, 403]) {
    await assert.rejects(() => listarOperadores(), (erro: unknown) => erro instanceof ErroApiOperadores && erro.status === status);
  }
});

test('cliente trata HTML de erro e rejeita dados que quebrariam a tabela', async (t) => {
  let resposta = new Response('<html>detalhe-interno</html>', { status: 500 });
  t.mock.method(globalThis, 'fetch', async () => resposta);
  await assert.rejects(() => listarOperadores(), (erro: unknown) => erro instanceof ErroApiOperadores && !erro.message.includes('detalhe-interno'));
  for (const corpo of [{}, [null], [{ ...operador, createdAt: 'inválida' }], [{ ...operador, setorPrincipal: { id: '1', nome: 'Setor' } }], [{ ...operador, funcao: 123 }]]) {
    resposta = Response.json(corpo);
    await assert.rejects(() => listarOperadores(), /Resposta inválida/);
  }
});

test('cliente de status envia só ativo e preserva a mensagem de conflito', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
    assert.equal(input, '/api/operadores/id%2Fteste/status');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(options.body)), { ativo: false });
    return Response.json({ ...operador, ativo: false });
  });
  assert.equal((await definirStatusOperador('id/teste', false)).ativo, false);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { codigo: 'CONFLITO', mensagem: 'O operador tem uma execução aberta.' } }, { status: 409 }));
  await assert.rejects(() => definirStatusOperador('1', false), (erro: unknown) => erro instanceof ErroApiOperadores && erro.status === 409 && erro.message === 'O operador tem uma execução aberta.');
});
