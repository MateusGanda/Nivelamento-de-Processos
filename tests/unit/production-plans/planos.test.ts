import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanosService } from '../../../modules/production-plans/application/planos.ts';
import type { PlanoRepository } from '../../../modules/production-plans/application/contracts.ts';
import { ErroDePlano, type AlteracaoPlano, type DadosPlano, type Plano } from '../../../modules/production-plans/domain/plano.ts';
import { traduzirErroGravacaoPlano } from '../../../modules/production-plans/infrastructure/persistence-errors.ts';
import { criarHandlersPlanos } from '../../../modules/production-plans/presentation/http.ts';
import { filtrarOrdenarPlanos, formatarData } from '../../../modules/production-plans/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const ID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

class RepositorioEmMemoria implements PlanoRepository {
  planos: Plano[] = [];
  async listar() { return [...this.planos]; }
  async buscarPorId(id: string) { return this.planos.find((plano) => plano.id === id) ?? null; }
  async buscarPorCodigo(codigo: string) { return this.planos.find((plano) => plano.codigo === codigo) ?? null; }
  async criar(dados: DadosPlano) {
    // Simula a constraint atômica: pode falhar mesmo após a consulta prévia.
    if (this.planos.some((plano) => plano.codigo === dados.codigo)) {
      return traduzirErroGravacaoPlano({ sqlState: '23505', constraint: 'PlanoProducao_codigo_key' });
    }
    const id = `00000000-0000-4000-8000-${String(this.planos.length + 1).padStart(12, '0')}`;
    const plano: Plano = { id, ...dados, quantidadeOrdens: 0, createdAt: '2026-10-22T12:00:00Z', updatedAt: '2026-10-22T12:00:00Z' };
    this.planos.push(plano);
    return plano;
  }
  async alterar(id: string, dados: AlteracaoPlano) {
    const plano = this.planos.find((item) => item.id === id);
    if (!plano) return null;
    Object.assign(plano, dados, { updatedAt: '2026-10-23T12:00:00Z' });
    return plano;
  }
}

