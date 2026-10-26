import test from 'node:test';
import assert from 'node:assert/strict';
import { MotivosPausaService } from '../../../modules/pause-reasons/application/motivos-pausa.ts';
import type { MotivoPausaRepository } from '../../../modules/pause-reasons/application/contracts.ts';
import { ErroDeMotivoPausa, type AlteracaoMotivoPausa, type CadastroMotivoPausa, type DadosMotivoPausa, type MotivoPausa } from '../../../modules/pause-reasons/domain/motivoPausa.ts';
import { traduzirErroGravacaoMotivoPausa } from '../../../modules/pause-reasons/infrastructure/persistence-errors.ts';
import { criarHandlersMotivosPausa } from '../../../modules/pause-reasons/presentation/http.ts';
import { filtrarOrdenarMotivosPausa, formatarDataCadastro } from '../../../modules/pause-reasons/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const ID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

class RepositorioEmMemoria implements MotivoPausaRepository {
  motivos: MotivoPausa[] = [];
  leituras = 0;
  escritas = 0;
  async listar() { this.leituras++; return [...this.motivos]; }
  async buscarPorId(id: string) { this.leituras++; return this.motivos.find((motivo) => motivo.id === id) ?? null; }
  async buscarPorNome(nome: string) { this.leituras++; return this.motivos.find((motivo) => motivo.nome === nome) ?? null; }
  async criar(dados: DadosMotivoPausa) {
    if (this.motivos.some((motivo) => motivo.nome === dados.nome)) {
      return traduzirErroGravacaoMotivoPausa({ sqlState: '23505', constraint: 'MotivoPausa_nome_key' });
    }
    const id = `00000000-0000-4000-8000-${String(this.motivos.length + 1).padStart(12, '0')}`;
    const motivo: MotivoPausa = { id, ...dados, ativo: true, createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' };
    this.escritas++;
    this.motivos.push(motivo);
    return motivo;
  }
  async alterar(id: string, dados: AlteracaoMotivoPausa) {
    const indice = this.motivos.findIndex((motivo) => motivo.id === id);
    if (indice < 0) return null;
    if (dados.nome !== undefined && this.motivos.some((motivo) => motivo.id !== id && motivo.nome === dados.nome)) {
      return traduzirErroGravacaoMotivoPausa({ sqlState: '23505', constraint: 'MotivoPausa_nome_key' });
    }
    this.escritas++;
    this.motivos[indice] = { ...this.motivos[indice], ...dados, updatedAt: '2026-10-20T12:00:00Z' };
    return this.motivos[indice];
  }
  async definirAtivo(id: string, ativo: boolean) {
    const motivo = this.motivos.find((item) => item.id === id);
    if (!motivo) return null;
    this.escritas++;
    Object.assign(motivo, { ativo, updatedAt: '2026-10-21T12:00:00Z' });
    return motivo;
  }
}

const pedido = (method: 'POST' | 'PATCH', corpo: unknown) => new Request('http://localhost/api/motivos-de-pausa', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const erroCom = (codigo: ErroDeMotivoPausa['codigo']) => (erro: unknown) => erro instanceof ErroDeMotivoPausa && erro.codigo === codigo;

test('motivo de pausa: trim preserva caixa, acentos e espaços internos, sem acrescentar campos', async () => {
  const service = new MotivosPausaService(new RepositorioEmMemoria());
  const motivo = await service.criar({ nome: '  Corte  a laser  ', descricao: '  Preparação  das peças  ' });
  assert.deepEqual([motivo.nome, motivo.descricao], ['Corte  a laser', 'Preparação  das peças']);
  assert.deepEqual(Object.keys(motivo).sort(), ['ativo', 'createdAt', 'descricao', 'id', 'nome', 'updatedAt']);
  await service.criar({ nome: 'corte  a laser' });
  await service.criar({ nome: 'Corte a laser' });
  assert.equal((await service.listar()).length, 3);
});

test('motivo de pausa: descrição ausente, nula ou vazia vira null', async () => {
  const service = new MotivosPausaService(new RepositorioEmMemoria());
  for (const [indice, descricao] of [undefined, null, '', '  '].entries()) {
    assert.equal((await service.criar({ nome: `Motivo ${indice}`, descricao })).descricao, null);
  }
});

test('motivo de pausa: rejeita nome vazio e tipos incorretos no domínio', async () => {
  const service = new MotivosPausaService(new RepositorioEmMemoria());
  for (const dados of [{ nome: '' }, { nome: '  ' }, { nome: null }, { nome: 1 }, {}, { nome: 'Corte', descricao: 1 }]) {
    await assert.rejects(() => service.criar(dados as CadastroMotivoPausa), erroCom('ENTRADA_INVALIDA'));
  }
});

test('motivo de pausa: nome repetido gera conflito, inclusive em criações simultâneas', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new MotivosPausaService(repo);
  await service.criar({ nome: 'Corte' });
  await assert.rejects(() => service.criar({ nome: ' Corte ' }), erroCom('CONFLITO'));
  const resultados = await Promise.allSettled([service.criar({ nome: 'Montagem' }), service.criar({ nome: 'Montagem' })]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  const falha = resultados.find((r) => r.status === 'rejected');
  assert.ok(falha?.status === 'rejected' && erroCom('CONFLITO')(falha.reason));
  assert.equal(repo.escritas, 2);
});

test('motivo de pausa: edição parcial mantém id e criação, e permite o próprio nome', async () => {
  const service = new MotivosPausaService(new RepositorioEmMemoria());
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

test('motivo de pausa: edição rejeita nome reservado, vazio, entrada vazia e id inexistente', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new MotivosPausaService(repo);
  const { id } = await service.criar({ nome: 'Corte' });
  await service.criar({ nome: 'Montagem' });
  await assert.rejects(() => service.alterar(id, { nome: 'Montagem' }), erroCom('CONFLITO'));
  for (const dados of [{}, { nome: ' ' }, { nome: null }, { descricao: 2 }]) {
    await assert.rejects(() => service.alterar(id, dados as AlteracaoMotivoPausa), erroCom('ENTRADA_INVALIDA'));
  }
  for (const idAusente of [ID_INEXISTENTE, 'nao-e-uuid']) {
    await assert.rejects(() => service.alterar(idAusente, { nome: 'Outro' }), erroCom('NAO_ENCONTRADO'));
  }
  assert.equal(repo.escritas, 2);
});

test('motivo de pausa: exclusão concorrente entre consulta e edição retorna não encontrado', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new MotivosPausaService(repo);
  const { id } = await service.criar({ nome: 'Corte' });
  repo.alterar = async () => null;
  await assert.rejects(() => service.alterar(id, { descricao: 'Revisada' }), erroCom('NAO_ENCONTRADO'));
});

test('motivo de pausa: duas edições concorrentes não reservam o mesmo nome', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new MotivosPausaService(repo);
  const a = await service.criar({ nome: 'Corte' });
  const b = await service.criar({ nome: 'Montagem' });
  const resultados = await Promise.allSettled([service.alterar(a.id, { nome: 'Inspeção' }), service.alterar(b.id, { nome: 'Inspeção' })]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(repo.motivos.filter((o) => o.nome === 'Inspeção').length, 1);
});

test('motivo de pausa: traduz somente a constraint conhecida, inclusive cause e ciclos', () => {
  for (const erro of [
    { sqlState: '23505', constraint: 'MotivoPausa_nome_key' },
    { cause: { code: '23505', constraint: 'MotivoPausa_nome_key' } },
  ]) assert.throws(() => traduzirErroGravacaoMotivoPausa(erro), erroCom('CONFLITO'));
  const ciclo: { cause?: unknown } = {};
  ciclo.cause = ciclo;
  for (const outro of [ciclo, { code: '23505', constraint: 'Outra_key' }, { sqlState: '23503', constraint: 'MotivoPausa_nome_key' }]) {
    assert.throws(() => traduzirErroGravacaoMotivoPausa(outro), (erro: unknown) => erro === outro);
  }
});

test('motivo de pausa: handlers retornam GET 200 sem cache, POST 201, PATCH 200, conflito 409 e 404', async () => {
  const handlers = criarHandlersMotivosPausa({ autorizar: async () => ({}), motivosPausa: new MotivosPausaService(new RepositorioEmMemoria()) });
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
  assert.deepEqual((await lista.json()).map((o: MotivoPausa) => o.nome), ['Corte']);
});

test('motivo de pausa: JSON inválido, campos proibidos, tipos e nome vazio não gravam', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new MotivosPausaService(repo);
  const { id } = await service.criar({ nome: 'Corte' });
  const handlers = criarHandlersMotivosPausa({ autorizar: async () => ({}), motivosPausa: service });
  for (const method of ['POST', 'PATCH'] as const) {
    const invalidos = [
      new Request('http://localhost/api/motivos-de-pausa', { method, body: '{' }),
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

test('motivo de pausa: autorização vem antes de parsing, leitura e escrita', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403], ['NAO_ENCONTRADO', 404]] as const) {
    const repo = new RepositorioEmMemoria();
    const handlers = criarHandlersMotivosPausa({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, motivosPausa: new MotivosPausaService(repo) });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(new Request('http://localhost/api/motivos-de-pausa', { method: 'POST', body: '{' }))).status, status);
    assert.equal((await handlers.PATCH(pedido('PATCH', { nome: 'Outro' }), ID_INEXISTENTE)).status, status);
    assert.equal(repo.leituras + repo.escritas, 0);
  }
});

