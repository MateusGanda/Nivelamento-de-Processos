import test from 'node:test';
import assert from 'node:assert/strict';
import { RoteirosService } from '../../../modules/routings/application/roteiros.ts';
import type { RoteiroRepository } from '../../../modules/routings/application/contracts.ts';
import { ErroDeRoteiro, type EtapaInformada, type RoteiroDetalhe } from '../../../modules/routings/domain/roteiro.ts';
import { traduzirErroGravacaoRoteiro } from '../../../modules/routings/infrastructure/persistence-errors.ts';
import { criarHandlersRoteiros } from '../../../modules/routings/presentation/http.ts';
import { etapasAlteradas, filtrarOrdenarRoteiros, moverEtapa, paraEdicao } from '../../../modules/routings/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CORTE = { id: uuid(901), nome: 'Corte' };
const MONTAGEM = { id: uuid(902), nome: 'Montagem' };
const INSPECAO = { id: uuid(903), nome: 'Inspeção' };
const PRE01 = { id: uuid(801), codigo: 'PRE-01', nome: 'Corte 1', ativo: true, setorNome: 'Preparação' };
const MON01 = { id: uuid(802), codigo: 'MON-01', nome: 'Montagem 1', ativo: true, setorNome: 'Montagem' };
const MON09 = { id: uuid(803), codigo: 'MON-09', nome: 'Montagem antiga', ativo: false, setorNome: 'Montagem' };
const INEXISTENTE = uuid(999);

type Linha = { id: string; nome: string; versao: number; ativo: boolean };
type Etapa = { id: string; roteiroId: string; operacaoId: string; ordem: number };

class RepositorioEmMemoria implements RoteiroRepository {
  roteiros: Linha[] = [];
  etapas: Etapa[] = [];
  ligacoes: { etapaId: string; postoId: string }[] = [];
  ordens = new Map<string, number>();
  operacoes = [CORTE, MONTAGEM, INSPECAO];
  postos = [PRE01, MON01, MON09];
  private seq = 0;
  private novoId() { return uuid(++this.seq); }

  async listar() {
    return this.roteiros.map((r) => ({
      ...r, quantidadeEtapas: this.etapas.filter((e) => e.roteiroId === r.id).length, quantidadeOrdens: this.ordens.get(r.id) ?? 0,
      createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z',
    }));
  }
  async buscar(id: string): Promise<RoteiroDetalhe | null> {
    const r = this.roteiros.find((item) => item.id === id);
    if (!r) return null;
    const etapas = this.etapas.filter((e) => e.roteiroId === id).sort((a, b) => a.ordem - b.ordem);
    const ordens = this.ordens.get(id) ?? 0;
    return {
      ...r, quantidadeEtapas: etapas.length, quantidadeOrdens: ordens, travado: ordens > 0,
      createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z',
      etapas: etapas.map((e) => ({
        id: e.id, ordem: e.ordem, operacao: this.operacoes.find((o) => o.id === e.operacaoId)!,
        postos: this.ligacoes.filter((l) => l.etapaId === e.id).map((l) => this.postos.find((p) => p.id === l.postoId)!),
      })),
      versoes: this.roteiros.filter((item) => item.nome === r.nome).sort((a, b) => a.versao - b.versao).map(({ id: vid, versao, ativo }) => ({ id: vid, versao, ativo })),
    };
  }
  async existeNome(nome: string) { return this.roteiros.some((r) => r.nome === nome); }
  async criar(nome: string) {
    if (this.roteiros.some((r) => r.nome === nome && r.versao === 1)) {
      return traduzirErroGravacaoRoteiro({ sqlState: '23505', constraint: 'Roteiro_nome_versao_key' }, 'Já existe um roteiro com esse nome.');
    }
    const id = this.novoId();
    this.roteiros.push({ id, nome, versao: 1, ativo: true });
    return id;
  }
  async definirAtivo(id: string, ativo: boolean) {
    const r = this.roteiros.find((item) => item.id === id);
    if (r) r.ativo = ativo;
    return !!r;
  }
  async listarOperacoes() { return [...this.operacoes]; }
  async buscarOperacoes(ids: readonly string[]) { return this.operacoes.filter((o) => ids.includes(o.id)).map((o) => o.id); }
  async buscarPostos(ids: readonly string[]) { return this.postos.filter((p) => ids.includes(p.id)).map(({ id, ativo }) => ({ id, ativo })); }
  async substituirEtapas(roteiroId: string, etapas: readonly EtapaInformada[]) {
    if (this.ordens.get(roteiroId)) throw new ErroDeRoteiro('CONFLITO', 'Este roteiro já tem ordens de produção.');
    const mantidas = new Set(etapas.flatMap((e) => e.id ? [e.id] : []));
    const removidas = new Set(this.etapas.filter((e) => e.roteiroId === roteiroId && !mantidas.has(e.id)).map((e) => e.id));
    this.ligacoes = this.ligacoes.filter((l) => !removidas.has(l.etapaId));
    this.etapas = this.etapas.filter((e) => !removidas.has(e.id));
    etapas.forEach((informada, indice) => {
      const existente = informada.id ? this.etapas.find((e) => e.id === informada.id) : undefined;
      if (existente) existente.ordem = indice + 1;
      else this.etapas.push({ id: this.novoId(), roteiroId, operacaoId: informada.operacaoId, ordem: indice + 1 });
    });
  }
  async definirPostos(etapaId: string, postoIds: readonly string[]) {
    this.ligacoes = [...this.ligacoes.filter((l) => l.etapaId !== etapaId), ...postoIds.map((postoId) => ({ etapaId, postoId }))];
  }
  async criarVersao(roteiroId: string) {
    const origem = this.roteiros.find((r) => r.id === roteiroId)!;
    const id = this.novoId();
    this.roteiros.push({ id, nome: origem.nome, versao: Math.max(...this.roteiros.filter((r) => r.nome === origem.nome).map((r) => r.versao)) + 1, ativo: true });
    for (const etapa of this.etapas.filter((e) => e.roteiroId === roteiroId)) {
      const copia = { ...etapa, id: this.novoId(), roteiroId: id };
      this.etapas.push(copia);
      for (const l of this.ligacoes.filter((item) => item.etapaId === etapa.id)) this.ligacoes.push({ etapaId: copia.id, postoId: l.postoId });
    }
    return id;
  }
}

