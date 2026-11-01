import test from 'node:test';
import assert from 'node:assert/strict';
import { alterarMotivoPausa, cadastrarMotivoPausa, definirStatusMotivoPausa, listarMotivosPausa, ErroApiMotivosPausa } from '../../../modules/pause-reasons/presentation/api-client.ts';

const motivo = { id: '1', nome: 'Corte', descricao: null, ativo: true, createdAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z' };

test('motivo de pausa: cliente REST usa mesma origem, GET sem cache, abort e corpos permitidos', async (t) => {
  const pedidos: { url: string; options: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    pedidos.push({ url, options });
    return Response.json(options.method ? motivo : [motivo], { status: options.method === 'POST' ? 201 : 200 });
  });
  const controller = new AbortController();
  assert.deepEqual(await listarMotivosPausa(controller.signal), [motivo]);
  assert.equal(pedidos[0].url, '/api/motivos-de-pausa');
  assert.equal(pedidos[0].options.cache, 'no-store');
  assert.equal(pedidos[0].options.signal, controller.signal);
  assert.deepEqual(await cadastrarMotivoPausa({ nome: ' Corte ', descricao: ' Área ' }), motivo);
  assert.equal(pedidos[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(String(pedidos[1].options.body)), { nome: ' Corte ', descricao: ' Área ' });
  assert.deepEqual(await alterarMotivoPausa('id/com espaço', { descricao: null }), motivo);
  assert.equal(pedidos[2].url, '/api/motivos-de-pausa/id%2Fcom%20espa%C3%A7o');
  assert.equal(pedidos[2].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(pedidos[2].options.body)), { descricao: null });
  assert.deepEqual(await definirStatusMotivoPausa('1', false), motivo);
  assert.equal(pedidos[3].url, '/api/motivos-de-pausa/1/status');
  assert.equal(pedidos[3].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(pedidos[3].options.body)), { ativo: false });
  assert.ok(pedidos.every((p) => p.options.credentials === 'same-origin'));
});

test('motivo de pausa: cliente preserva erro de conflito, autorização e inexistência', async (t) => {
  let status = 409;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { codigo: 'CONFLITO', mensagem: 'Nome de motivo de pausa já cadastrado.' } }, { status }));
  for (status of [400, 401, 403, 404, 409, 500]) {
    for (const executar of [() => listarMotivosPausa(), () => cadastrarMotivoPausa({ nome: 'Corte' }), () => alterarMotivoPausa('1', { nome: 'Corte' })]) {
      await assert.rejects(executar, (erro: unknown) => erro instanceof ErroApiMotivosPausa && erro.status === status && erro.message === 'Nome de motivo de pausa já cadastrado.');
    }
  }
});

test('motivo de pausa: cliente rejeita HTML, registros incompletos e datas inválidas', async (t) => {
  let resposta = new Response('<html>detalhe-interno</html>', { status: 500 });
  t.mock.method(globalThis, 'fetch', async () => resposta.clone());
  await assert.rejects(() => listarMotivosPausa(), (erro: unknown) => erro instanceof ErroApiMotivosPausa && !erro.message.includes('detalhe-interno'));
  for (const corpo of [{}, [null], [{ ...motivo, descricao: 1 }], [{ ...motivo, createdAt: 'inválida' }], [{ ...motivo, updatedAt: null }], [{ ...motivo, ativo: undefined }]]) {
    resposta = Response.json(corpo);
    await assert.rejects(() => listarMotivosPausa(), /Resposta inválida/);
  }
  resposta = Response.json({});
  await assert.rejects(() => cadastrarMotivoPausa({ nome: 'Corte' }), /Verifique a lista antes de tentar novamente/);
  await assert.rejects(() => alterarMotivoPausa('1', { nome: 'Corte' }), /Verifique a lista antes de tentar novamente/);
});

test('motivo de pausa: falha de transporte não repete automaticamente a gravação', async (t) => {
  let pedidos = 0;
  t.mock.method(globalThis, 'fetch', async () => { pedidos++; throw new TypeError('Failed to fetch'); });
  await assert.rejects(() => cadastrarMotivoPausa({ nome: 'Corte' }), /Failed to fetch/);
  assert.equal(pedidos, 1);
  await assert.rejects(() => alterarMotivoPausa('1', { descricao: null }), /Failed to fetch/);
  assert.equal(pedidos, 2);
});