test('motivo de pausa: falha na autorização ou no serviço responde 500 sem detalhes internos', async () => {
  const falha = async () => { throw new Error('detalhe-interno-do-banco'); };
  for (const autorizar of [falha, async () => ({})]) {
    const handlers = criarHandlersMotivosPausa({ autorizar, motivosPausa: { listar: falha, criar: falha, alterar: falha, definirStatus: falha } });
    for (const resposta of [await handlers.GET(), await handlers.POST(pedido('POST', { nome: 'Corte' })), await handlers.PATCH(pedido('PATCH', { nome: 'Corte' }), ID_INEXISTENTE)]) {
      assert.equal(resposta.status, 500);
      assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
    }
  }
});

test('motivo de pausa: busca ignora acentos/caixa, ordenação trata descrição nula e mantém entrada', () => {
  const base = (id: string, nome: string, descricao: string | null, createdAt: string, updatedAt = createdAt): MotivoPausa => ({ id, nome, descricao, ativo: true, createdAt, updatedAt });
  const motivos = [
    base('1', 'Inspeção', 'Revisão', '2026-10-19T12:00:00Z'),
    base('2', 'Corte', null, '2026-10-17T12:00:00Z', '2026-10-20T12:00:00Z'),
    base('3', 'Montagem', 'Peças', '2026-10-18T12:00:00Z'),
  ];
  const copia = structuredClone(motivos);
  const nomes = (busca: string, coluna: 'nome' | 'descricao' | 'createdAt' | 'updatedAt', direcao: 'asc' | 'desc' = 'asc') => filtrarOrdenarMotivosPausa(motivos, busca, { coluna, direcao }).map((o) => o.nome);
  assert.deepEqual(nomes(' INSPECAO ', 'nome'), ['Inspeção']);
  assert.deepEqual(nomes('pecas', 'nome'), ['Montagem']);
  assert.deepEqual(nomes('', 'nome'), ['Corte', 'Inspeção', 'Montagem']);
  assert.deepEqual(nomes('', 'nome', 'desc'), ['Montagem', 'Inspeção', 'Corte']);
  assert.deepEqual(nomes('', 'descricao'), ['Corte', 'Montagem', 'Inspeção']);
  assert.deepEqual(nomes('', 'createdAt'), ['Corte', 'Montagem', 'Inspeção']);
  assert.deepEqual(nomes('', 'updatedAt', 'desc'), ['Corte', 'Inspeção', 'Montagem']);
  assert.deepEqual(nomes('inexistente', 'nome'), []);
  assert.deepEqual(motivos, copia);
  assert.equal(formatarDataCadastro('2026-10-19T12:00:00Z'), '19/10/2026, 09:00');
});

