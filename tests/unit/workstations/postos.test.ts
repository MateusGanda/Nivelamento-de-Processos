import test from 'node:test';
import assert from 'node:assert/strict';
import { PostosService } from '../../../modules/workstations/application/postos.ts';
import type { PostoRepository } from '../../../modules/workstations/application/contracts.ts';
import { ErroDePosto, type AlteracaoPosto, type CadastroPosto, type Posto } from '../../../modules/workstations/domain/posto.ts';
import { traduzirErroGravacaoPosto } from '../../../modules/workstations/infrastructure/persistence-errors.ts';
import { criarHandlersPostos } from '../../../modules/workstations/presentation/http.ts';
import { filtrarOrdenarPostos, formatarDataCadastro } from '../../../modules/workstations/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const MONTAGEM = { id: '00000000-0000-4000-8000-000000000001', nome: 'Montagem' };
const PREPARACAO = { id: '00000000-0000-4000-8000-000000000002', nome: 'Preparação' };
const ANTIGO = { id: '00000000-0000-4000-8000-000000000003', nome: 'Setor antigo' };
const ID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

class RepositorioEmMemoria implements PostoRepository {
  postos: Posto[] = [];
  setores = [MONTAGEM, PREPARACAO, ANTIGO];
  setoresInativos = new Set([ANTIGO.id]);
  async listar() { return [...this.postos]; }
  async buscarPorId(id: string) { return this.postos.find((posto) => posto.id === id) ?? null; }
  async buscarPorCodigo(codigo: string) { return this.postos.find((posto) => posto.codigo === codigo) ?? null; }
  async buscarSetor(id: string) { const setor = this.setores.find((item) => item.id === id); return setor ? { ...setor, ativo: !this.setoresInativos.has(id) } : null; }
  async criar(dados: CadastroPosto) {
    // Simula a constraint atômica: pode falhar mesmo após a consulta prévia.
    if (this.postos.some((posto) => posto.codigo === dados.codigo)) {
      return traduzirErroGravacaoPosto({ sqlState: '23505', constraint: 'Posto_codigo_key' });
    }
    const setor = this.setores.find((s) => s.id === dados.setorId)!;
    const id = `00000000-0000-4000-9000-${String(this.postos.length + 1).padStart(12, '0')}`;
    const posto: Posto = { id, codigo: dados.codigo, nome: dados.nome, ativo: true, setor, createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' };
    this.postos.push(posto);
    return posto;
  }
  async alterar(id: string, dados: AlteracaoPosto) {
    const indice = this.postos.findIndex((posto) => posto.id === id);
    if (indice < 0) return null;
    if (dados.codigo !== undefined && this.postos.some((posto) => posto.id !== id && posto.codigo === dados.codigo)) {
      return traduzirErroGravacaoPosto({ sqlState: '23505', constraint: 'Posto_codigo_key' });
    }
    const { setorId, ...campos } = dados;
    const setor = setorId === undefined ? this.postos[indice].setor : this.setores.find((s) => s.id === setorId)!;
    this.postos[indice] = { ...this.postos[indice], ...campos, setor, updatedAt: '2026-10-20T12:00:00Z' };
    return this.postos[indice];
  }
  async definirAtivo(id: string, ativo: boolean) {
    const posto = this.postos.find((item) => item.id === id);
    if (!posto) return null;
    posto.ativo = ativo;
    posto.updatedAt = '2026-10-20T12:00:00Z';
    return posto;
  }
}

const post = (corpo: unknown) => new Request('http://localhost/api/postos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const patch = (corpo: unknown) => new Request('http://localhost/api/postos/id', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const erroCom = (codigo: ErroDePosto['codigo'], mensagem?: RegExp) => (erro: unknown) =>
  erro instanceof ErroDePosto && erro.codigo === codigo && (!mensagem || mensagem.test(erro.message));

test('posto: cria ativo no setor, remove só espaços externos e preserva caixa', async () => {
  const service = new PostosService(new RepositorioEmMemoria());
  const posto = await service.criar({ codigo: '  mon-01  ', nome: '  Montagem  1  ', setorId: ` ${MONTAGEM.id} ` });
  assert.deepEqual([posto.codigo, posto.nome, posto.ativo, posto.setor], ['mon-01', 'Montagem  1', true, MONTAGEM]);
  assert.deepEqual(Object.keys(posto).sort(), ['ativo', 'codigo', 'createdAt', 'id', 'nome', 'setor', 'updatedAt']);
  await service.criar({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id });
  assert.equal((await service.listar()).length, 2);
});

test('posto: código, nome e setor são obrigatórios, e o setor precisa ser um identificador válido', async () => {
  const service = new PostosService(new RepositorioEmMemoria());
  for (const dados of [
    { codigo: '', nome: 'Posto', setorId: MONTAGEM.id }, { codigo: 'P1', nome: '  ', setorId: MONTAGEM.id },
    { codigo: 'P1', nome: 'Posto', setorId: '' }, { codigo: 'P1', nome: 'Posto', setorId: 'setor-1' },
    { codigo: 1, nome: 'Posto', setorId: MONTAGEM.id },
  ]) {
    await assert.rejects(() => service.criar(dados as CadastroPosto), erroCom('ENTRADA_INVALIDA'));
  }
});

test('posto: setor inexistente é recusado antes de gravar', async () => {
  const repositorio = new RepositorioEmMemoria();
  await assert.rejects(() => new PostosService(repositorio).criar({ codigo: 'P1', nome: 'Posto', setorId: '00000000-0000-4000-8000-0000000000ff' }), erroCom('ENTRADA_INVALIDA', /Setor não encontrado/));
  assert.equal(repositorio.postos.length, 0);
});

test('posto: código repetido gera conflito, inclusive em criações simultâneas', async () => {
  const service = new PostosService(new RepositorioEmMemoria());
  await service.criar({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id });
  await assert.rejects(() => service.criar({ codigo: ' MON-01 ', nome: 'Outro', setorId: PREPARACAO.id }), erroCom('CONFLITO'));
  const paralelo = new PostosService(new RepositorioEmMemoria());
  const resultados = await Promise.allSettled([
    paralelo.criar({ codigo: 'PRE-01', nome: 'Corte 1', setorId: PREPARACAO.id }),
    paralelo.criar({ codigo: 'PRE-01', nome: 'Corte 2', setorId: PREPARACAO.id }),
  ]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
});

test('posto: traduz as violações de código único e de setor, inclusive na cadeia cause', () => {
  assert.throws(() => traduzirErroGravacaoPosto({ sqlState: '23505', constraint: 'Posto_codigo_key' }), erroCom('CONFLITO'));
  assert.throws(() => traduzirErroGravacaoPosto({ message: 'falha', cause: { code: '23505', constraint: 'Posto_codigo_key' } }), erroCom('CONFLITO'));
  assert.throws(() => traduzirErroGravacaoPosto({ code: '23503', constraint: 'Posto_setorId_fkey' }), erroCom('ENTRADA_INVALIDA', /Setor não encontrado/));
  const outro = { code: '23505', constraint: 'Outra_key' };
  assert.throws(() => traduzirErroGravacaoPosto(outro), (erro: unknown) => erro === outro);
});

test('posto: handlers autorizados listam, criam com 201 e respondem 409 para código repetido', async () => {
  const handlers = criarHandlersPostos({ autorizar: async () => ({ id: 'admin' }), postos: new PostosService(new RepositorioEmMemoria()) });
  const criado = await handlers.POST(post({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id }));
  assert.equal(criado.status, 201);
  assert.equal((await criado.json()).setor.nome, 'Montagem');
  assert.equal((await handlers.POST(post({ codigo: 'MON-01', nome: 'Outro', setorId: MONTAGEM.id }))).status, 409);
  const lista = await handlers.GET();
  assert.equal(lista.status, 200);
  assert.equal(lista.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await lista.json()).map((p: Posto) => p.codigo), ['MON-01']);
});

test('posto: JSON inválido, campos extras e tipos incorretos são recusados antes de gravar', async () => {
  const repositorio = new RepositorioEmMemoria();
  const handlers = criarHandlersPostos({ autorizar: async () => ({}), postos: new PostosService(repositorio) });
  const invalidos = [
    new Request('http://localhost/api/postos', { method: 'POST', body: '{' }),
    post([]), post({ codigo: 'P1', nome: 'Posto', setorId: MONTAGEM.id, ativo: false }), post({ codigo: 'P1', nome: 2, setorId: MONTAGEM.id }),
  ];
  for (const pedido of invalidos) assert.equal((await handlers.POST(pedido)).status, 400);
  assert.equal(repositorio.postos.length, 0);
});

test('posto: sem sessão ou sem ADMIN ativo não lê nem grava', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403]] as const) {
    const repositorio = new RepositorioEmMemoria();
    const handlers = criarHandlersPostos({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, postos: new PostosService(repositorio) });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(post({ codigo: 'P1', nome: 'Posto', setorId: MONTAGEM.id }))).status, status);
    assert.equal(repositorio.postos.length, 0);
  }
});

