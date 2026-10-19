import test from 'node:test';
import assert from 'node:assert/strict';
import { ProdutosService } from '../../../modules/products/application/produtos.ts';
import type { ProdutoRepository } from '../../../modules/products/application/contracts.ts';
import { ErroDeProduto, type AlteracaoProduto, type CadastroProduto, type Produto } from '../../../modules/products/domain/produto.ts';
import { traduzirErroGravacaoProduto } from '../../../modules/products/infrastructure/persistence-errors.ts';
import { criarHandlersProdutos } from '../../../modules/products/presentation/http.ts';
import { filtrarOrdenarProdutos, formatarDataCadastro } from '../../../modules/products/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const ID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

class RepositorioEmMemoria implements ProdutoRepository {
  produtos: Produto[] = [];
  async listar() { return [...this.produtos]; }
  async buscarPorId(id: string) { return this.produtos.find((produto) => produto.id === id) ?? null; }
  async buscarPorCodigo(codigo: string) { return this.produtos.find((produto) => produto.codigo === codigo) ?? null; }
  async criar(dados: CadastroProduto) {
    // Simula a constraint atômica: pode falhar mesmo após a consulta prévia.
    if (this.produtos.some((produto) => produto.codigo === dados.codigo)) {
      return traduzirErroGravacaoProduto({ sqlState: '23505', constraint: 'Produto_codigo_key' });
    }
    const id = `00000000-0000-4000-8000-${String(this.produtos.length + 1).padStart(12, '0')}`;
    const produto: Produto = { id, ...dados, createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' };
    this.produtos.push(produto);
    return produto;
  }
  async alterar(id: string, dados: AlteracaoProduto) {
    const indice = this.produtos.findIndex((produto) => produto.id === id);
    if (indice < 0) return null;
    if (dados.codigo !== undefined && this.produtos.some((produto) => produto.id !== id && produto.codigo === dados.codigo)) {
      return traduzirErroGravacaoProduto({ sqlState: '23505', constraint: 'Produto_codigo_key' });
    }
    this.produtos[indice] = { ...this.produtos[indice], ...dados, updatedAt: '2026-10-20T12:00:00Z' };
    return this.produtos[indice];
  }
}

const pedido = (method: 'POST' | 'PATCH', corpo: unknown) => new Request('http://localhost/api/produtos', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const erroCom = (codigo: ErroDeProduto['codigo'], mensagem?: RegExp) => (erro: unknown) =>
  erro instanceof ErroDeProduto && erro.codigo === codigo && (!mensagem || mensagem.test(erro.message));

test('produto: cria removendo só espaços externos e preservando a caixa', async () => {
  const service = new ProdutosService(new RepositorioEmMemoria());
  const produto = await service.criar({ codigo: '  prd-001  ', nome: '  Produto  A  ' });
  assert.deepEqual([produto.codigo, produto.nome], ['prd-001', 'Produto  A']);
  assert.deepEqual(Object.keys(produto).sort(), ['codigo', 'createdAt', 'id', 'nome', 'updatedAt']);
  await service.criar({ codigo: 'PRD-001', nome: 'Produto A' });
  assert.equal((await service.listar()).length, 2);
});

test('produto: código e nome são obrigatórios', async () => {
  const service = new ProdutosService(new RepositorioEmMemoria());
  for (const dados of [{ codigo: '', nome: 'Produto' }, { codigo: 'P1', nome: '  ' }, { codigo: 1, nome: 'Produto' }, { codigo: 'P1' }]) {
    await assert.rejects(() => service.criar(dados as CadastroProduto), erroCom('ENTRADA_INVALIDA'));
  }
});

test('produto: código repetido gera conflito, inclusive em criações simultâneas', async () => {
  const service = new ProdutosService(new RepositorioEmMemoria());
  await service.criar({ codigo: 'PRD-001', nome: 'Produto A' });
  await assert.rejects(() => service.criar({ codigo: ' PRD-001 ', nome: 'Outro' }), erroCom('CONFLITO'));
  const paralelo = new ProdutosService(new RepositorioEmMemoria());
  const resultados = await Promise.allSettled([
    paralelo.criar({ codigo: 'PRD-002', nome: 'Produto B' }),
    paralelo.criar({ codigo: 'PRD-002', nome: 'Produto C' }),
  ]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
});

test('produto: altera só os campos enviados e mantém o próprio código', async () => {
  const service = new ProdutosService(new RepositorioEmMemoria());
  const criado = await service.criar({ codigo: 'PRD-001', nome: 'Produto A' });
  const nome = await service.alterar(criado.id, { nome: ' Produto A revisado ' });
  assert.deepEqual([nome.codigo, nome.nome], ['PRD-001', 'Produto A revisado']);
  const mesmoCodigo = await service.alterar(criado.id, { codigo: 'PRD-001', nome: 'Produto A' });
  assert.equal(mesmoCodigo.codigo, 'PRD-001');
  const codigo = await service.alterar(criado.id, { codigo: 'PRD-010' });
  assert.deepEqual([codigo.id, codigo.codigo, codigo.nome, codigo.createdAt], [criado.id, 'PRD-010', 'Produto A', criado.createdAt]);
  assert.notEqual(codigo.updatedAt, criado.updatedAt);
});

test('produto: alteração recusa código de outro produto, campos vazios e produto inexistente', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new ProdutosService(repositorio);
  const a = await service.criar({ codigo: 'PRD-001', nome: 'Produto A' });
  await service.criar({ codigo: 'PRD-002', nome: 'Produto B' });
  await assert.rejects(() => service.alterar(a.id, { codigo: 'PRD-002' }), erroCom('CONFLITO'));
  await assert.rejects(() => service.alterar(a.id, {}), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(a.id, { nome: ' ' }), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(ID_INEXISTENTE, { nome: 'X' }), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.alterar('produto-1', { nome: 'X' }), erroCom('NAO_ENCONTRADO'));
  assert.deepEqual(repositorio.produtos.map((p) => [p.codigo, p.nome]), [['PRD-001', 'Produto A'], ['PRD-002', 'Produto B']]);
});

test('produto: traduz a violação de código único, inclusive na cadeia cause', () => {
  assert.throws(() => traduzirErroGravacaoProduto({ sqlState: '23505', constraint: 'Produto_codigo_key' }), erroCom('CONFLITO'));
  assert.throws(() => traduzirErroGravacaoProduto({ message: 'falha', cause: { code: '23505', constraint: 'Produto_codigo_key' } }), erroCom('CONFLITO'));
  const outro = { code: '23505', constraint: 'Outra_key' };
  assert.throws(() => traduzirErroGravacaoProduto(outro), (erro: unknown) => erro === outro);
});

test('produto: handlers listam, criam com 201, alteram com 200 e respondem 404 e 409', async () => {
  const handlers = criarHandlersProdutos({ autorizar: async () => ({ id: 'admin' }), produtos: new ProdutosService(new RepositorioEmMemoria()) });
  const criado = await handlers.POST(pedido('POST', { codigo: 'PRD-001', nome: 'Produto A' }));
  assert.equal(criado.status, 201);
  const { id } = await criado.json();
  assert.equal((await handlers.POST(pedido('POST', { codigo: 'PRD-001', nome: 'Outro' }))).status, 409);
  const alterado = await handlers.PATCH(pedido('PATCH', { nome: 'Produto A2' }), id);
  assert.equal(alterado.status, 200);
  assert.equal((await alterado.json()).nome, 'Produto A2');
  assert.equal((await handlers.PATCH(pedido('PATCH', { nome: 'X' }), ID_INEXISTENTE)).status, 404);
  const lista = await handlers.GET();
  assert.equal(lista.status, 200);
  assert.equal(lista.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await lista.json()).map((p: Produto) => p.nome), ['Produto A2']);
});

test('produto: JSON inválido, campos extras e tipos incorretos são recusados antes de gravar', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new ProdutosService(repositorio);
  const handlers = criarHandlersProdutos({ autorizar: async () => ({}), produtos: service });
  const { id } = await service.criar({ codigo: 'PRD-001', nome: 'Produto A' });
  for (const method of ['POST', 'PATCH'] as const) {
    const invalidos = [
      new Request('http://localhost/api/produtos', { method, body: '{' }),
      pedido(method, []), pedido(method, { codigo: 'P1', nome: 'Produto', ativo: false }), pedido(method, { codigo: 'P1', nome: 2 }),
    ];
    for (const req of invalidos) {
      const resposta = method === 'POST' ? await handlers.POST(req) : await handlers.PATCH(req, id);
      assert.equal(resposta.status, 400);
    }
  }
  assert.deepEqual(repositorio.produtos.map((p) => [p.codigo, p.nome]), [['PRD-001', 'Produto A']]);
});

