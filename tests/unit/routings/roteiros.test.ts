import test from 'node:test';
import assert from 'node:assert/strict';
import { RoteirosService } from '../../../modules/routings/application/roteiros.ts';
import type { RoteiroRepository } from '../../../modules/routings/application/contracts.ts';
import { ErroDeRoteiro, type EtapaInformada, type RoteiroDetalhe, type TempoInformado } from '../../../modules/routings/domain/roteiro.ts';
import { traduzirErroGravacaoRoteiro } from '../../../modules/routings/infrastructure/persistence-errors.ts';
import { criarHandlersRoteiros } from '../../../modules/routings/presentation/http.ts';
import { etapasAlteradas, filtrarOrdenarRoteiros, lerTempoDigitado, moverEtapa, paraEdicao } from '../../../modules/routings/presentation/listing.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CORTE = { id: uuid(901), nome: 'Corte' };
const LIXAMENTO = { id: uuid(904), nome: 'Lixamento' };
const MONTAGEM = { id: uuid(902), nome: 'Montagem' };
const INSPECAO = { id: uuid(903), nome: 'Inspeção' };
const PRE01 = { id: uuid(801), codigo: 'PRE-01', nome: 'Corte 1', ativo: true, setorNome: 'Preparação' };
const MON01 = { id: uuid(802), codigo: 'MON-01', nome: 'Montagem 1', ativo: true, setorNome: 'Montagem' };
const MON09 = { id: uuid(803), codigo: 'MON-09', nome: 'Montagem antiga', ativo: false, setorNome: 'Montagem' };
const INEXISTENTE = uuid(999);
const PRD1 = { id: uuid(701), codigo: 'PRD-001', nome: 'Produto A' };
const PRD2 = { id: uuid(702), codigo: 'PRD-002', nome: 'Produto B' };
const PRD9 = { id: uuid(709), codigo: 'PRD-009', nome: 'Produto antigo' };

type Linha = { id: string; nome: string; versao: number; ativo: boolean };
type Etapa = { id: string; roteiroId: string; operacaoId: string; ordem: number };

class RepositorioEmMemoria implements RoteiroRepository {
  roteiros: Linha[] = [];
  etapas: Etapa[] = [];
  ligacoes: { etapaId: string; postoId: string }[] = [];
  // Ordens por roteiro e produto: chave `${roteiroId}|${produtoId}`.
  ordens = new Map<string, number>();
  produtosLigados: { roteiroId: string; produtoId: string; vigente: boolean }[] = [];
  tempos: { produtoId: string; etapaId: string; tempoPadrao: number }[] = [];
  produtos = [PRD1, PRD2, PRD9];
  ordensDoRoteiro(roteiroId: string) {
    return [...this.ordens].filter(([chave]) => chave.startsWith(`${roteiroId}|`)).reduce((soma, [, n]) => soma + n, 0);
  }
  operacoes = [CORTE, MONTAGEM, INSPECAO, LIXAMENTO];
  inativas = new Set([LIXAMENTO.id, PRD9.id]);
  postos = [PRE01, MON01, MON09];
  private seq = 0;
  private novoId() { return uuid(++this.seq); }

