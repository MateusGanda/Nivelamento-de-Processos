import test from 'node:test';
import assert from 'node:assert/strict';
import { OperacoesService } from '../../../modules/operations/application/operacoes.ts';
import type { OperacaoRepository } from '../../../modules/operations/application/contracts.ts';
import { ErroDeOperacao, type AlteracaoOperacao, type CadastroOperacao, type DadosOperacao, type Operacao } from '../../../modules/operations/domain/operacao.ts';
import { traduzirErroGravacaoOperacao } from '../../../modules/operations/infrastructure/persistence-errors.ts';
import { criarHandlersOperacoes } from '../../../modules/operations/presentation/http.ts';
import { filtrarOrdenarOperacoes, formatarDataCadastro } from '../../../modules/operations/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const ID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

class RepositorioEmMemoria implements OperacaoRepository {
  operacoes: Operacao[] = [];
  leituras = 0;
  escritas = 0;
  async listar() { this.leituras++; return [...this.operacoes]; }
  async buscarPorId(id: string) { this.leituras++; return this.operacoes.find((operacao) => operacao.id === id) ?? null; }
  async buscarPorNome(nome: string) { this.leituras++; return this.operacoes.find((operacao) => operacao.nome === nome) ?? null; }
  async criar(dados: DadosOperacao) {
    if (this.operacoes.some((operacao) => operacao.nome === dados.nome)) {
      return traduzirErroGravacaoOperacao({ sqlState: '23505', constraint: 'Operacao_nome_key' });
    }
    const id = `00000000-0000-4000-8000-${String(this.operacoes.length + 1).padStart(12, '0')}`;
    const operacao: Operacao = { id, ...dados, createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' };
    this.escritas++;
    this.operacoes.push(operacao);
    return operacao;
  }
  async alterar(id: string, dados: AlteracaoOperacao) {
    const indice = this.operacoes.findIndex((operacao) => operacao.id === id);
    if (indice < 0) return null;
    if (dados.nome !== undefined && this.operacoes.some((operacao) => operacao.id !== id && operacao.nome === dados.nome)) {
      return traduzirErroGravacaoOperacao({ sqlState: '23505', constraint: 'Operacao_nome_key' });
    }
    this.escritas++;
    this.operacoes[indice] = { ...this.operacoes[indice], ...dados, updatedAt: '2026-10-20T12:00:00Z' };
    return this.operacoes[indice];
  }
}

const pedido = (method: 'POST' | 'PATCH', corpo: unknown) => new Request('http://localhost/api/operacoes', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const erroCom = (codigo: ErroDeOperacao['codigo']) => (erro: unknown) => erro instanceof ErroDeOperacao && erro.codigo === codigo;

test('operação: trim preserva caixa, acentos e espaços internos, sem acrescentar campos', async () => {
  const service = new OperacoesService(new RepositorioEmMemoria());
  const operacao = await service.criar({ nome: '  Corte  a laser  ', descricao: '  Preparação  das peças  ' });
  assert.deepEqual([operacao.nome, operacao.descricao], ['Corte  a laser', 'Preparação  das peças']);
  assert.deepEqual(Object.keys(operacao).sort(), ['createdAt', 'descricao', 'id', 'nome', 'updatedAt']);
  await service.criar({ nome: 'corte  a laser' });
  await service.criar({ nome: 'Corte a laser' });
  assert.equal((await service.listar()).length, 3);
});

test('operação: descrição ausente, nula ou vazia vira null', async () => {
  const service = new OperacoesService(new RepositorioEmMemoria());
  for (const [indice, descricao] of [undefined, null, '', '  '].entries()) {
    assert.equal((await service.criar({ nome: `Operação ${indice}`, descricao })).descricao, null);
  }
});

test('operação: rejeita nome vazio e tipos incorretos no domínio', async () => {
  const service = new OperacoesService(new RepositorioEmMemoria());
  for (const dados of [{ nome: '' }, { nome: '  ' }, { nome: null }, { nome: 1 }, {}, { nome: 'Corte', descricao: 1 }]) {
    await assert.rejects(() => service.criar(dados as CadastroOperacao), erroCom('ENTRADA_INVALIDA'));
  }
});

test('operação: nome repetido gera conflito, inclusive em criações simultâneas', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperacoesService(repo);
  await service.criar({ nome: 'Corte' });
  await assert.rejects(() => service.criar({ nome: ' Corte ' }), erroCom('CONFLITO'));
  const resultados = await Promise.allSettled([service.criar({ nome: 'Montagem' }), service.criar({ nome: 'Montagem' })]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  const falha = resultados.find((r) => r.status === 'rejected');
  assert.ok(falha?.status === 'rejected' && erroCom('CONFLITO')(falha.reason));
  assert.equal(repo.escritas, 2);
});

test('operação: edição parcial mantém id e criação, e permite o próprio nome', async () => {
  const service = new OperacoesService(new RepositorioEmMemoria());
  const criada = await service.criar({ nome: 'Corte', descricao: 'Descrição' });
  const renomeada = await service.alterar(criada.id, { nome: ' Corte a laser ' });
  assert.deepEqual([renomeada.id, renomeada.nome, renomeada.descricao, renomeada.createdAt], [criada.id, 'Corte a laser', 'Descrição', criada.createdAt]);
  assert.notEqual(renomeada.updatedAt, criada.updatedAt);
  const mesma = await service.alterar(criada.id, { nome: 'Corte a laser', descricao: ' Revisada ' });
  assert.equal(mesma.descricao, 'Revisada');
  for (const descricao of [null, '', '  ']) {
    assert.equal((await service.alterar(criada.id, { descricao })).descricao, null);
  }
});

test('operação: edição rejeita nome reservado, vazio, entrada vazia e id inexistente', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperacoesService(repo);
  const { id } = await service.criar({ nome: 'Corte' });
  await service.criar({ nome: 'Montagem' });
  await assert.rejects(() => service.alterar(id, { nome: 'Montagem' }), erroCom('CONFLITO'));
  for (const dados of [{}, { nome: ' ' }, { nome: null }, { descricao: 2 }]) {
    await assert.rejects(() => service.alterar(id, dados as AlteracaoOperacao), erroCom('ENTRADA_INVALIDA'));
  }
  for (const idAusente of [ID_INEXISTENTE, 'nao-e-uuid']) {
    await assert.rejects(() => service.alterar(idAusente, { nome: 'Outro' }), erroCom('NAO_ENCONTRADO'));
  }
  assert.equal(repo.escritas, 2);
});

test('operação: exclusão concorrente entre consulta e edição retorna não encontrado', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperacoesService(repo);
  const { id } = await service.criar({ nome: 'Corte' });
  repo.alterar = async () => null;
  await assert.rejects(() => service.alterar(id, { descricao: 'Revisada' }), erroCom('NAO_ENCONTRADO'));
});