const erroCom = (codigo: ErroDeRoteiro['codigo'], mensagem?: RegExp) => (erro: unknown) =>
  erro instanceof ErroDeRoteiro && erro.codigo === codigo && (!mensagem || mensagem.test(erro.message));
const operacoesDe = (r: RoteiroDetalhe) => r.etapas.map((e) => `${e.ordem}:${e.operacao.nome}`);

async function roteiroComEtapas() {
  const repositorio = new RepositorioEmMemoria();
  const service = new RoteirosService(repositorio);
  const criado = await service.criar({ nome: 'Roteiro A' });
  const roteiro = await service.salvarEtapas(criado.id, [{ operacaoId: CORTE.id }, { operacaoId: MONTAGEM.id }, { operacaoId: INSPECAO.id }]);
  return { repositorio, service, roteiro };
}

test('roteiro: cria na versão 1, ativo, sem etapas e recusa nome vazio ou repetido', async () => {
  const service = new RoteirosService(new RepositorioEmMemoria());
  const roteiro = await service.criar({ nome: '  Roteiro A  ' });
  assert.deepEqual([roteiro.nome, roteiro.versao, roteiro.ativo, roteiro.etapas, roteiro.travado], ['Roteiro A', 1, true, [], false]);
  await assert.rejects(() => service.criar({ nome: 'Roteiro A' }), erroCom('CONFLITO', /Nova versão/));
  await assert.rejects(() => service.criar({ nome: '  ' }), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.buscar(INEXISTENTE), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.buscar('roteiro-1'), erroCom('NAO_ENCONTRADO'));
});

test('roteiro: etapas são numeradas na ordem enviada; reordenar e remover mantém as etapas existentes', async () => {
  const { service, roteiro, repositorio } = await roteiroComEtapas();
  assert.deepEqual(operacoesDe(roteiro), ['1:Corte', '2:Montagem', '3:Inspeção']);
  const [corte, montagem, inspecao] = roteiro.etapas;
  await service.definirPostosDaEtapa(roteiro.id, montagem.id, [MON01.id]);
  const reordenado = await service.salvarEtapas(roteiro.id, [
    { id: inspecao.id, operacaoId: INSPECAO.id }, { id: montagem.id, operacaoId: MONTAGEM.id }, { operacaoId: INSPECAO.id },
  ]);
  assert.deepEqual(operacoesDe(reordenado), ['1:Inspeção', '2:Montagem', '3:Inspeção']);
  assert.deepEqual([reordenado.etapas[0].id, reordenado.etapas[1].id], [inspecao.id, montagem.id]);
  assert.deepEqual(reordenado.etapas[1].postos.map((p) => p.codigo), ['MON-01']);
  assert.equal(repositorio.etapas.some((e) => e.id === corte.id), false);
});

