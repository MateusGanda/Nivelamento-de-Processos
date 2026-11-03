import test from 'node:test';
import assert from 'node:assert/strict';
import { ErroApiOperadores } from '../../../modules/operators/presentation/api-client.ts';
import { ErroCrachaOperador, gerarQrOperador, prepararCrachaOperador } from '../../../modules/operators/presentation/cracha-operador.ts';
import type { Operador } from '../../../modules/operators/domain/operador.ts';

const operador: Operador = {
  id: 'operador-1', nome: 'Luís Gustavo Nunes dos Santos', matricula: 'LGNS-PES1', ativo: true,
  funcao: null, setorPrincipal: { id: 'setor-1', codigo: 'PES1', nome: 'Pesponto' },
  createdAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z',
};

test('crachá consulta dados atuais com sessão e sem cache, selecionando pelo ID', async (t) => {
  const controller = new AbortController();
  const atualizado = { ...operador, nome: 'Nome atualizado', setorPrincipal: { id: 'setor-2', codigo: 'COS1', nome: 'Costura' } };
  t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
    assert.equal(input, '/api/operadores'); assert.equal(options.signal, controller.signal);
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store');
    assert.equal(options.method, undefined);
    return Response.json([{ ...operador, id: 'outro-id', matricula: '1001' }, atualizado]);
  });
  const resultado = await prepararCrachaOperador(operador.id, controller.signal, async (texto) => {
    assert.equal(texto, operador.matricula); return 'png-confirmado';
  });
  assert.deepEqual(resultado.operador, atualizado);
  assert.equal(resultado.qrPng, 'png-confirmado');
  assert.equal(resultado.nomeArquivo, 'qr-operador-operador-1.png');
});

test('crachá preserva matrículas antigas, caixa, acentos e caracteres sem normalizar pelo nome ou setor', async (t) => {
  let matricula = '';
  t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...operador, matricula, setorPrincipal: null }]));
  for (matricula of ['1001', 'op-001', 'ÁS/Legado+01', ' LGNS-PES1 ']) {
    const resultado = await prepararCrachaOperador(operador.id, new AbortController().signal, async (texto) => {
      assert.equal(texto, matricula); return 'png';
    });
    assert.equal(resultado.operador.matricula, matricula);
    assert.equal(resultado.operador.setorPrincipal, null);
  }
});

test('crachá recusa operador inativado ou indisponível na nova consulta e não gera imagem', async (t) => {
  let dados: Operador[] = [{ ...operador, ativo: false }];
  let geracoes = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json(dados));
  const preparar = () => prepararCrachaOperador(operador.id, new AbortController().signal, async () => { geracoes++; return 'png'; });
  await assert.rejects(preparar, /inativo/);
  dados = [];
  await assert.rejects(preparar, /não está mais disponível/);
  dados = [{ ...operador, matricula: '   ' }];
  await assert.rejects(preparar, /matrícula válida/);
  assert.equal(geracoes, 0);
});

test('crachá preserva 401 e 403 para encerrar a prévia e tratar perda de acesso administrativo', async (t) => {
  let status = 401;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { mensagem: 'Acesso recusado.' } }, { status }));
  for (status of [401, 403]) {
    await assert.rejects(() => prepararCrachaOperador(operador.id, new AbortController().signal),
      (falha: unknown) => falha instanceof ErroApiOperadores && falha.status === status);
  }
});

test('crachá ignora consulta que termina depois do cancelamento mesmo se fetch desrespeitar o sinal', async (t) => {
  let responder!: (resposta: Response) => void;
  let gerou = false;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => { responder = resolve; }));
  const controller = new AbortController();
  const pendente = prepararCrachaOperador(operador.id, controller.signal, async () => { gerou = true; return 'png'; });
  controller.abort(); responder(Response.json([operador]));
  await assert.rejects(pendente, { name: 'AbortError' });
  assert.equal(gerou, false);
});

test('crachá não entrega PNG gerado depois de fechar a prévia e permite uma nova tentativa independente', async (t) => {
  let terminar!: (png: string) => void;
  let avisarInicio!: () => void;
  const iniciou = new Promise<void>((resolve) => { avisarInicio = resolve; });
  t.mock.method(globalThis, 'fetch', async () => Response.json([operador]));
  const controller = new AbortController();
  const pendente = prepararCrachaOperador(operador.id, controller.signal, () => new Promise<string>((resolve) => { terminar = resolve; avisarInicio(); }));
  await iniciou;
  controller.abort();
  const novo = await prepararCrachaOperador(operador.id, new AbortController().signal, async () => 'png-novo');
  terminar('png-antigo');
  await assert.rejects(pendente, { name: 'AbortError' });
  assert.equal(novo.qrPng, 'png-novo');
});

test('falha na geração não expõe detalhes da biblioteca e repetir consulta novamente os dados', async (t) => {
  let consultas = 0;
  t.mock.method(globalThis, 'fetch', async () => { consultas++; return Response.json([operador]); });
  await assert.rejects(() => prepararCrachaOperador(operador.id, new AbortController().signal, async () => { throw new Error('detalhe interno da biblioteca'); }),
    (falha: unknown) => falha instanceof ErroCrachaOperador && falha.message === 'Não foi possível gerar o QR Code. Tente novamente.');
  assert.equal((await prepararCrachaOperador(operador.id, new AbortController().signal, async () => 'png-novo')).qrPng, 'png-novo');
  assert.equal(consultas, 2);
});

test('cancelamento antes de abrir não consulta a API e erro de rede não produz um crachá', async (t) => {
  let consultas = 0;
  t.mock.method(globalThis, 'fetch', async () => { consultas++; throw new TypeError('Failed to fetch'); });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => prepararCrachaOperador(operador.id, controller.signal), { name: 'AbortError' });
  assert.equal(consultas, 0);
  await assert.rejects(() => prepararCrachaOperador(operador.id, new AbortController().signal), TypeError);
  assert.equal(consultas, 1);
});

test('biblioteca gera PNG real de 1024 px para matrícula atual, antiga e Unicode, com resultado permanente', async () => {
  for (const matricula of ['LGNS-PES1', '1001', 'ÁS/Legado+01']) {
    const png = await gerarQrOperador(matricula);
    assert.match(png, /^data:image\/png;base64,/);
    const bytes = Buffer.from(png.split(',')[1], 'base64');
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), 1024); assert.equal(bytes.readUInt32BE(20), 1024);
    assert.equal(await gerarQrOperador(matricula), png);
  }
});
