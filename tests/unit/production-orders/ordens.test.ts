import test from 'node:test';
import assert from 'node:assert/strict';
import { OrdensService } from '../../../modules/production-orders/application/ordens.ts';
import type { OrdemRepository } from '../../../modules/production-orders/application/contracts.ts';
import { ErroDeOrdem, sugerirNumeroOrdem, type AlteracaoOrdem, type CadastroOrdem, type Ordem } from '../../../modules/production-orders/domain/ordem.ts';
import { traduzirErroGravacaoOrdem } from '../../../modules/production-orders/infrastructure/persistence-errors.ts';
import { criarHandlersOrdens } from '../../../modules/production-orders/presentation/http.ts';
import { filtrarOrdenarOrdens, lerQuantidadeDigitada } from '../../../modules/production-orders/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PLANO = { id: uuid(1), codigo: 'PL-1' };
const PLANO2 = { id: uuid(2), codigo: 'PL-2' };
const PRD1 = { id: uuid(11), codigo: 'PRD-001', nome: 'Produto A', ativo: true };
const PRD9 = { id: uuid(19), codigo: 'PRD-009', nome: 'Produto antigo', ativo: false };
const V1 = { id: uuid(21), nome: 'Roteiro A', versao: 1, ativo: true, etapas: 3 };
const V2 = { id: uuid(22), nome: 'Roteiro A', versao: 2, ativo: true, etapas: 3 };
const VAZIO = { id: uuid(23), nome: 'Roteiro vazio', versao: 1, ativo: true, etapas: 0 };
const INATIVO = { id: uuid(24), nome: 'Roteiro velho', versao: 1, ativo: false, etapas: 2 };
const OUTRO = { id: uuid(25), nome: 'Roteiro B', versao: 1, ativo: true, etapas: 2 };
const INEXISTENTE = uuid(999);

class RepositorioEmMemoria implements OrdemRepository {
  ordens: Ordem[] = [];
  execucoes = new Map<string, number>();
  planos = [PLANO, PLANO2];
  produtos = [PRD1, PRD9];
  roteiros = [V1, V2, VAZIO, INATIVO, OUTRO];
  // Ligações produto → roteiro; OUTRO não está ligado ao PRD1.
  ligacoes = [{ produtoId: PRD1.id, roteiroId: V1.id }, { produtoId: PRD1.id, roteiroId: V2.id }, { produtoId: PRD1.id, roteiroId: VAZIO.id }, { produtoId: PRD1.id, roteiroId: INATIVO.id }];
  private comExecucoes(ordem: Ordem) { return { ...ordem, quantidadeExecucoes: this.execucoes.get(ordem.id) ?? 0 }; }
  async listar() { return this.ordens.map((o) => this.comExecucoes(o)); }
  async buscarPorId(id: string) { const ordem = this.ordens.find((o) => o.id === id); return ordem ? this.comExecucoes(ordem) : null; }
  async existeNumero(numero: string) { return this.ordens.some((o) => o.numero === numero); }
  async listarOpcoes() { return { produtos: [], planos: this.planos }; }
  async existePlano(id: string) { return this.planos.some((p) => p.id === id); }
  async buscarProduto(id: string) { return this.produtos.find((p) => p.id === id) ?? null; }
  async buscarRoteiro(roteiroId: string, produtoId: string) {
    const r = this.roteiros.find((item) => item.id === roteiroId);
    return r ? { id: r.id, ativo: r.ativo, quantidadeEtapas: r.etapas, ligadoAoProduto: this.ligacoes.some((l) => l.produtoId === produtoId && l.roteiroId === roteiroId) } : null;
  }
  async criar(dados: CadastroOrdem) {
    // Simula a constraint atômica: pode falhar mesmo após a consulta prévia.
    if (this.ordens.some((o) => o.numero === dados.numero)) return traduzirErroGravacaoOrdem({ sqlState: '23505', constraint: 'OrdemProducao_numero_key' });
    const produto = this.produtos.find((p) => p.id === dados.produtoId)!;
    const roteiro = this.roteiros.find((r) => r.id === dados.roteiroId)!;
    const ordem: Ordem = {
      id: uuid(100 + this.ordens.length), numero: dados.numero, quantidade: dados.quantidade, unidade: dados.unidade,
      plano: this.planos.find((p) => p.id === dados.planoId)!, produto: { id: produto.id, codigo: produto.codigo, nome: produto.nome },
      roteiro: { id: roteiro.id, nome: roteiro.nome, versao: roteiro.versao }, quantidadeExecucoes: 0, createdAt: '2026-10-25T12:00:00Z', updatedAt: '2026-10-25T12:00:00Z',
    };
    this.ordens.push(ordem);
    return ordem;
  }
  async alterar(id: string, dados: AlteracaoOrdem) {
    const ordem = this.ordens.find((o) => o.id === id);
    if (!ordem) return null;
    if (dados.numero !== undefined) ordem.numero = dados.numero;
    if (dados.planoId !== undefined) ordem.plano = this.planos.find((p) => p.id === dados.planoId)!;
    if (dados.quantidade !== undefined) ordem.quantidade = dados.quantidade;
    if (dados.unidade !== undefined) ordem.unidade = dados.unidade;
    ordem.updatedAt = '2026-10-26T12:00:00Z';
    return this.comExecucoes(ordem);
  }
}