test('roteiro: etapas inválidas são recusadas sem gravar', async () => {
  const { service, roteiro, repositorio } = await roteiroComEtapas();
  const outro = await service.salvarEtapas((await service.criar({ nome: 'Roteiro B' })).id, [{ operacaoId: CORTE.id }]);
  const antes = structuredClone(repositorio.etapas);
  const [corte] = roteiro.etapas;
  for (const [etapas, mensagem] of [
    [[], /pelo menos uma etapa/],
    ['x', /pelo menos uma etapa/],
    [[{ operacaoId: 'corte' }], /operação válida/],
    [[{ operacaoId: INEXISTENTE }], /Operação não encontrada/],
    [[{ id: corte.id, operacaoId: CORTE.id }, { id: corte.id, operacaoId: CORTE.id }], /repetida/],
    [[{ id: outro.etapas[0].id, operacaoId: CORTE.id }], /não pertence/],
    [[{ id: corte.id, operacaoId: MONTAGEM.id }], /remova a etapa/],
    [[{ operacaoId: CORTE.id, ordem: 5 }], /somente a etapa/],
    [[null], /Etapa inválida/],
  ] as const) {
    await assert.rejects(() => service.salvarEtapas(roteiro.id, etapas), erroCom('ENTRADA_INVALIDA', mensagem));
  }
  assert.deepEqual(repositorio.etapas, antes);
});

test('roteiro: com ordens, as etapas ficam travadas, mas os postos podem mudar', async () => {
  const { service, roteiro, repositorio } = await roteiroComEtapas();
  repositorio.ordens.set(roteiro.id, 2);
  const travado = await service.buscar(roteiro.id);
  assert.deepEqual([travado.travado, travado.quantidadeOrdens], [true, 2]);
  await assert.rejects(() => service.salvarEtapas(roteiro.id, [{ operacaoId: CORTE.id }]), erroCom('CONFLITO', /nova versão/));
  assert.deepEqual(operacoesDe(await service.buscar(roteiro.id)), ['1:Corte', '2:Montagem', '3:Inspeção']);
  const comPostos = await service.definirPostosDaEtapa(roteiro.id, roteiro.etapas[0].id, [PRE01.id]);
  assert.deepEqual(comPostos.etapas[0].postos.map((p) => p.codigo), ['PRE-01']);
});

test('roteiro: postos da etapa validam existência, repetição, posto inativo novo e etapa de outro roteiro', async () => {
  const { service, roteiro, repositorio } = await roteiroComEtapas();
  const etapa = roteiro.etapas[1];
  await assert.rejects(() => service.definirPostosDaEtapa(roteiro.id, etapa.id, [INEXISTENTE]), erroCom('ENTRADA_INVALIDA', /não encontrado/));
  await assert.rejects(() => service.definirPostosDaEtapa(roteiro.id, etapa.id, [MON01.id, MON01.id]), erroCom('ENTRADA_INVALIDA', /repetido/));
  await assert.rejects(() => service.definirPostosDaEtapa(roteiro.id, etapa.id, ['mon-01']), erroCom('ENTRADA_INVALIDA'));
  await assert.rejects(() => service.definirPostosDaEtapa(roteiro.id, etapa.id, [MON09.id]), erroCom('ENTRADA_INVALIDA', /inativo/));
  await assert.rejects(() => service.definirPostosDaEtapa(roteiro.id, INEXISTENTE, []), erroCom('NAO_ENCONTRADO', /Etapa/));
  const outro = await service.salvarEtapas((await service.criar({ nome: 'Roteiro B' })).id, [{ operacaoId: CORTE.id }]);
  await assert.rejects(() => service.definirPostosDaEtapa(roteiro.id, outro.etapas[0].id, []), erroCom('NAO_ENCONTRADO', /Etapa/));
  // Um posto que ficou inativo depois de ligado continua aceito, para poder ser mantido ou retirado.
  repositorio.ligacoes.push({ etapaId: etapa.id, postoId: MON09.id });
  const mantido = await service.definirPostosDaEtapa(roteiro.id, etapa.id, [MON01.id, MON09.id]);
  assert.deepEqual(mantido.etapas[1].postos.map((p) => p.codigo), ['MON-01', 'MON-09']);
  assert.deepEqual((await service.definirPostosDaEtapa(roteiro.id, etapa.id, [])).etapas[1].postos, []);
});