test('produto: sem sessão ou sem ADMIN ativo não lê nem grava', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403]] as const) {
    const repositorio = new RepositorioEmMemoria();
    const service = new ProdutosService(repositorio);
    const { id } = await service.criar({ codigo: 'PRD-001', nome: 'Produto A' });
    const handlers = criarHandlersProdutos({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, produtos: service });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(pedido('POST', { codigo: 'P2', nome: 'Produto' }))).status, status);
    assert.equal((await handlers.PATCH(pedido('PATCH', { nome: 'Outro' }), id)).status, status);
    assert.deepEqual(repositorio.produtos.map((p) => [p.codigo, p.nome]), [['PRD-001', 'Produto A']]);
  }
});

test('produto: falha inesperada responde 500 sem detalhes internos', async () => {
  const falha = async () => { throw new Error('connect ECONNREFUSED'); };
  const handlers = criarHandlersProdutos({ autorizar: async () => ({}), produtos: { listar: falha, criar: falha, alterar: falha } });
  const resposta = await handlers.GET();
  assert.equal(resposta.status, 500);
  assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
});

test('produto: busca por código ou nome ignora caixa e acentos e ordena sem alterar a entrada', () => {
  const base = (id: string, codigo: string, nome: string, createdAt: string, updatedAt = createdAt): Produto => ({ id, codigo, nome, createdAt, updatedAt });
  const produtos = [
    base('1', 'PRD-002', 'Calçado B', '2026-10-19T12:00:00Z'),
    base('2', 'PRD-010', 'Bolsa', '2026-10-17T12:00:00Z', '2026-10-20T12:00:00Z'),
    base('3', 'PRD-001', 'Calçado A', '2026-10-18T12:00:00Z'),
  ];
  const copia = structuredClone(produtos);
  assert.deepEqual(filtrarOrdenarProdutos(produtos, 'CALCADO', { coluna: 'codigo', direcao: 'asc' }).map((p) => p.codigo), ['PRD-001', 'PRD-002']);
  assert.deepEqual(filtrarOrdenarProdutos(produtos, '', { coluna: 'codigo', direcao: 'asc' }).map((p) => p.codigo), ['PRD-001', 'PRD-002', 'PRD-010']);
  assert.deepEqual(filtrarOrdenarProdutos(produtos, '', { coluna: 'nome', direcao: 'desc' }).map((p) => p.codigo), ['PRD-002', 'PRD-001', 'PRD-010']);
  assert.deepEqual(filtrarOrdenarProdutos(produtos, '', { coluna: 'createdAt', direcao: 'asc' }).map((p) => p.codigo), ['PRD-010', 'PRD-001', 'PRD-002']);
  assert.deepEqual(filtrarOrdenarProdutos(produtos, '', { coluna: 'updatedAt', direcao: 'desc' }).map((p) => p.codigo), ['PRD-010', 'PRD-002', 'PRD-001']);
  assert.deepEqual(produtos, copia);
  assert.equal(formatarDataCadastro('2026-10-19T12:00:00Z'), '19/10/2026, 09:00');
});