test('posto: altera só os campos enviados, troca o setor e mantém o próprio código', async () => {
  const service = new PostosService(new RepositorioEmMemoria());
  const criado = await service.criar({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id });
  const nome = await service.alterar(criado.id, { nome: ' Montagem principal ' });
  assert.deepEqual([nome.codigo, nome.nome, nome.setor, nome.ativo], ['MON-01', 'Montagem principal', MONTAGEM, true]);
  const setor = await service.alterar(criado.id, { setorId: PREPARACAO.id, codigo: 'MON-01' });
  assert.deepEqual([setor.codigo, setor.setor], ['MON-01', PREPARACAO]);
  const codigo = await service.alterar(criado.id, { codigo: 'PRE-09' });
  assert.deepEqual([codigo.id, codigo.codigo, codigo.createdAt], [criado.id, 'PRE-09', criado.createdAt]);
  assert.notEqual(codigo.updatedAt, criado.createdAt);
});

test('posto: alteração recusa código de outro posto, setor inexistente, campos vazios e posto inexistente', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new PostosService(repositorio);
  const a = await service.criar({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id });
  await service.criar({ codigo: 'MON-02', nome: 'Montagem 2', setorId: MONTAGEM.id });
  await assert.rejects(() => service.alterar(a.id, { codigo: 'MON-02' }), erroCom('CONFLITO'));
  await assert.rejects(() => service.alterar(a.id, { setorId: ID_INEXISTENTE }), erroCom('ENTRADA_INVALIDA', /Setor não encontrado/));
  await assert.rejects(() => service.alterar(a.id, { setorId: 'setor-1' }), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(a.id, {}), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(a.id, { nome: ' ' }), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(ID_INEXISTENTE, { nome: 'X' }), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.alterar('posto-1', { nome: 'X' }), erroCom('NAO_ENCONTRADO'));
  assert.deepEqual(repositorio.postos.map((p) => [p.codigo, p.nome, p.setor.id]), [['MON-01', 'Montagem 1', MONTAGEM.id], ['MON-02', 'Montagem 2', MONTAGEM.id]]);
});

