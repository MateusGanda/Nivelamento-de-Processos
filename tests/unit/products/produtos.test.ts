import { gerarCodigoProduto } from '../../../modules/products/domain/codigo-produto.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ProdutosService } from '../../../modules/products/application/produtos.ts';
import type { ProdutoRepository } from '../../../modules/products/application/contracts.ts';
import { ErroCodigoProdutoReservado, ErroDeProduto, type AlteracaoProduto, type CadastroProduto, type NovoProduto, type Produto } from '../../../modules/products/domain/produto.ts';
import { traduzirErroGravacaoProduto } from '../../../modules/products/infrastructure/persistence-errors.ts';
import { criarHandlersProdutos } from '../../../modules/products/presentation/http.ts';
import { filtrarOrdenarProdutos, formatarDataCadastro } from '../../../modules/products/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const ID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

class RepositorioEmMemoria implements ProdutoRepository {
  produtos: Produto[] = [];
  async listar() { return [...this.produtos]; }
  async buscarPorId(id: string) { return this.produtos.find((produto) => produto.id === id) ?? null; }
  async codigosReservados() { return this.produtos.map((produto) => produto.codigo); }
  async criar(dados: NovoProduto) {
    // Simula a constraint atômica: pode falhar mesmo após a consulta prévia.
    if (this.produtos.some((produto) => produto.codigo === dados.codigo)) {
      return traduzirErroGravacaoProduto({ sqlState: '23505', constraint: 'Produto_codigo_key' });
    }
    const id = `00000000-0000-4000-8000-${String(this.produtos.length + 1).padStart(12, '0')}`;
    const produto: Produto = { id, ...dados, ativo: true, createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' };
    this.produtos.push(produto);
    return produto;
  }
  async alterar(id: string, dados: AlteracaoProduto) {
    const indice = this.produtos.findIndex((produto) => produto.id === id);
    if (indice < 0) return null;
    this.produtos[indice] = { ...this.produtos[indice], ...dados, updatedAt: '2026-10-20T12:00:00Z' };
    return this.produtos[indice];
  }
  async definirAtivo(id: string, ativo: boolean) {
    const produto = this.produtos.find((item) => item.id === id);
    if (!produto) return null;
    Object.assign(produto, { ativo, updatedAt: '2026-10-21T12:00:00Z' });
    return produto;
  }
}

const pedido = (method: 'POST' | 'PATCH', corpo: unknown) => new Request('http://localhost/api/produtos', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const erroCom = (codigo: ErroDeProduto['codigo'], mensagem?: RegExp) => (erro: unknown) =>
  erro instanceof ErroDeProduto && erro.codigo === codigo && (!mensagem || mensagem.test(erro.message));

test('produto: cria removendo só espaços externos e preservando a caixa', async () => {
  const service = new ProdutosService(new RepositorioEmMemoria());
  const produto = await service.criar({ nome: '  Produto  A  ' });
  assert.deepEqual([produto.codigo, produto.nome], ['PRD-0001', 'Produto  A']);
  assert.deepEqual(Object.keys(produto).sort(), ['ativo', 'codigo', 'createdAt', 'id', 'nome', 'updatedAt']);
  assert.equal(produto.ativo, true);
  await service.criar({ nome: 'Produto A' });
  assert.equal((await service.listar()).length, 2);
});

test('produto: nome é obrigatório e código manual é recusado', async () => {
  const service = new ProdutosService(new RepositorioEmMemoria());
  for (const dados of [{ codigo: '', nome: 'Produto' }, { nome: '  ' }, { codigo: 1, nome: 'Produto' }, {}]) {
    await assert.rejects(() => service.criar(dados as CadastroProduto), erroCom('ENTRADA_INVALIDA'));
  }
});

test('produto: criações simultâneas recebem códigos distintos após colisão', async () => {
  const service = new ProdutosService(new RepositorioEmMemoria());
  const produtos = await Promise.all([service.criar({ nome: 'Produto A' }), service.criar({ nome: 'Produto B' })]);
  assert.deepEqual(produtos.map((p) => p.codigo).sort(), ['PRD-0001', 'PRD-0002']);
});

test('produto: edição mantém o código permanente e os timestamps de criação', async () => {
  const service = new ProdutosService(new RepositorioEmMemoria());
  const criado = await service.criar({ nome: 'Produto A' });
  const nome = await service.alterar(criado.id, { nome: ' Produto A revisado ' });
  assert.deepEqual([nome.codigo, nome.nome, nome.createdAt], ['PRD-0001', 'Produto A revisado', criado.createdAt]);
  assert.notEqual(nome.updatedAt, criado.updatedAt);
  await assert.rejects(() => service.alterar(criado.id, { codigo: criado.codigo } as unknown as AlteracaoProduto), erroCom('ENTRADA_INVALIDA'));
});

test('produto: alteração recusa código manual, campos vazios e produto inexistente', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new ProdutosService(repositorio);
  const a = await service.criar({ nome: 'Produto A' });
  await service.criar({ nome: 'Produto B' });
  await assert.rejects(() => service.alterar(a.id, { codigo: 'PRD-0002' } as unknown as AlteracaoProduto), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(a.id, {}), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(a.id, { nome: ' ' }), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(ID_INEXISTENTE, { nome: 'X' }), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.alterar('produto-1', { nome: 'X' }), erroCom('NAO_ENCONTRADO'));
  assert.deepEqual(repositorio.produtos.map((p) => [p.codigo, p.nome]), [['PRD-0001', 'Produto A'], ['PRD-0002', 'Produto B']]);
});

test('produto: traduz a violação de código único, inclusive na cadeia cause', () => {
  assert.throws(() => traduzirErroGravacaoProduto({ sqlState: '23505', constraint: 'Produto_codigo_key' }), erroCom('CONFLITO'));
  assert.throws(() => traduzirErroGravacaoProduto({ message: 'falha', cause: { code: '23505', constraint: 'Produto_codigo_key' } }), erroCom('CONFLITO'));
  const outro = { code: '23505', constraint: 'Outra_key' };
  assert.throws(() => traduzirErroGravacaoProduto(outro), (erro: unknown) => erro === outro);
});

test('produto: handlers listam, criam com 201, alteram com 200 e respondem 400 e 404', async () => {
  const handlers = criarHandlersProdutos({ autorizar: async () => ({ id: 'admin' }), produtos: new ProdutosService(new RepositorioEmMemoria()) });
  const criado = await handlers.POST(pedido('POST', { nome: 'Produto A' }));
  assert.equal(criado.status, 201);
  const { id } = await criado.json();
  assert.equal((await handlers.POST(pedido('POST', { codigo: 'PRD-001', nome: 'Outro' }))).status, 400);
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
  const { id } = await service.criar({ nome: 'Produto A' });
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
  assert.deepEqual(repositorio.produtos.map((p) => [p.codigo, p.nome]), [['PRD-0001', 'Produto A']]);
});

test('produto: sem sessão ou sem ADMIN ativo não lê nem grava', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403]] as const) {
    const repositorio = new RepositorioEmMemoria();
    const service = new ProdutosService(repositorio);
    const { id } = await service.criar({ nome: 'Produto A' });
    const handlers = criarHandlersProdutos({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, produtos: service });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(pedido('POST', { codigo: 'P2', nome: 'Produto' }))).status, status);
    assert.equal((await handlers.PATCH(pedido('PATCH', { nome: 'Outro' }), id)).status, status);
    assert.deepEqual(repositorio.produtos.map((p) => [p.codigo, p.nome]), [['PRD-0001', 'Produto A']]);
  }
});