const valida = (extra: Partial<CadastroOrdem> = {}): CadastroOrdem => ({ numero: 'OP-0001', planoId: PLANO.id, produtoId: PRD1.id, roteiroId: V1.id, quantidade: 40, unidade: 'un', ...extra });
const erroCom = (codigo: ErroDeOrdem['codigo'], mensagem?: RegExp) => (erro: unknown) =>
  erro instanceof ErroDeOrdem && erro.codigo === codigo && (!mensagem || mensagem.test(erro.message));
const pedido = (method: 'POST' | 'PATCH', corpo: unknown) => new Request('http://localhost/api/ordens-de-producao', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

test('ordem: cria com produto, versão do roteiro, plano e quantidade, removendo espaços externos', async () => {
  const service = new OrdensService(new RepositorioEmMemoria());
  const ordem = await service.criar(valida({ numero: '  OP-0001 ', unidade: ' pares ', quantidade: 12.5 }));
  assert.deepEqual([ordem.numero, ordem.unidade, ordem.quantidade, ordem.roteiro.versao, ordem.plano.codigo], ['OP-0001', 'pares', 12.5, 1, 'PL-1']);
  // Uma versão não vigente, mas ligada e ativa, também pode ser escolhida.
  assert.equal((await service.criar(valida({ numero: 'OP-0002', roteiroId: V2.id }))).roteiro.versao, 2);
});

test('ordem: valida produto, roteiro ligado, ativo e com etapas, plano e número', async () => {
  const service = new OrdensService(new RepositorioEmMemoria());
  await service.criar(valida());
  for (const [dados, codigo, mensagem] of [
    [valida({ numero: 'X', produtoId: PRD9.id }), 'ENTRADA_INVALIDA', /Produto inativo/],
    [valida({ numero: 'X', produtoId: INEXISTENTE }), 'ENTRADA_INVALIDA', /Produto não encontrado/],
    [valida({ numero: 'X', roteiroId: OUTRO.id }), 'ENTRADA_INVALIDA', /não está ligada ao produto/],
    [valida({ numero: 'X', roteiroId: INATIVO.id }), 'ENTRADA_INVALIDA', /Roteiro inativo/],
    [valida({ numero: 'X', roteiroId: VAZIO.id }), 'ENTRADA_INVALIDA', /não tem etapas/],
    [valida({ numero: 'X', roteiroId: INEXISTENTE }), 'ENTRADA_INVALIDA', /Roteiro não encontrado/],
    [valida({ numero: 'X', planoId: INEXISTENTE }), 'ENTRADA_INVALIDA', /Plano/],
    [valida({ numero: ' OP-0001 ' }), 'CONFLITO', /já cadastrado/],
  ] as const) {
    await assert.rejects(() => service.criar(dados), erroCom(codigo, mensagem));
  }
});

test('ordem: quantidade maior que zero com até duas casas, unidade e identificadores obrigatórios', async () => {
  const service = new OrdensService(new RepositorioEmMemoria());
  for (const dados of [
    valida({ quantidade: 0 }), valida({ quantidade: -1 }), valida({ quantidade: 1.234 }), valida({ quantidade: Number.NaN }),
    valida({ quantidade: '10' as never }), valida({ quantidade: 10_000_000_000 }), valida({ unidade: '  ' }), valida({ numero: '' }),
    valida({ planoId: 'plano' }), valida({ produtoId: '' }), valida({ roteiroId: 'v1' }),
  ]) {
    await assert.rejects(() => service.criar(dados), erroCom('ENTRADA_INVALIDA'));
  }
});

test('ordem: altera número e plano sempre; quantidade e unidade só sem execuções', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new OrdensService(repositorio);
  const ordem = await service.criar(valida());
  const antes = await service.alterar(ordem.id, { quantidade: 50, unidade: 'pares' });
  assert.deepEqual([antes.quantidade, antes.unidade], [50, 'pares']);
  repositorio.execucoes.set(ordem.id, 2);
  await assert.rejects(() => service.alterar(ordem.id, { quantidade: 60 }), erroCom('CONFLITO', /execuções/));
  await assert.rejects(() => service.alterar(ordem.id, { unidade: 'un' }), erroCom('CONFLITO', /execuções/));
  // Reenviar os mesmos valores não é mudança.
  const igual = await service.alterar(ordem.id, { quantidade: 50, unidade: 'pares', numero: 'OP-0100', planoId: PLANO2.id });
  assert.deepEqual([igual.numero, igual.plano.codigo, igual.quantidade, igual.roteiro.id], ['OP-0100', 'PL-2', 50, V1.id]);
  await service.criar(valida({ numero: 'OP-0200' }));
  await assert.rejects(() => service.alterar(ordem.id, { numero: 'OP-0200' }), erroCom('CONFLITO'));
  await assert.rejects(() => service.alterar(ordem.id, { planoId: INEXISTENTE }), erroCom('ENTRADA_INVALIDA', /Plano/));
  await assert.rejects(() => service.alterar(ordem.id, {}), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(INEXISTENTE, { numero: 'X' }), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.alterar('ordem-1', { numero: 'X' }), erroCom('NAO_ENCONTRADO'));
});