test('posto: inativa e reativa sem alterar os demais dados', async () => {
  const service = new PostosService(new RepositorioEmMemoria());
  const criado = await service.criar({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id });
  const inativo = await service.definirStatus(criado.id, false);
  assert.deepEqual([inativo.ativo, inativo.codigo, inativo.nome, inativo.setor], [false, 'MON-01', 'Montagem 1', MONTAGEM]);
  assert.equal((await service.definirStatus(criado.id, true)).ativo, true);
  await assert.rejects(() => service.definirStatus(ID_INEXISTENTE, false), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.definirStatus('posto-1', false), erroCom('NAO_ENCONTRADO'));
});

test('posto: handlers de alteração e de status respondem 200, 400, 404 e 409', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new PostosService(repositorio);
  const handlers = criarHandlersPostos({ autorizar: async () => ({}), postos: service });
  const { id } = await service.criar({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id });
  await service.criar({ codigo: 'MON-02', nome: 'Montagem 2', setorId: MONTAGEM.id });
  const alterado = await handlers.PATCH(patch({ nome: 'Montagem A', setorId: PREPARACAO.id }), id);
  assert.equal(alterado.status, 200);
  assert.deepEqual([(await alterado.json()).setor.nome], ['Preparação']);
  assert.equal((await handlers.PATCH(patch({ codigo: 'MON-02' }), id)).status, 409);
  assert.equal((await handlers.PATCH(patch({ nome: 'X' }), ID_INEXISTENTE)).status, 404);
  for (const corpo of [{ ativo: false }, { codigo: 1 }, []]) assert.equal((await handlers.PATCH(patch(corpo), id)).status, 400);
  const status = await handlers.PATCH_STATUS(patch({ ativo: false }), id);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).ativo, false);
  for (const corpo of [{}, { ativo: 'false' }, { ativo: true, nome: 'X' }]) assert.equal((await handlers.PATCH_STATUS(patch(corpo), id)).status, 400);
  assert.equal((await handlers.PATCH_STATUS(patch({ ativo: true }), ID_INEXISTENTE)).status, 404);
  assert.deepEqual(repositorio.postos.map((p) => [p.codigo, p.nome, p.ativo]), [['MON-01', 'Montagem A', false], ['MON-02', 'Montagem 2', true]]);
});