  async listar() {
    return this.roteiros.map((r) => ({
      ...r, quantidadeEtapas: this.etapas.filter((e) => e.roteiroId === r.id).length, quantidadeOrdens: this.ordensDoRoteiro(r.id),
      createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z',
    }));
  }
  async buscar(id: string): Promise<RoteiroDetalhe | null> {
    const r = this.roteiros.find((item) => item.id === id);
    if (!r) return null;
    const etapas = this.etapas.filter((e) => e.roteiroId === id).sort((a, b) => a.ordem - b.ordem);
    const ordens = this.ordensDoRoteiro(id);
    return {
      ...r, quantidadeEtapas: etapas.length, quantidadeOrdens: ordens, travado: ordens > 0,
      createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z',
      etapas: etapas.map((e) => ({
        id: e.id, ordem: e.ordem, operacao: this.operacoes.find((o) => o.id === e.operacaoId)!,
        postos: this.ligacoes.filter((l) => l.etapaId === e.id).map((l) => this.postos.find((p) => p.id === l.postoId)!),
      })),
      versoes: this.roteiros.filter((item) => item.nome === r.nome).sort((a, b) => a.versao - b.versao).map(({ id: vid, versao, ativo }) => ({ id: vid, versao, ativo })),
      produtos: this.produtosLigados.filter((l) => l.roteiroId === id).map((l) => {
        const produto = this.produtos.find((p) => p.id === l.produtoId)!;
        const quantidadeOrdens = this.ordens.get(`${id}|${l.produtoId}`) ?? 0;
        return {
          ...produto, vigente: l.vigente, quantidadeOrdens, travado: quantidadeOrdens > 0,
          tempos: this.tempos.filter((t) => t.produtoId === l.produtoId && etapas.some((e) => e.id === t.etapaId)).map(({ etapaId, tempoPadrao }) => ({ etapaId, tempoPadrao })),
        };
      }),
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
  async listarOperacoes() { return this.operacoes.filter((o) => !this.inativas.has(o.id)); }
  async buscarOperacoes(ids: readonly string[]) { return this.operacoes.filter((o) => ids.includes(o.id)).map((o) => ({ id: o.id, ativo: !this.inativas.has(o.id) })); }
  async buscarPostos(ids: readonly string[]) { return this.postos.filter((p) => ids.includes(p.id)).map(({ id, ativo }) => ({ id, ativo })); }
  async substituirEtapas(roteiroId: string, etapas: readonly EtapaInformada[]) {
    if (this.ordensDoRoteiro(roteiroId)) throw new ErroDeRoteiro('CONFLITO', 'Este roteiro já tem ordens de produção.');
    const mantidas = new Set(etapas.flatMap((e) => e.id ? [e.id] : []));
    const removidas = new Set(this.etapas.filter((e) => e.roteiroId === roteiroId && !mantidas.has(e.id)).map((e) => e.id));
    this.ligacoes = this.ligacoes.filter((l) => !removidas.has(l.etapaId));
    this.tempos = this.tempos.filter((t) => !removidas.has(t.etapaId));
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
    for (const l of this.produtosLigados.filter((item) => item.roteiroId === roteiroId)) this.produtosLigados.push({ roteiroId: id, produtoId: l.produtoId, vigente: false });
    for (const etapa of this.etapas.filter((e) => e.roteiroId === roteiroId)) {
      const copia = { ...etapa, id: this.novoId(), roteiroId: id };
      this.etapas.push(copia);
      for (const l of this.ligacoes.filter((item) => item.etapaId === etapa.id)) this.ligacoes.push({ etapaId: copia.id, postoId: l.postoId });
      for (const t of this.tempos.filter((item) => item.etapaId === etapa.id)) this.tempos.push({ ...t, etapaId: copia.id });
    }
    return id;
  }
  async buscarProduto(id: string) { return this.produtos.some((p) => p.id === id) ? { id, ativo: !this.inativas.has(id) } : null; }
  async associarProduto(roteiroId: string, produtoId: string) { this.produtosLigados.push({ roteiroId, produtoId, vigente: false }); }
  async definirVigente(roteiroId: string, produtoId: string) {
    for (const l of this.produtosLigados) if (l.produtoId === produtoId) l.vigente = l.roteiroId === roteiroId;
  }
  async removerProduto(roteiroId: string, produtoId: string) {
    if (this.ordens.get(`${roteiroId}|${produtoId}`)) throw new ErroDeRoteiro('CONFLITO', 'Este produto tem ordens.');
    const etapas = new Set(this.etapas.filter((e) => e.roteiroId === roteiroId).map((e) => e.id));
    this.tempos = this.tempos.filter((t) => !(t.produtoId === produtoId && etapas.has(t.etapaId)));
    this.produtosLigados = this.produtosLigados.filter((l) => !(l.roteiroId === roteiroId && l.produtoId === produtoId));
  }
  async salvarTempos(roteiroId: string, produtoId: string, tempos: readonly TempoInformado[]) {
    if (this.ordens.get(`${roteiroId}|${produtoId}`)) throw new ErroDeRoteiro('CONFLITO', 'Este produto já tem ordens.');
    for (const tempo of tempos) {
      this.tempos = this.tempos.filter((t) => !(t.produtoId === produtoId && t.etapaId === tempo.etapaId));
      if (tempo.tempoPadrao !== null) this.tempos.push({ produtoId, etapaId: tempo.etapaId, tempoPadrao: tempo.tempoPadrao });
    }
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
  repositorio.ordens.set(`${roteiro.id}|${PRD1.id}`, 2);
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
  repositorio.ordens.set(`${roteiro.id}|${PRD1.id}`, 1);
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
  repositorio.ordens.set(`${id}|${PRD1.id}`, 1);
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
    associarProduto: falha, definirVigente: falha, removerProduto: falha, salvarTempos: falha,
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

test('roteiro: liga produto, recusa produto inexistente, inválido ou repetido, e remove a ligação com os tempos', async () => {
  const { service, roteiro, repositorio } = await roteiroComEtapas();
  const ligado = await service.associarProduto(roteiro.id, PRD1.id);
  assert.deepEqual(ligado.produtos.map((p) => [p.codigo, p.vigente, p.quantidadeOrdens, p.travado]), [['PRD-001', false, 0, false]]);
  await assert.rejects(() => service.associarProduto(roteiro.id, PRD1.id), erroCom('CONFLITO', /já está ligado/));
  await assert.rejects(() => service.associarProduto(roteiro.id, INEXISTENTE), erroCom('ENTRADA_INVALIDA', /não encontrado/));
  await assert.rejects(() => service.associarProduto(roteiro.id, 'prd-001'), erroCom('ENTRADA_INVALIDA', /válido/));
  await service.salvarTempos(roteiro.id, PRD1.id, [{ etapaId: roteiro.etapas[0].id, tempoPadrao: 30 }]);
  const removido = await service.removerProduto(roteiro.id, PRD1.id);
  assert.deepEqual([removido.produtos, repositorio.tempos], [[], []]);
  await assert.rejects(() => service.removerProduto(roteiro.id, PRD1.id), erroCom('NAO_ENCONTRADO', /não está ligado/));
});

test('roteiro: só uma versão vigente por produto, e roteiro inativo não pode ser vigente', async () => {
  const { service, roteiro } = await roteiroComEtapas();
  await service.associarProduto(roteiro.id, PRD1.id);
  const v2 = await service.criarVersao(roteiro.id);
  assert.deepEqual(v2.produtos.map((p) => [p.codigo, p.vigente]), [['PRD-001', false]]);
  assert.equal((await service.definirVigente(roteiro.id, PRD1.id)).produtos[0].vigente, true);
  assert.equal((await service.definirVigente(v2.id, PRD1.id)).produtos[0].vigente, true);
  assert.equal((await service.buscar(roteiro.id)).produtos[0].vigente, false);
  // Definir de novo a mesma vigente não muda nada.
  assert.equal((await service.definirVigente(v2.id, PRD1.id)).produtos[0].vigente, true);
  await service.definirStatus(roteiro.id, false);
  await assert.rejects(() => service.definirVigente(roteiro.id, PRD1.id), erroCom('CONFLITO', /inativo/));
  await assert.rejects(() => service.definirVigente(roteiro.id, PRD2.id), erroCom('NAO_ENCONTRADO', /não está ligado/));
});

test('roteiro: não inativa a versão que é vigente de algum produto', async () => {
  const { service, roteiro } = await roteiroComEtapas();
  await service.associarProduto(roteiro.id, PRD1.id);
  await service.definirVigente(roteiro.id, PRD1.id);
  await assert.rejects(() => service.definirStatus(roteiro.id, false), erroCom('CONFLITO', /vigente/));
  assert.equal((await service.buscar(roteiro.id)).ativo, true);
});

test('roteiro: salva, altera e retira tempos padrão; valida o valor e a etapa', async () => {
  const { service, roteiro } = await roteiroComEtapas();
  await service.associarProduto(roteiro.id, PRD1.id);
  const [corte, montagem, inspecao] = roteiro.etapas;
  const salvo = await service.salvarTempos(roteiro.id, PRD1.id, [{ etapaId: corte.id, tempoPadrao: 30 }, { etapaId: montagem.id, tempoPadrao: 120.5 }, { etapaId: inspecao.id, tempoPadrao: null }]);
  assert.deepEqual(salvo.produtos[0].tempos.map((t) => t.tempoPadrao).sort((a, b) => a - b), [30, 120.5]);
  const alterado = await service.salvarTempos(roteiro.id, PRD1.id, [{ etapaId: corte.id, tempoPadrao: null }, { etapaId: montagem.id, tempoPadrao: 90 }]);
  assert.deepEqual(alterado.produtos[0].tempos, [{ etapaId: montagem.id, tempoPadrao: 90 }]);
  const outro = await service.salvarEtapas((await service.criar({ nome: 'Roteiro B' })).id, [{ operacaoId: CORTE.id }]);
  for (const [tempos, mensagem] of [
    [[{ etapaId: corte.id, tempoPadrao: 0 }], /maior que zero/],
    [[{ etapaId: corte.id, tempoPadrao: -5 }], /maior que zero/],
    [[{ etapaId: corte.id, tempoPadrao: '30' }], /maior que zero/],
    [[{ etapaId: corte.id, tempoPadrao: 100_000_000 }], /maior que zero/],
    [[{ etapaId: corte.id, tempoPadrao: 1.234 }], /duas casas/],
    [[{ etapaId: corte.id, tempoPadrao: 1 }, { etapaId: corte.id, tempoPadrao: 2 }], /repetida/],
    [[{ etapaId: outro.etapas[0].id, tempoPadrao: 1 }], /não pertence/],
    [[{ etapaId: corte.id, tempoPadrao: 1, unidade: 'min' }], /somente a etapa/],
    [[], /Informe os tempos/],
  ] as const) {
    await assert.rejects(() => service.salvarTempos(roteiro.id, PRD1.id, tempos), erroCom('ENTRADA_INVALIDA', mensagem));
  }
  await assert.rejects(() => service.salvarTempos(roteiro.id, PRD2.id, [{ etapaId: corte.id, tempoPadrao: 1 }]), erroCom('NAO_ENCONTRADO'));
  assert.deepEqual((await service.buscar(roteiro.id)).produtos[0].tempos, [{ etapaId: montagem.id, tempoPadrao: 90 }]);
});

test('roteiro: tempos e ligação travam só para o produto que tem ordens nesta versão', async () => {
  const { service, roteiro, repositorio } = await roteiroComEtapas();
  await service.associarProduto(roteiro.id, PRD1.id);
  await service.associarProduto(roteiro.id, PRD2.id);
  const etapa = roteiro.etapas[0].id;
  await service.salvarTempos(roteiro.id, PRD1.id, [{ etapaId: etapa, tempoPadrao: 30 }]);
  repositorio.ordens.set(`${roteiro.id}|${PRD1.id}`, 3);
  const atual = await service.buscar(roteiro.id);
  assert.deepEqual(atual.produtos.map((p) => [p.codigo, p.quantidadeOrdens, p.travado]), [['PRD-001', 3, true], ['PRD-002', 0, false]]);
  await assert.rejects(() => service.salvarTempos(roteiro.id, PRD1.id, [{ etapaId: etapa, tempoPadrao: 45 }]), erroCom('CONFLITO', /nova versão/));
  await assert.rejects(() => service.removerProduto(roteiro.id, PRD1.id), erroCom('CONFLITO', /não pode ser removida/));
  assert.equal((await service.salvarTempos(roteiro.id, PRD2.id, [{ etapaId: etapa, tempoPadrao: 45 }])).produtos[1].tempos[0].tempoPadrao, 45);
  // A nova versão leva os tempos e fica livre para mudar.
  const v2 = await service.criarVersao(roteiro.id);
  assert.deepEqual(v2.produtos.map((p) => [p.codigo, p.travado, p.tempos.map((t) => t.tempoPadrao)]), [['PRD-001', false, [30]], ['PRD-002', false, [45]]]);
  const novo = await service.salvarTempos(v2.id, PRD1.id, [{ etapaId: v2.etapas[0].id, tempoPadrao: 28 }]);
  assert.deepEqual(novo.produtos[0].tempos.map((t) => t.tempoPadrao), [28]);
  assert.deepEqual((await service.buscar(roteiro.id)).produtos[0].tempos.map((t) => t.tempoPadrao), [30]);
});

test('roteiro: handlers de produtos respondem 201, 200, 400, 404 e 409', async () => {
  const repositorio = new RepositorioEmMemoria();
  const service = new RoteirosService(repositorio);
  const handlers = criarHandlersRoteiros({ autorizar: async () => ({}), roteiros: service });
  const { id } = await service.criar({ nome: 'Roteiro A' });
  const { etapas } = await service.salvarEtapas(id, [{ operacaoId: CORTE.id }]);
  assert.equal((await handlers.POST_PRODUTO(json('POST', { produtoId: PRD1.id }), id)).status, 201);
  assert.equal((await handlers.POST_PRODUTO(json('POST', { produtoId: PRD1.id }), id)).status, 409);
  assert.equal((await handlers.POST_PRODUTO(json('POST', { produtoId: PRD1.id, vigente: true }), id)).status, 400);
  assert.equal((await handlers.PUT_TEMPOS(json('PUT', { tempos: [{ etapaId: etapas[0].id, tempoPadrao: 30 }] }), id, PRD1.id)).status, 200);
  assert.equal((await handlers.PUT_TEMPOS(json('PUT', { tempos: [{ etapaId: etapas[0].id, tempoPadrao: 0 }] }), id, PRD1.id)).status, 400);
  assert.equal((await handlers.PUT_TEMPOS(json('PUT', { tempos: [{ etapaId: etapas[0].id, tempoPadrao: 30 }] }), id, PRD2.id)).status, 404);
  const vigente = await handlers.PUT_VIGENTE(id, PRD1.id);
  assert.equal(vigente.status, 200);
  assert.equal((await vigente.json()).produtos[0].vigente, true);
  assert.equal((await handlers.PATCH_STATUS(json('PATCH', { ativo: false }), id)).status, 409);
  repositorio.ordens.set(`${id}|${PRD1.id}`, 1);
  assert.equal((await handlers.DELETE_PRODUTO(id, PRD1.id)).status, 409);
  assert.equal((await handlers.PUT_TEMPOS(json('PUT', { tempos: [{ etapaId: etapas[0].id, tempoPadrao: 40 }] }), id, PRD1.id)).status, 409);
  repositorio.ordens.clear();
  assert.equal((await handlers.DELETE_PRODUTO(id, PRD1.id)).status, 200);
  assert.equal((await handlers.DELETE_PRODUTO(id, PRD1.id)).status, 404);
  for (const resposta of [
    await criarHandlersRoteiros({ autorizar: async () => { throw new ErroDeAcesso('NAO_AUTENTICADO', 'Acesso negado.'); }, roteiros: service }).POST_PRODUTO(json('POST', { produtoId: PRD2.id }), id),
    await criarHandlersRoteiros({ autorizar: async () => { throw new ErroDeAcesso('SEM_AUTORIZACAO', 'Acesso negado.'); }, roteiros: service }).PUT_VIGENTE(id, PRD2.id),
  ]) assert.ok([401, 403].includes(resposta.status));
  assert.deepEqual(repositorio.produtosLigados, []);
});

test('roteiro: tempo digitado aceita vírgula ou ponto e recusa valores inválidos', () => {
  assert.equal(lerTempoDigitado(' 120,5 '), 120.5);
  assert.equal(lerTempoDigitado('30'), 30);
  assert.equal(lerTempoDigitado('0.25'), 0.25);
  assert.equal(lerTempoDigitado(''), null);
  for (const texto of ['0', '-1', 'abc', '1,234', '1e3', '100000000']) assert.equal(lerTempoDigitado(texto), undefined, texto);
});

test('roteiro: traduz produto repetido e vigência simultânea, inclusive com sufixo no nome do índice', () => {
  assert.throws(() => traduzirErroGravacaoRoteiro({ code: '23505', constraint: 'ProdutoRoteiro_produtoId_roteiroId_key' }), erroCom('CONFLITO', /já está ligado/));
  assert.throws(() => traduzirErroGravacaoRoteiro({ cause: { code: '23505', constraint: 'ProdutoRoteiro_vigente_unica_c7c5c582' } }), erroCom('CONFLITO', /vigência/));
});

test('roteiro: operação inativa não entra em etapa nova, mas a etapa que já a usa continua', async () => {
  const { service, roteiro, repositorio } = await roteiroComEtapas();
  assert.deepEqual((await service.listarOperacoes()).map((o) => o.nome), ['Corte', 'Montagem', 'Inspeção']);
  await assert.rejects(() => service.salvarEtapas(roteiro.id, [...roteiro.etapas.map((e) => ({ id: e.id, operacaoId: e.operacao.id })), { operacaoId: LIXAMENTO.id }]),
    erroCom('ENTRADA_INVALIDA', /inativa/));
  // A Montagem é inativada depois de estar no roteiro: a etapa existente pode ser mantida e reordenada.
  repositorio.inativas.add(MONTAGEM.id);
  const [corte, montagem, inspecao] = roteiro.etapas;
  const reordenado = await service.salvarEtapas(roteiro.id, [{ id: montagem.id, operacaoId: MONTAGEM.id }, { id: corte.id, operacaoId: CORTE.id }, { id: inspecao.id, operacaoId: INSPECAO.id }]);
  assert.deepEqual(operacoesDe(reordenado), ['1:Montagem', '2:Corte', '3:Inspeção']);
  await assert.rejects(() => service.salvarEtapas(roteiro.id, [{ operacaoId: MONTAGEM.id }]), erroCom('ENTRADA_INVALIDA', /inativa/));
});

test('roteiro: produto inativo não pode ser ligado', async () => {
  const { service, roteiro } = await roteiroComEtapas();
  await assert.rejects(() => service.associarProduto(roteiro.id, PRD9.id), erroCom('ENTRADA_INVALIDA', /inativo/));
  assert.deepEqual((await service.buscar(roteiro.id)).produtos, []);
});