test('ordem: handlers respondem 201, 200, 400, 404 e 409; produto e roteiro não mudam na edição', async () => {
  const repositorio = new RepositorioEmMemoria();
  const handlers = criarHandlersOrdens({ autorizar: async () => ({}), ordens: new OrdensService(repositorio) });
  const criada = await handlers.POST(pedido('POST', valida()));
  assert.equal(criada.status, 201);
  const { id } = await criada.json();
  assert.equal((await handlers.POST(pedido('POST', valida()))).status, 409);
  assert.equal((await handlers.POST(pedido('POST', { ...valida({ numero: 'X' }), status: 'aberta' }))).status, 400);
  assert.equal((await handlers.PATCH(pedido('PATCH', { roteiroId: V2.id }), id)).status, 400);
  assert.equal((await handlers.PATCH(pedido('PATCH', { produtoId: PRD1.id }), id)).status, 400);
  const alterada = await handlers.PATCH(pedido('PATCH', { quantidade: 45 }), id);
  assert.equal(alterada.status, 200);
  assert.equal((await alterada.json()).quantidade, 45);
  assert.equal((await handlers.PATCH(pedido('PATCH', { numero: 'X' }), INEXISTENTE)).status, 404);
  repositorio.execucoes.set(id, 1);
  assert.equal((await handlers.PATCH(pedido('PATCH', { quantidade: 46 }), id)).status, 409);
  const lista = await handlers.GET();
  assert.equal(lista.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await lista.json()).map((o: Ordem) => [o.numero, o.quantidadeExecucoes]), [['OP-0001', 1]]);
});