test('posto: alteração e status sem sessão ou sem ADMIN ativo não gravam', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403]] as const) {
    const repositorio = new RepositorioEmMemoria();
    const service = new PostosService(repositorio);
    const { id } = await service.criar({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id });
    const handlers = criarHandlersPostos({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, postos: service });
    assert.equal((await handlers.PATCH(patch({ nome: 'Outro' }), id)).status, status);
    assert.equal((await handlers.PATCH_STATUS(patch({ ativo: false }), id)).status, status);
    assert.deepEqual(repositorio.postos.map((p) => [p.nome, p.ativo]), [['Montagem 1', true]]);
  }
});

test('posto: falha inesperada responde 500 sem detalhes internos', async () => {
  const falha = async () => { throw new Error('connect ECONNREFUSED'); };
  const handlers = criarHandlersPostos({ autorizar: async () => ({}), postos: { listar: falha, criar: falha, alterar: falha, definirStatus: falha } });
  const resposta = await handlers.GET();
  assert.equal(resposta.status, 500);
  assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
});

test('posto: busca por código, nome ou setor ignora caixa e acentos, filtra status e ordena sem alterar a entrada', () => {
  const base = (id: string, codigo: string, nome: string, setor: { id: string; nome: string }, ativo: boolean, createdAt: string): Posto =>
    ({ id, codigo, nome, ativo, setor, createdAt, updatedAt: createdAt });
  const postos = [
    base('1', 'MON-02', 'Montagem 2', MONTAGEM, true, '2026-10-19T12:00:00Z'),
    base('2', 'PRE-01', 'Corte 1', PREPARACAO, false, '2026-10-18T12:00:00Z'),
    base('3', 'MON-01', 'Montagem 1', MONTAGEM, true, '2026-10-17T12:00:00Z'),
  ];
  const copia = structuredClone(postos);
  assert.deepEqual(filtrarOrdenarPostos(postos, 'preparacao', 'todos', { coluna: 'codigo', direcao: 'asc' }).map((p) => p.codigo), ['PRE-01']);
  assert.deepEqual(filtrarOrdenarPostos(postos, '', 'ativos', { coluna: 'codigo', direcao: 'asc' }).map((p) => p.codigo), ['MON-01', 'MON-02']);
  assert.deepEqual(filtrarOrdenarPostos(postos, '', 'todos', { coluna: 'setor', direcao: 'desc' }).map((p) => p.codigo), ['PRE-01', 'MON-02', 'MON-01']);
  assert.deepEqual(filtrarOrdenarPostos(postos, '', 'todos', { coluna: 'createdAt', direcao: 'asc' }).map((p) => p.codigo), ['MON-01', 'PRE-01', 'MON-02']);
  assert.deepEqual(postos, copia);
  assert.equal(formatarDataCadastro('2026-10-19T12:00:00Z'), '19/10/2026, 09:00');
});

test('posto: setor inativo não recebe posto novo nem troca de setor, mas o posto que já está nele continua', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new PostosService(repositorio);
  await assert.rejects(() => service.criar({ codigo: 'ANT-01', nome: 'Antigo', setorId: ANTIGO.id }), erroCom('ENTRADA_INVALIDA', /inativo/));
  const posto = await service.criar({ codigo: 'MON-01', nome: 'Montagem 1', setorId: MONTAGEM.id });
  await assert.rejects(() => service.alterar(posto.id, { setorId: ANTIGO.id }), erroCom('ENTRADA_INVALIDA', /inativo/));
  repositorio.setoresInativos.add(MONTAGEM.id);
  const mantido = await service.alterar(posto.id, { nome: 'Montagem principal', setorId: MONTAGEM.id });
  assert.deepEqual([mantido.nome, mantido.setor.id], ['Montagem principal', MONTAGEM.id]);
  assert.equal((await service.alterar(posto.id, { setorId: PREPARACAO.id })).setor.id, PREPARACAO.id);
});