test('operação: duas edições concorrentes não reservam o mesmo nome', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperacoesService(repo);
  const a = await service.criar({ nome: 'Corte' });
  const b = await service.criar({ nome: 'Montagem' });
  const resultados = await Promise.allSettled([service.alterar(a.id, { nome: 'Inspeção' }), service.alterar(b.id, { nome: 'Inspeção' })]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(repo.operacoes.filter((o) => o.nome === 'Inspeção').length, 1);
});

test('operação: traduz somente a constraint conhecida, inclusive cause e ciclos', () => {
  for (const erro of [
    { sqlState: '23505', constraint: 'Operacao_nome_key' },
    { cause: { code: '23505', constraint: 'Operacao_nome_key' } },
  ]) assert.throws(() => traduzirErroGravacaoOperacao(erro), erroCom('CONFLITO'));
  const ciclo: { cause?: unknown } = {};
  ciclo.cause = ciclo;
  for (const outro of [ciclo, { code: '23505', constraint: 'Outra_key' }, { sqlState: '23503', constraint: 'Operacao_nome_key' }]) {
    assert.throws(() => traduzirErroGravacaoOperacao(outro), (erro: unknown) => erro === outro);
  }
});

test('operação: handlers retornam GET 200 sem cache, POST 201, PATCH 200, conflito 409 e 404', async () => {
  const handlers = criarHandlersOperacoes({ autorizar: async () => ({}), operacoes: new OperacoesService(new RepositorioEmMemoria()) });
  const criado = await handlers.POST(pedido('POST', { nome: 'Corte' }));
  assert.equal(criado.status, 201);
  const { id } = await criado.json();
  const conflito = await handlers.POST(pedido('POST', { nome: 'Corte' }));
  assert.equal(conflito.status, 409);
  assert.equal((await conflito.json()).erro.codigo, 'CONFLITO');
  const alterado = await handlers.PATCH(pedido('PATCH', { descricao: 'Revisada' }), id);
  assert.equal(alterado.status, 200);
  assert.equal((await alterado.json()).descricao, 'Revisada');
  assert.equal((await handlers.PATCH(pedido('PATCH', { nome: 'Outro' }), ID_INEXISTENTE)).status, 404);
  const lista = await handlers.GET();
  assert.equal(lista.status, 200);
  assert.equal(lista.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await lista.json()).map((o: Operacao) => o.nome), ['Corte']);
});