test('produto: falha inesperada responde 500 sem detalhes internos', async () => {
  const falha = async () => { throw new Error('connect ECONNREFUSED'); };
  const handlers = criarHandlersProdutos({ autorizar: async () => ({}), produtos: { listar: falha, criar: falha, alterar: falha, definirStatus: falha } });
  const resposta = await handlers.GET();
  assert.equal(resposta.status, 500);
  assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
});

test('produto: busca por código ou nome ignora caixa e acentos e ordena sem alterar a entrada', () => {
  const base = (id: string, codigo: string, nome: string, createdAt: string, updatedAt = createdAt, ativo = true): Produto => ({ id, codigo, nome, ativo, createdAt, updatedAt });
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

test('produto: inativa e reativa sem alterar os outros dados; handler valida o corpo', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new ProdutosService(repositorio);
  const criado = await service.criar({ nome: 'Produto A' });
  const inativo = await service.definirStatus(criado.id, false);
  assert.deepEqual([inativo.ativo, inativo.codigo, inativo.nome], [false, 'PRD-0001', 'Produto A']);
  assert.equal((await service.definirStatus(criado.id, true)).ativo, true);
  await assert.rejects(() => service.definirStatus(ID_INEXISTENTE, false), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.definirStatus('produto-1', false), erroCom('NAO_ENCONTRADO'));
  const handlers = criarHandlersProdutos({ autorizar: async () => ({}), produtos: service });
  const resposta = await handlers.PATCH_STATUS(pedido('PATCH', { ativo: false }), criado.id);
  assert.equal(resposta.status, 200);
  assert.equal((await resposta.json()).ativo, false);
  for (const corpo of [{}, { ativo: 'false' }, { ativo: true, nome: 'X' }, []]) assert.equal((await handlers.PATCH_STATUS(pedido('PATCH', corpo), criado.id)).status, 400);
  assert.equal((await handlers.PATCH_STATUS(pedido('PATCH', { ativo: true }), ID_INEXISTENTE)).status, 404);
  // ativo não entra pela rota de edição.
  assert.equal((await handlers.PATCH(pedido('PATCH', { ativo: true }), criado.id)).status, 400);
  const negado = criarHandlersProdutos({ autorizar: async () => { throw new ErroDeAcesso('SEM_AUTORIZACAO', 'Acesso negado.'); }, produtos: service });
  assert.equal((await negado.PATCH_STATUS(pedido('PATCH', { ativo: true }), criado.id)).status, 403);
  assert.equal(repositorio.produtos[0].ativo, false);
});

test('produto: filtro de status e ordenação por status', () => {
  const base = (id: string, codigo: string, ativo: boolean): Produto => ({ id, codigo, nome: codigo, ativo, createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' });
  const produtos = [base('1', 'PRD-002', false), base('2', 'PRD-001', true), base('3', 'PRD-003', true)];
  const ordem = { coluna: 'codigo', direcao: 'asc' } as const;
  assert.deepEqual(filtrarOrdenarProdutos(produtos, '', ordem, 'ativos').map((p) => p.codigo), ['PRD-001', 'PRD-003']);
  assert.deepEqual(filtrarOrdenarProdutos(produtos, '', ordem, 'inativos').map((p) => p.codigo), ['PRD-002']);
  assert.deepEqual(filtrarOrdenarProdutos(produtos, '', ordem).map((p) => p.codigo), ['PRD-001', 'PRD-002', 'PRD-003']);
  assert.deepEqual(filtrarOrdenarProdutos(produtos, '', { coluna: 'ativo', direcao: 'asc' }).map((p) => p.codigo), ['PRD-001', 'PRD-003', 'PRD-002']);
});

test('produto: sequência considera legados e inativos e preserva códigos após edição', async () => {
  assert.equal(gerarCodigoProduto([]), 'PRD-0001');
  assert.equal(gerarCodigoProduto(['PRD-001', 'PRD-0120', 'SKU-999']), 'PRD-0121');
  assert.equal(gerarCodigoProduto(['PRD-9999']), 'PRD-10000');
  assert.equal(gerarCodigoProduto(['PRD-9007199254740993']), 'PRD-9007199254740994');
  const repositorio = new RepositorioEmMemoria();
  const legado = await repositorio.criar({ codigo: 'PRD-0120', nome: 'Legado' });
  await repositorio.definirAtivo(legado.id, false);
  const service = new ProdutosService(repositorio);
  assert.equal((await service.criar({ nome: 'Novo' })).codigo, 'PRD-0121');
  assert.equal((await service.alterar(legado.id, { nome: 'Renomeado' })).codigo, 'PRD-0120');
});

test('produto: dez colisões retornam 409 e erros diferentes não repetem a gravação', async () => {
  const repositorio = new RepositorioEmMemoria();
  let tentativas = 0;
  repositorio.criar = async () => { tentativas++; throw new ErroCodigoProdutoReservado(); };
  const service = new ProdutosService(repositorio);
  const handlers = criarHandlersProdutos({ autorizar: async () => ({}), produtos: service });
  assert.equal((await handlers.POST(pedido('POST', { nome: 'Novo' }))).status, 409);
  assert.equal(tentativas, 10);
  const falha = new Error('Falha de infraestrutura');
  tentativas = 0;
  repositorio.criar = async () => { tentativas++; throw falha; };
  await assert.rejects(() => service.criar({ nome: 'Novo' }), (erro) => erro === falha);
  assert.equal(tentativas, 1);
});

test('produto: API recusa código igual ou nulo no cadastro e edição sem alterar o registro', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new ProdutosService(repositorio);
  const criado = await service.criar({ nome: 'Produto' });
  const antes = structuredClone(criado);
  const handlers = criarHandlersProdutos({ autorizar: async () => ({}), produtos: service });
  for (const codigo of [criado.codigo, null]) {
    const corpo = { ...{ nome: 'Produto' }, codigo };
    assert.equal((await handlers.POST(pedido('POST', corpo))).status, 400);
    const edicao = { ...{ nome: 'Produto' }, codigo, nome: 'Novo nome' };
    assert.equal((await handlers.PATCH(pedido('PATCH', edicao), criado.id)).status, 400);
  }
  assert.deepEqual(await service.listar(), [antes]);
});