test('motivo de pausa: inativa e reativa sem alterar os outros dados; handler valida o corpo', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new MotivosPausaService(repo);
  const criada = await service.criar({ nome: 'Corte', descricao: 'Corte das peças' });
  const inativa = await service.definirStatus(criada.id, false);
  assert.deepEqual([inativa.ativo, inativa.nome, inativa.descricao], [false, 'Corte', 'Corte das peças']);
  assert.equal((await service.definirStatus(criada.id, true)).ativo, true);
  await assert.rejects(() => service.definirStatus(ID_INEXISTENTE, false), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.definirStatus('corte', false), erroCom('NAO_ENCONTRADO'));
  const handlers = criarHandlersMotivosPausa({ autorizar: async () => ({}), motivosPausa: service });
  const resposta = await handlers.PATCH_STATUS(pedido('PATCH', { ativo: false }), criada.id);
  assert.equal(resposta.status, 200);
  assert.equal((await resposta.json()).ativo, false);
  for (const corpo of [{}, { ativo: 1 }, { ativo: true, nome: 'X' }, []]) assert.equal((await handlers.PATCH_STATUS(pedido('PATCH', corpo), criada.id)).status, 400);
  assert.equal((await handlers.PATCH_STATUS(pedido('PATCH', { ativo: true }), ID_INEXISTENTE)).status, 404);
  assert.equal((await handlers.PATCH(pedido('PATCH', { ativo: true }), criada.id)).status, 400);
  const negado = criarHandlersMotivosPausa({ autorizar: async () => { throw new ErroDeAcesso('NAO_AUTENTICADO', 'Acesso negado.'); }, motivosPausa: service });
  assert.equal((await negado.PATCH_STATUS(pedido('PATCH', { ativo: true }), criada.id)).status, 401);
  assert.equal(repo.motivos[0].ativo, false);
});

test('motivo de pausa: filtro de status e ordenação por status', () => {
  const base = (id: string, nome: string, ativo: boolean): MotivoPausa => ({ id, nome, descricao: null, ativo, createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' });
  const motivos = [base('1', 'Inspeção', false), base('2', 'Corte', true), base('3', 'Montagem', true)];
  const ordem = { coluna: 'nome', direcao: 'asc' } as const;
  assert.deepEqual(filtrarOrdenarMotivosPausa(motivos, '', ordem, 'ativos').map((o) => o.nome), ['Corte', 'Montagem']);
  assert.deepEqual(filtrarOrdenarMotivosPausa(motivos, '', ordem, 'inativos').map((o) => o.nome), ['Inspeção']);
  assert.deepEqual(filtrarOrdenarMotivosPausa(motivos, '', { coluna: 'ativo', direcao: 'desc' }).map((o) => o.nome), ['Inspeção', 'Montagem', 'Corte']);
});