test('roteiro: nova versão copia etapas e postos para a próxima versão e não altera a de origem', async () => {
  const { service, roteiro, repositorio } = await roteiroComEtapas();
  await service.definirPostosDaEtapa(roteiro.id, roteiro.etapas[1].id, [MON01.id]);
  repositorio.ordens.set(roteiro.id, 1);
  const v2 = await service.criarVersao(roteiro.id);
  assert.deepEqual([v2.nome, v2.versao, v2.ativo, v2.travado], ['Roteiro A', 2, true, false]);
  assert.deepEqual(operacoesDe(v2), ['1:Corte', '2:Montagem', '3:Inspeção']);
  assert.deepEqual(v2.etapas[1].postos.map((p) => p.codigo), ['MON-01']);
  assert.ok(v2.etapas.every((e) => !roteiro.etapas.some((o) => o.id === e.id)));
  // A partir da versão 1 de novo: a próxima é a 3.
  const v3 = await service.criarVersao(roteiro.id);
  assert.equal(v3.versao, 3);
  assert.deepEqual(v3.versoes.map((v) => v.versao), [1, 2, 3]);
  await service.salvarEtapas(v2.id, [{ id: v2.etapas[0].id, operacaoId: CORTE.id }]);
  assert.deepEqual(operacoesDe(await service.buscar(roteiro.id)), ['1:Corte', '2:Montagem', '3:Inspeção']);
  await assert.rejects(() => service.criarVersao(INEXISTENTE), erroCom('NAO_ENCONTRADO'));
});

test('roteiro: inativa e reativa', async () => {
  const { service, roteiro } = await roteiroComEtapas();
  assert.equal((await service.definirStatus(roteiro.id, false)).ativo, false);
  assert.equal((await service.definirStatus(roteiro.id, true)).ativo, true);
  await assert.rejects(() => service.definirStatus(INEXISTENTE, false), erroCom('NAO_ENCONTRADO'));
});

test('roteiro: traduz nome + versão e ordem repetidos, inclusive na cadeia cause', () => {
  assert.throws(() => traduzirErroGravacaoRoteiro({ sqlState: '23505', constraint: 'Roteiro_nome_versao_key' }), erroCom('CONFLITO', /Outra versão/));
  assert.throws(() => traduzirErroGravacaoRoteiro({ cause: { code: '23505', constraint: 'Roteiro_nome_versao_key' } }, 'Nome repetido.'), erroCom('CONFLITO', /Nome repetido/));
  assert.throws(() => traduzirErroGravacaoRoteiro({ code: '23505', constraint: 'EtapaRoteiro_roteiroId_ordem_key' }), erroCom('CONFLITO', /ao mesmo tempo/));
  const outro = { code: '23505', constraint: 'Outra_key' };
  assert.throws(() => traduzirErroGravacaoRoteiro(outro), (erro: unknown) => erro === outro);
});

const json = (method: string, corpo: unknown) => new Request('http://localhost/api/roteiros', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

test('roteiro: handlers respondem 201, 200, 400, 404 e 409 conforme o caso', async () => {
  const repositorio = new RepositorioEmMemoria();
  const handlers = criarHandlersRoteiros({ autorizar: async () => ({}), roteiros: new RoteirosService(repositorio) });
  const criado = await handlers.POST(json('POST', { nome: 'Roteiro A' }));
  assert.equal(criado.status, 201);
  const { id } = await criado.json();
  assert.equal((await handlers.POST(json('POST', { nome: 'Roteiro A' }))).status, 409);
  for (const corpo of [{}, { nome: 1 }, { nome: 'B', versao: 2 }]) assert.equal((await handlers.POST(json('POST', corpo))).status, 400);
  const etapas = await handlers.PUT_ETAPAS(json('PUT', { etapas: [{ operacaoId: CORTE.id }] }), id);
  assert.equal(etapas.status, 200);
  const etapaId = (await etapas.json()).etapas[0].id;
  assert.equal((await handlers.PUT_ETAPAS(json('PUT', [{ operacaoId: CORTE.id }]), id)).status, 400);
  assert.equal((await handlers.PUT_POSTOS(json('PUT', { postoIds: [PRE01.id] }), id, etapaId)).status, 200);
  assert.equal((await handlers.PUT_POSTOS(json('PUT', { postoIds: [PRE01.id] }), id, INEXISTENTE)).status, 404);
  assert.equal((await handlers.PATCH_STATUS(json('PATCH', { ativo: 'false' }), id)).status, 400);
  assert.equal((await (await handlers.PATCH_STATUS(json('PATCH', { ativo: false }), id)).json()).ativo, false);
  const versao = await handlers.POST_VERSAO(id);
  assert.equal(versao.status, 201);
  assert.equal((await versao.json()).versao, 2);
  assert.equal((await handlers.GET_DETALHE(INEXISTENTE)).status, 404);
  repositorio.ordens.set(id, 1);
  assert.equal((await handlers.PUT_ETAPAS(json('PUT', { etapas: [{ operacaoId: MONTAGEM.id }] }), id)).status, 409);
  const lista = await handlers.GET();
  assert.equal(lista.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await lista.json()).map((r: RoteiroDetalhe) => `${r.nome} v${r.versao}`), ['Roteiro A v1', 'Roteiro A v2']);
});

