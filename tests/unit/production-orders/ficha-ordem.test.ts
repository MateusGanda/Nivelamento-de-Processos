import test from 'node:test';
import assert from 'node:assert/strict';
import { codigoQrDaOrdem } from '../../../modules/production-orders/domain/identificacao-ordem.ts';
import { ErroApiOrdens } from '../../../modules/production-orders/presentation/api-client.ts';
import { ErroApiRoteiros } from '../../../modules/routings/presentation/api-client.ts';
import { ErroFichaOrdem, prepararFichaOrdem } from '../../../modules/production-orders/presentation/ficha-ordem.ts';
import { gerarQrPng } from '../../../shared/presentation/qr-code.ts';
import type { Ordem } from '../../../modules/production-orders/domain/ordem.ts';
import type { RoteiroDetalhe } from '../../../modules/routings/domain/roteiro.ts';

const id = (numero: number) => `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;
const ordem: Ordem = {
  id: 'aabbccdd-1234-4abc-8def-123456789abc', numero: 'OP-0001', quantidade: 12.5, unidade: 'pares',
  plano: { id: id(1), codigo: 'PL-1' }, produto: { id: id(2), codigo: 'PRO-1', nome: 'Produto teste' },
  roteiro: { id: id(3), nome: 'Roteiro vinculado', versao: 1 }, quantidadeExecucoes: 0,
  createdAt: '2026-11-03T12:00:00Z', updatedAt: '2026-11-03T12:00:00Z',
};
const roteiro: RoteiroDetalhe = {
  ...ordem.roteiro, ativo: true, quantidadeEtapas: 2, quantidadeOrdens: 1, travado: true,
  createdAt: ordem.createdAt, updatedAt: ordem.updatedAt,
  versoes: [{ id: id(3), versao: 1, ativo: true }, { id: id(4), versao: 2, ativo: true }], produtos: [],
  etapas: [
    { id: id(12), ordem: 2, operacao: { id: id(22), nome: 'Costura' }, postos: [] },
    { id: id(11), ordem: 1, operacao: { id: id(21), nome: 'Corte' }, postos: [] },
  ],
};
const codigo = 'GUNP-OP-AABBCCDD-1234-4ABC-8DEF-123456789ABC';

test('QR de ordem usa somente UUID permanente em maiúsculas, com prefixo de tipo', () => {
  assert.equal(codigoQrDaOrdem(ordem.id), codigo);
  assert.equal(codigoQrDaOrdem(ordem.id.toUpperCase()), codigo);
  for (const invalido of ['OP-0001', '', '../arquivo', '0000-uuid']) assert.throws(() => codigoQrDaOrdem(invalido), /Identificador de ordem inválido/);
});

test('ficha consulta ordem atualizada e versão vinculada com GET autenticado, sem cache e sem POST', async (t) => {
  const controller = new AbortController();
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    urls.push(url);
    assert.equal(options.method, undefined); assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store'); assert.equal(options.signal, controller.signal);
    if (url === '/api/ordens-de-producao') return Response.json([{ ...ordem, id: id(9) }, { ...ordem, numero: 'OP-ATUAL' }]);
    assert.equal(url, `/api/roteiros/${ordem.roteiro.id}`);
    return Response.json(roteiro);
  });
  const resultado = await prepararFichaOrdem(ordem.id.toUpperCase(), controller.signal, async (texto) => { assert.equal(texto, codigo); return 'png'; });
  assert.deepEqual(urls, ['/api/ordens-de-producao', `/api/roteiros/${ordem.roteiro.id}`]);
  assert.equal(resultado.ordem.numero, 'OP-ATUAL'); assert.equal(resultado.ordem.roteiro.versao, 1);
  assert.deepEqual(resultado.etapas.map((etapa) => [etapa.ordem, etapa.operacao]), [[1, 'Corte'], [2, 'Costura']]);
  assert.equal(roteiro.etapas[0].ordem, 2);
  assert.equal(resultado.codigoQr, codigo); assert.equal(resultado.qrPng, 'png');
  assert.equal(resultado.nomeArquivo, `qr-ordem-${ordem.id}.png`);
});

test('renumerar e alterar dados impressos não altera o QR; reabrir consulta novamente', async (t) => {
  let atual = ordem;
  const gerados: string[] = [];
  let consultas = 0;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    consultas++; return Response.json(url === '/api/ordens-de-producao' ? [atual] : roteiro);
  });
  const gerar = async (texto: string) => { gerados.push(texto); return texto; };
  const primeira = await prepararFichaOrdem(ordem.id, new AbortController().signal, gerar);
  atual = { ...ordem, numero: 'OP-RENOMEADA', quantidade: 25, plano: { id: id(5), codigo: 'PL-2' } };
  const segunda = await prepararFichaOrdem(ordem.id, new AbortController().signal, gerar);
  assert.equal(primeira.codigoQr, segunda.codigoQr); assert.deepEqual(gerados, [codigo, codigo]);
  assert.equal(segunda.ordem.numero, 'OP-RENOMEADA'); assert.equal(segunda.ordem.quantidade, 25);
  assert.equal(segunda.ordem.plano.codigo, 'PL-2'); assert.equal(consultas, 4);
});

test('emissão aceita ordem com execuções e roteiro inativo sem inferir disponibilidade para iniciar', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string) => Response.json(url === '/api/ordens-de-producao' ? [{ ...ordem, quantidadeExecucoes: 9 }] : { ...roteiro, ativo: false }));
  assert.equal((await prepararFichaOrdem(ordem.id, new AbortController().signal, async () => 'png')).ordem.quantidadeExecucoes, 9);
});

test('ordem inválida ou não encontrada não consulta roteiro nem gera ficha', async (t) => {
  let consultas = 0; let geracoes = 0;
  t.mock.method(globalThis, 'fetch', async () => { consultas++; return Response.json([]); });
  const gerar = async () => { geracoes++; return 'png'; };
  await assert.rejects(() => prepararFichaOrdem('invalida', new AbortController().signal, gerar), /Ordem de produção inválida/);
  assert.equal(consultas, 0);
  await assert.rejects(() => prepararFichaOrdem(ordem.id, new AbortController().signal, gerar), /não está mais disponível/);
  assert.equal(consultas, 1); assert.equal(geracoes, 0);
});

test('ficha recusa roteiro de outra versão, etapas incompletas/repetidas e campos essenciais vazios', async (t) => {
  let dadosRoteiro: unknown = roteiro;
  let dadosOrdem = ordem;
  let geracoes = 0;
  t.mock.method(globalThis, 'fetch', async (url: string) => Response.json(url === '/api/ordens-de-producao' ? [dadosOrdem] : dadosRoteiro));
  const preparar = () => prepararFichaOrdem(ordem.id, new AbortController().signal, async () => { geracoes++; return 'png'; });
  for (dadosRoteiro of [
    { ...roteiro, id: id(4) }, { ...roteiro, versao: 2 }, { ...roteiro, nome: '' },
    { ...roteiro, etapas: [], quantidadeEtapas: 0 }, { ...roteiro, quantidadeEtapas: 3 },
    { ...roteiro, etapas: [roteiro.etapas[0], roteiro.etapas[0]] },
    { ...roteiro, etapas: [roteiro.etapas[0], { ...roteiro.etapas[1], ordem: 2 }] },
    { ...roteiro, etapas: [{ ...roteiro.etapas[0], ordem: 0 }, roteiro.etapas[1]] },
    { ...roteiro, etapas: [{ ...roteiro.etapas[0], operacao: { id: id(22), nome: '' } }, roteiro.etapas[1]] },
  ]) await assert.rejects(preparar, ErroFichaOrdem);
  dadosRoteiro = roteiro;
  for (dadosOrdem of [{ ...ordem, quantidade: -1 }, { ...ordem, unidade: '' }, { ...ordem, numero: '' }]) await assert.rejects(preparar, ErroFichaOrdem);
  assert.equal(geracoes, 0);
});

test('ficha preserva 401/403 de ambas as consultas para encerrar a prévia e recuperar acesso', async (t) => {
  for (const alvo of ['ordem', 'roteiro']) for (const status of [401, 403]) {
    const mock = t.mock.method(globalThis, 'fetch', async (url: string) => {
      if (alvo === 'roteiro' && url === '/api/ordens-de-producao') return Response.json([ordem]);
      return Response.json({ erro: { mensagem: 'Acesso recusado.' } }, { status });
    });
    await assert.rejects(() => prepararFichaOrdem(ordem.id, new AbortController().signal),
      (falha: unknown) => (falha instanceof ErroApiOrdens || falha instanceof ErroApiRoteiros) && falha.status === status);
    mock.mock.restore();
  }
});

test('dados malformados e falha de roteiro não liberam ficha parcial; repetir refaz as duas consultas', async (t) => {
  let respostaRoteiro: unknown = null; let consultas = 0;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    consultas++;
    return url === '/api/ordens-de-producao' ? Response.json([ordem]) : Response.json(respostaRoteiro);
  });
  for (respostaRoteiro of [null, { ...roteiro, etapas: [null] }, { ...roteiro, etapas: [{ ordem: 1 }] }]) {
    await assert.rejects(() => prepararFichaOrdem(ordem.id, new AbortController().signal), ErroApiRoteiros);
  }
  respostaRoteiro = roteiro;
  const recuperada = await prepararFichaOrdem(ordem.id, new AbortController().signal, async () => 'png');
  assert.equal(recuperada.etapas.length, 2); assert.equal(consultas, 8);
});

test('cancelar a consulta da ordem ou do roteiro ignora respostas atrasadas sem gerar PNG', async (t) => {
  for (const alvo of ['ordem', 'roteiro']) {
    let responder!: (resposta: Response) => void;
    let avisar!: () => void;
    const iniciou = new Promise<void>((resolve) => { avisar = resolve; });
    let geracoes = 0;
    const mock = t.mock.method(globalThis, 'fetch', async (url: string) => {
      if (alvo === 'roteiro' && url === '/api/ordens-de-producao') return Response.json([ordem]);
      return new Promise<Response>((resolve) => { responder = resolve; avisar(); });
    });
    const controller = new AbortController();
    const pendente = prepararFichaOrdem(ordem.id, controller.signal, async () => { geracoes++; return 'png'; });
    await iniciou; controller.abort(); responder(Response.json(alvo === 'ordem' ? [ordem] : roteiro));
    await assert.rejects(pendente, { name: 'AbortError' }); assert.equal(geracoes, 0);
    mock.mock.restore();
  }
});

test('fechar durante geração descarta o PNG antigo sem afetar uma preparação nova', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string) => Response.json(url === '/api/ordens-de-producao' ? [ordem] : roteiro));
  let terminar!: (png: string) => void; let avisar!: () => void;
  const iniciou = new Promise<void>((resolve) => { avisar = resolve; });
  const controller = new AbortController();
  const pendente = prepararFichaOrdem(ordem.id, controller.signal, () => new Promise<string>((resolve) => { terminar = resolve; avisar(); }));
  await iniciou; controller.abort();
  const nova = await prepararFichaOrdem(ordem.id, new AbortController().signal, async () => 'png-novo');
  terminar('png-antigo');
  await assert.rejects(pendente, { name: 'AbortError' }); assert.equal(nova.qrPng, 'png-novo');
});

test('falha técnica de geração é recuperável sem expor detalhes e cancelamento não consulta', async (t) => {
  let consultas = 0;
  t.mock.method(globalThis, 'fetch', async (url: string) => { consultas++; return Response.json(url === '/api/ordens-de-producao' ? [ordem] : roteiro); });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => prepararFichaOrdem(ordem.id, controller.signal), { name: 'AbortError' });
  assert.equal(consultas, 0);
  await assert.rejects(() => prepararFichaOrdem(ordem.id, new AbortController().signal, async () => { throw new Error('detalhe interno'); }),
    (falha: unknown) => falha instanceof ErroFichaOrdem && falha.message === 'Não foi possível gerar o QR Code da ordem. Tente novamente.');
  assert.equal((await prepararFichaOrdem(ordem.id, new AbortController().signal, async () => 'png')).qrPng, 'png');
  assert.equal(consultas, 4);
});

test('ficha mantém nomes extensos e todas as etapas sem truncar o conteúdo preparado', async (t) => {
  const nomeLongo = 'Operação extensa — '.repeat(120);
  const etapas = Array.from({ length: 80 }, (_, indice) => ({ id: id(100 + indice), ordem: indice + 1, operacao: { id: id(999), nome: nomeLongo }, postos: [] }));
  t.mock.method(globalThis, 'fetch', async (url: string) => Response.json(url === '/api/ordens-de-producao'
    ? [{ ...ordem, produto: { ...ordem.produto, nome: nomeLongo } }]
    : { ...roteiro, etapas, quantidadeEtapas: etapas.length }));
  const ficha = await prepararFichaOrdem(ordem.id, new AbortController().signal, async () => 'png');
  assert.equal(ficha.etapas.length, 80); assert.equal(ficha.etapas[79].operacao, nomeLongo);
  assert.equal(ficha.ordem.produto.nome, nomeLongo);
});

test('QR real da ordem gera PNG de 1024 pixels e o código não se confunde com seu número legível', async () => {
  const png = await gerarQrPng(codigoQrDaOrdem(ordem.id));
  assert.match(png, /^data:image\/png;base64,/);
  const bytes = Buffer.from(png.split(',')[1], 'base64');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), 1024); assert.equal(bytes.readUInt32BE(20), 1024);
  assert.notEqual(codigo, ordem.numero);
});