const pedido = (method: 'POST' | 'PATCH', corpo: unknown) => new Request('http://localhost/api/planos-de-producao', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const erroCom = (codigo: ErroDePlano['codigo'], mensagem?: RegExp) => (erro: unknown) =>
  erro instanceof ErroDePlano && erro.codigo === codigo && (!mensagem || mensagem.test(erro.message));

test('plano: cria com código e período, removendo espaços externos; descrição e datas vazias viram nulas', async () => {
  const service = new PlanosService(new RepositorioEmMemoria());
  const plano = await service.criar({ codigo: '  PL-2026-11 ', descricao: '  Novembro  ', dataInicio: '2026-11-02', dataFim: '2026-11-27' });
  assert.deepEqual([plano.codigo, plano.descricao, plano.dataInicio, plano.dataFim, plano.quantidadeOrdens], ['PL-2026-11', 'Novembro', '2026-11-02', '2026-11-27', 0]);
  const simples = await service.criar({ codigo: 'PL-X', descricao: '   ', dataInicio: '', dataFim: null });
  assert.deepEqual([simples.descricao, simples.dataInicio, simples.dataFim], [null, null, null]);
  assert.deepEqual(Object.keys(plano).sort(), ['codigo', 'createdAt', 'dataFim', 'dataInicio', 'descricao', 'id', 'quantidadeOrdens', 'updatedAt']);
  // Mesmo dia de início e fim é permitido.
  assert.equal((await service.criar({ codigo: 'PL-DIA', dataInicio: '2026-11-02', dataFim: '2026-11-02' })).dataFim, '2026-11-02');
});

test('plano: recusa código vazio, datas fora do formato ou inexistentes e fim antes do início', async () => {
  const service = new PlanosService(new RepositorioEmMemoria());
  for (const [dados, mensagem] of [
    [{ codigo: '  ' }, /Código/],
    [{ codigo: 1 }, /Código/],
    [{ codigo: 'P', dataInicio: '02/11/2026' }, /AAAA-MM-DD/],
    [{ codigo: 'P', dataFim: '2026-11-2' }, /AAAA-MM-DD/],
    [{ codigo: 'P', dataInicio: '2026-02-30' }, /não é uma data válida/],
    [{ codigo: 'P', dataInicio: '2026-13-01' }, /não é uma data válida/],
    [{ codigo: 'P', dataInicio: '2026-11-10', dataFim: '2026-11-09' }, /anterior/],
    [{ codigo: 'P', descricao: 5 }, /Descrição/],
  ] as const) {
    await assert.rejects(() => service.criar(dados as never), erroCom('ENTRADA_INVALIDA', mensagem));
  }
});

test('plano: código repetido gera conflito, inclusive em criações simultâneas', async () => {
  const service = new PlanosService(new RepositorioEmMemoria());
  await service.criar({ codigo: 'PL-1' });
  await assert.rejects(() => service.criar({ codigo: ' PL-1 ' }), erroCom('CONFLITO'));
  const paralelo = new PlanosService(new RepositorioEmMemoria());
  const resultados = await Promise.allSettled([paralelo.criar({ codigo: 'PL-2' }), paralelo.criar({ codigo: 'PL-2' })]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  assert.throws(() => traduzirErroGravacaoPlano({ cause: { code: '23505', constraint: 'PlanoProducao_codigo_key' } }), erroCom('CONFLITO'));
  const outro = { code: '23505', constraint: 'Outra_key' };
  assert.throws(() => traduzirErroGravacaoPlano(outro), (erro: unknown) => erro === outro);
});

test('plano: altera só os campos enviados e confere o período com a data já gravada', async () => {
  const service = new PlanosService(new RepositorioEmMemoria());
  const plano = await service.criar({ codigo: 'PL-1', dataInicio: '2026-11-02', dataFim: '2026-11-27' });
  await assert.rejects(() => service.alterar(plano.id, { dataFim: '2026-11-01' }), erroCom('ENTRADA_INVALIDA', /anterior/));
  await assert.rejects(() => service.alterar(plano.id, { dataInicio: '2026-12-01' }), erroCom('ENTRADA_INVALIDA', /anterior/));
  const novoFim = await service.alterar(plano.id, { dataFim: '2026-11-30', descricao: 'Novembro' });
  assert.deepEqual([novoFim.codigo, novoFim.dataInicio, novoFim.dataFim, novoFim.descricao], ['PL-1', '2026-11-02', '2026-11-30', 'Novembro']);
  // Tirar a data de início libera qualquer fim.
  assert.equal((await service.alterar(plano.id, { dataInicio: null })).dataInicio, null);
  assert.equal((await service.alterar(plano.id, { codigo: 'PL-1' })).codigo, 'PL-1');
  await service.criar({ codigo: 'PL-2' });
  await assert.rejects(() => service.alterar(plano.id, { codigo: 'PL-2' }), erroCom('CONFLITO'));
  await assert.rejects(() => service.alterar(plano.id, {}), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.alterar(ID_INEXISTENTE, { descricao: 'X' }), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.alterar('plano-1', { descricao: 'X' }), erroCom('NAO_ENCONTRADO'));
});

test('plano: handlers listam, criam com 201, alteram com 200 e validam o corpo', async () => {
  const repositorio = new RepositorioEmMemoria();
  const handlers = criarHandlersPlanos({ autorizar: async () => ({}), planos: new PlanosService(repositorio) });
  const criado = await handlers.POST(pedido('POST', { codigo: 'PL-1', descricao: null, dataInicio: '2026-11-02', dataFim: null }));
  assert.equal(criado.status, 201);
  const { id } = await criado.json();
  assert.equal((await handlers.POST(pedido('POST', { codigo: 'PL-1' }))).status, 409);
  for (const corpo of [{}, { codigo: 'P', ordens: [] }, { codigo: 'P', dataInicio: 20261102 }, []]) assert.equal((await handlers.POST(pedido('POST', corpo))).status, 400);
  const alterado = await handlers.PATCH(pedido('PATCH', { dataFim: '2026-11-27' }), id);
  assert.equal(alterado.status, 200);
  assert.equal((await alterado.json()).dataFim, '2026-11-27');
  assert.equal((await handlers.PATCH(pedido('PATCH', { quantidadeOrdens: 5 }), id)).status, 400);
  assert.equal((await handlers.PATCH(pedido('PATCH', { descricao: 'X' }), ID_INEXISTENTE)).status, 404);
  const lista = await handlers.GET();
  assert.equal(lista.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await lista.json()).map((p: Plano) => p.codigo), ['PL-1']);
});

test('plano: sem sessão ou sem ADMIN ativo não lê nem grava, e falha inesperada responde 500', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403]] as const) {
    const repositorio = new RepositorioEmMemoria();
    const service = new PlanosService(repositorio);
    const { id } = await service.criar({ codigo: 'PL-1' });
    const handlers = criarHandlersPlanos({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, planos: service });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(pedido('POST', { codigo: 'PL-2' }))).status, status);
    assert.equal((await handlers.PATCH(pedido('PATCH', { descricao: 'X' }), id)).status, status);
    assert.deepEqual(repositorio.planos.map((p) => [p.codigo, p.descricao]), [['PL-1', null]]);
  }
  const falha = async () => { throw new Error('connect ECONNREFUSED'); };
  const resposta = await criarHandlersPlanos({ autorizar: async () => ({}), planos: { listar: falha, criar: falha, alterar: falha } }).GET();
  assert.equal(resposta.status, 500);
  assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
});

test('plano: busca ignora caixa e acentos; ordena por data com os sem data por último', () => {
  const base = (id: string, codigo: string, descricao: string | null, dataInicio: string | null, quantidadeOrdens = 0): Plano =>
    ({ id, codigo, descricao, dataInicio, dataFim: null, quantidadeOrdens, createdAt: '2026-10-22T12:00:00Z', updatedAt: '2026-10-22T12:00:00Z' });
  const planos = [base('1', 'PL-B', 'Produção de verão', '2026-12-01', 3), base('2', 'PL-A', null, null), base('3', 'PL-C', 'Inverno', '2026-06-01', 1)];
  const copia = structuredClone(planos);
  assert.deepEqual(filtrarOrdenarPlanos(planos, 'VERAO', { coluna: 'codigo', direcao: 'asc' }).map((p) => p.codigo), ['PL-B']);
  assert.deepEqual(filtrarOrdenarPlanos(planos, '', { coluna: 'dataInicio', direcao: 'asc' }).map((p) => p.codigo), ['PL-C', 'PL-B', 'PL-A']);
  assert.deepEqual(filtrarOrdenarPlanos(planos, '', { coluna: 'quantidadeOrdens', direcao: 'desc' }).map((p) => p.codigo), ['PL-B', 'PL-C', 'PL-A']);
  assert.deepEqual(planos, copia);
  assert.equal(formatarData('2026-11-02'), '02/11/2026');
  assert.equal(formatarData(null), '—');
});