test('operação: JSON inválido, campos proibidos, tipos e nome vazio não gravam', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperacoesService(repo);
  const { id } = await service.criar({ nome: 'Corte' });
  const handlers = criarHandlersOperacoes({ autorizar: async () => ({}), operacoes: service });
  for (const method of ['POST', 'PATCH'] as const) {
    const invalidos = [
      new Request('http://localhost/api/operacoes', { method, body: '{' }),
      ...[null, [], 'texto', {}, { nome: ' ' }, { nome: null }, { nome: 2 }, { nome: 'Outro', ativo: true },
        { nome: 'Outro', codigo: 'OP-01' }, { nome: 'Outro', descricao: 1 }, { nome: 'Outro', tempoPadrao: 20 }].map((corpo) => pedido(method, corpo)),
    ];
    for (const req of invalidos) {
      const resposta = method === 'POST' ? await handlers.POST(req) : await handlers.PATCH(req, id);
      assert.equal(resposta.status, 400);
      assert.equal((await resposta.json()).erro.codigo, 'ENTRADA_INVALIDA');
    }
  }
  assert.equal((await handlers.POST(pedido('POST', { descricao: 'Sem nome' }))).status, 400);
  assert.equal(repo.escritas, 1);
});

test('operação: autorização vem antes de parsing, leitura e escrita', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403], ['NAO_ENCONTRADO', 404]] as const) {
    const repo = new RepositorioEmMemoria();
    const handlers = criarHandlersOperacoes({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, operacoes: new OperacoesService(repo) });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(new Request('http://localhost/api/operacoes', { method: 'POST', body: '{' }))).status, status);
    assert.equal((await handlers.PATCH(pedido('PATCH', { nome: 'Outro' }), ID_INEXISTENTE)).status, status);
    assert.equal(repo.leituras + repo.escritas, 0);
  }
});

test('operação: falha na autorização ou no serviço responde 500 sem detalhes internos', async () => {
  const falha = async () => { throw new Error('detalhe-interno-do-banco'); };
  for (const autorizar of [falha, async () => ({})]) {
    const handlers = criarHandlersOperacoes({ autorizar, operacoes: { listar: falha, criar: falha, alterar: falha } });
    for (const resposta of [await handlers.GET(), await handlers.POST(pedido('POST', { nome: 'Corte' })), await handlers.PATCH(pedido('PATCH', { nome: 'Corte' }), ID_INEXISTENTE)]) {
      assert.equal(resposta.status, 500);
      assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
    }
  }
});

test('operação: busca ignora acentos/caixa, ordenação trata descrição nula e mantém entrada', () => {
  const base = (id: string, nome: string, descricao: string | null, createdAt: string, updatedAt = createdAt): Operacao => ({ id, nome, descricao, createdAt, updatedAt });
  const operacoes = [
    base('1', 'Inspeção', 'Revisão', '2026-10-19T12:00:00Z'),
    base('2', 'Corte', null, '2026-10-17T12:00:00Z', '2026-10-20T12:00:00Z'),
    base('3', 'Montagem', 'Peças', '2026-10-18T12:00:00Z'),
  ];
  const copia = structuredClone(operacoes);
  const nomes = (busca: string, coluna: 'nome' | 'descricao' | 'createdAt' | 'updatedAt', direcao: 'asc' | 'desc' = 'asc') => filtrarOrdenarOperacoes(operacoes, busca, { coluna, direcao }).map((o) => o.nome);
  assert.deepEqual(nomes(' INSPECAO ', 'nome'), ['Inspeção']);
  assert.deepEqual(nomes('pecas', 'nome'), ['Montagem']);
  assert.deepEqual(nomes('', 'nome'), ['Corte', 'Inspeção', 'Montagem']);
  assert.deepEqual(nomes('', 'nome', 'desc'), ['Montagem', 'Inspeção', 'Corte']);
  assert.deepEqual(nomes('', 'descricao'), ['Corte', 'Montagem', 'Inspeção']);
  assert.deepEqual(nomes('', 'createdAt'), ['Corte', 'Montagem', 'Inspeção']);
  assert.deepEqual(nomes('', 'updatedAt', 'desc'), ['Corte', 'Inspeção', 'Montagem']);
  assert.deepEqual(nomes('inexistente', 'nome'), []);
  assert.deepEqual(operacoes, copia);
  assert.equal(formatarDataCadastro('2026-10-19T12:00:00Z'), '19/10/2026, 09:00');
});