test('roteiro: sem sessão ou sem ADMIN ativo não lê nem grava, e falha inesperada responde 500', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403]] as const) {
    const repositorio = new RepositorioEmMemoria();
    const service = new RoteirosService(repositorio);
    const { id } = await service.criar({ nome: 'Roteiro A' });
    const handlers = criarHandlersRoteiros({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, roteiros: service });
    for (const resposta of [
      await handlers.GET(), await handlers.GET_DETALHE(id), await handlers.POST(json('POST', { nome: 'B' })),
      await handlers.PUT_ETAPAS(json('PUT', { etapas: [{ operacaoId: CORTE.id }] }), id), await handlers.POST_VERSAO(id),
      await handlers.PATCH_STATUS(json('PATCH', { ativo: false }), id),
    ]) assert.equal(resposta.status, status);
    assert.deepEqual([repositorio.roteiros.length, repositorio.etapas.length, repositorio.roteiros[0].ativo], [1, 0, true]);
  }
  const falha = async () => { throw new Error('connect ECONNREFUSED'); };
  const handlers = criarHandlersRoteiros({ autorizar: async () => ({}), roteiros: {
    listar: falha, buscar: falha, criar: falha, definirStatus: falha, salvarEtapas: falha, definirPostosDaEtapa: falha, criarVersao: falha,
  } });
  const resposta = await handlers.GET();
  assert.equal(resposta.status, 500);
  assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
});

test('roteiro: listagem filtra e ordena; edição move etapas e detecta alteração', () => {
  const base = (id: string, nome: string, versao: number, ativo: boolean, quantidadeEtapas: number) =>
    ({ id, nome, versao, ativo, quantidadeEtapas, quantidadeOrdens: 0, createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' });
  const roteiros = [base('1', 'Roteiro B', 1, true, 3), base('2', 'Roteiro A', 2, false, 4), base('3', 'Roteiro A', 1, true, 4)];
  const copia = structuredClone(roteiros);
  assert.deepEqual(filtrarOrdenarRoteiros(roteiros, 'roteiro a', 'todos', { coluna: 'nome', direcao: 'asc' }).map((r) => r.id), ['3', '2']);
  assert.deepEqual(filtrarOrdenarRoteiros(roteiros, '', 'ativos', { coluna: 'nome', direcao: 'asc' }).map((r) => r.id), ['3', '1']);
  assert.deepEqual(filtrarOrdenarRoteiros(roteiros, '', 'todos', { coluna: 'quantidadeEtapas', direcao: 'asc' }).map((r) => r.id), ['1', '3', '2']);
  assert.deepEqual(roteiros, copia);

  const etapas = [CORTE, MONTAGEM, INSPECAO].map((operacao, i) => ({ id: uuid(i + 1), ordem: i + 1, operacao, postos: [] }));
  const edicao = paraEdicao(etapas);
  assert.equal(etapasAlteradas(etapas, edicao), false);
  const movida = moverEtapa(edicao, 0, 1);
  assert.deepEqual(movida.map((e) => e.operacao.nome), ['Montagem', 'Corte', 'Inspeção']);
  assert.equal(etapasAlteradas(etapas, movida), true);
  assert.deepEqual(moverEtapa(edicao, 0, -1), edicao);
  assert.equal(etapasAlteradas(etapas, edicao.slice(1)), true);
  assert.equal(etapasAlteradas(etapas, [...edicao, { chave: 'nova-1', operacao: CORTE }]), true);
});