test('ordem: sem sessão ou sem ADMIN ativo não lê nem grava, e falha inesperada responde 500', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403]] as const) {
    const repositorio = new RepositorioEmMemoria();
    const service = new OrdensService(repositorio);
    const { id } = await service.criar(valida());
    const handlers = criarHandlersOrdens({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, ordens: service });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(pedido('POST', valida({ numero: 'OP-0002' })))).status, status);
    assert.equal((await handlers.PATCH(pedido('PATCH', { quantidade: 1 }), id)).status, status);
    assert.deepEqual(repositorio.ordens.map((o) => [o.numero, o.quantidade]), [['OP-0001', 40]]);
  }
  const falha = async () => { throw new Error('connect ECONNREFUSED'); };
  const resposta = await criarHandlersOrdens({ autorizar: async () => ({}), ordens: { listar: falha, criar: falha, alterar: falha } }).GET();
  assert.equal(resposta.status, 500);
  assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
});

test('ordem: traduz número repetido e plano removido, inclusive na cadeia cause', () => {
  assert.throws(() => traduzirErroGravacaoOrdem({ cause: { code: '23505', constraint: 'OrdemProducao_numero_key' } }), erroCom('CONFLITO'));
  assert.throws(() => traduzirErroGravacaoOrdem({ code: '23503', constraint: 'OrdemProducao_planoProducaoId_fkey' }), erroCom('ENTRADA_INVALIDA', /Plano/));
  const outro = { code: '23505', constraint: 'Outra_key' };
  assert.throws(() => traduzirErroGravacaoOrdem(outro), (erro: unknown) => erro === outro);
});

test('ordem: sugestão de número, quantidade digitada e filtro por plano', () => {
  assert.equal(sugerirNumeroOrdem([]), 'OP-0001');
  assert.equal(sugerirNumeroOrdem(['OP-0006', 'OP-0002', 'FICHA-99', 'OP-12']), 'OP-0013');
  assert.equal(lerQuantidadeDigitada(' 12,5 '), 12.5);
  for (const texto of ['0', '-1', 'abc', '1,234', '']) assert.equal(lerQuantidadeDigitada(texto), undefined, texto);
  const base = (id: string, numero: string, plano: { id: string; codigo: string }, quantidade: number): Ordem => ({
    id, numero, quantidade, unidade: 'un', plano, produto: { id: PRD1.id, codigo: 'PRD-001', nome: 'Calçado' }, roteiro: { id: V1.id, nome: 'Roteiro A', versao: 1 },
    quantidadeExecucoes: 0, createdAt: '2026-10-25T12:00:00Z', updatedAt: '2026-10-25T12:00:00Z',
  });
  const ordens = [base('1', 'OP-0002', PLANO, 10), base('2', 'OP-0001', PLANO2, 30), base('3', 'OP-0003', PLANO, 20)];
  const copia = structuredClone(ordens);
  assert.deepEqual(filtrarOrdenarOrdens(ordens, '', PLANO.id, { coluna: 'numero', direcao: 'asc' }).map((o) => o.numero), ['OP-0002', 'OP-0003']);
  assert.deepEqual(filtrarOrdenarOrdens(ordens, 'calcado', '', { coluna: 'quantidade', direcao: 'desc' }).map((o) => o.numero), ['OP-0001', 'OP-0003', 'OP-0002']);
  assert.deepEqual(ordens, copia);
});
