import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALFABETO_CODIGO, ErroDeDispositivo, formatarCodigo, INTERVALO_ATUALIZACAO_MS, LIMITE_ONLINE_MS, normalizarCodigo, situacaoConexao,
  validarAlteracaoDispositivo, validarCadastroDispositivo, type AlteracaoDispositivo, type DadosDispositivo, type Dispositivo,
} from '../../../modules/devices/domain/dispositivo.ts';
import { DispositivosService } from '../../../modules/devices/application/dispositivos.ts';
import type { CodigosDeAcesso, DispositivoRepository, PostoDoPainel } from '../../../modules/devices/application/contracts.ts';
import { janelaDeHoje, montarPainelTv, type FontesDoPainel } from '../../../modules/devices/application/painel-tv.ts';
import { codigosDeAcesso } from '../../../modules/devices/infrastructure/codigos-de-acesso.ts';
import { COOKIE_TV, criarHandlersDispositivos, criarHandlersTv } from '../../../modules/devices/presentation/http.ts';
import { lerPainelTv } from '../../../modules/devices/presentation/api-client.ts';
import { paginarPostos, POSTOS_POR_PAGINA, resumoDosPostos } from '../../../modules/devices/presentation/painel-tv-tela.ts';
import type { ExecucaoAcompanhada } from '../../../modules/executions/domain/execucao.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SETOR_MON = { id: uuid(901), nome: 'Montagem' };
const SETOR_COR = { id: uuid(902), nome: 'Corte' };

// ---------- repositório em memória (mesmo contrato do Prisma) ----------
class Repositorio implements DispositivoRepository {
  linhas: (Dispositivo & { codigoHash: string })[] = [];
  conexoesGravadas = 0;
  private seq = 0;
  private sem = (linha: Dispositivo & { codigoHash: string }): Dispositivo => {
    const d: Partial<Dispositivo & { codigoHash: string }> = { ...linha };
    delete d.codigoHash;
    return d as Dispositivo;
  };
  async listar() { return this.linhas.map(this.sem).sort((a, b) => a.nome.localeCompare(b.nome)); }
  async buscarPorId(id: string) { const l = this.linhas.find((d) => d.id === id); return l ? this.sem(l) : null; }
  async buscarPorNome(nome: string) { const l = this.linhas.find((d) => d.nome === nome); return l ? this.sem(l) : null; }
  async buscarPorCodigoHash(h: string) { const l = this.linhas.find((d) => d.codigoHash === h); return l ? this.sem(l) : null; }
  async setorExiste(id: string) { return [SETOR_MON.id, SETOR_COR.id].includes(id); }
  async criar(dados: DadosDispositivo, codigoHash: string) {
    const setor = [SETOR_MON, SETOR_COR].find((s) => s.id === dados.setorId) ?? null;
    const linha = { id: uuid(++this.seq), nome: dados.nome, local: dados.local, setor, ativo: true, ultimaConexaoEm: null, createdAt: '2026-11-09T10:00:00.000Z', updatedAt: '2026-11-09T10:00:00.000Z', codigoHash };
    this.linhas.push(linha);
    return this.sem(linha);
  }
  async alterar(id: string, dados: AlteracaoDispositivo) {
    const l = this.linhas.find((d) => d.id === id); if (!l) return null;
    if (dados.nome !== undefined) l.nome = dados.nome;
    if (dados.local !== undefined) l.local = dados.local;
    if (dados.setorId !== undefined) l.setor = [SETOR_MON, SETOR_COR].find((s) => s.id === dados.setorId) ?? null;
    return this.sem(l);
  }
  async definirAtivo(id: string, ativo: boolean) { const l = this.linhas.find((d) => d.id === id); if (!l) return null; l.ativo = ativo; return this.sem(l); }
  async trocarCodigo(id: string, codigoHash: string) { const l = this.linhas.find((d) => d.id === id); if (!l) return null; l.codigoHash = codigoHash; l.ultimaConexaoEm = null; return this.sem(l); }
  async registrarConexao(id: string, agora: string) { this.conexoesGravadas++; const l = this.linhas.find((d) => d.id === id); if (l) l.ultimaConexaoEm = agora; }
  async listarPostosAtivos(): Promise<PostoDoPainel[]> { return []; }
}

let contador = 0;
const codigosFixos: CodigosDeAcesso = {
  gerar: () => formatarCodigo(new Uint8Array(10).map((_, i) => (i + contador++) % 256)),
  resumo: codigosDeAcesso.resumo,
};
function novoServico(agoraIso = '2026-11-09T12:00:00.000Z') {
  const repositorio = new Repositorio();
  let agora = new Date(agoraIso);
  const service = new DispositivosService(repositorio, codigosFixos, () => agora);
  return { repositorio, service, avancar: (ms: number) => { agora = new Date(agora.getTime() + ms); } };
}
const erroCom = (codigo: ErroDeDispositivo['codigo'], mensagem?: RegExp) => (erro: unknown) =>
  erro instanceof ErroDeDispositivo && erro.codigo === codigo && (!mensagem || mensagem.test(erro.message));

// ---------- domínio ----------
test('TV: código de acesso com 10 caracteres sem letras ambíguas, exibido em dois blocos', () => {
  const codigo = codigosDeAcesso.gerar();
  assert.match(codigo, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.ok([...codigo.replace('-', '')].every((c) => ALFABETO_CODIGO.includes(c)));
  assert.ok(!/[IO01]/.test(ALFABETO_CODIGO));
  assert.notEqual(codigosDeAcesso.gerar(), codigosDeAcesso.gerar());
});

test('TV: o código é aceito com ou sem hífen, espaços e minúsculas; fora do formato é recusado', () => {
  assert.equal(normalizarCodigo(' abcde-fgh23 '), 'ABCDEFGH23');
  assert.equal(normalizarCodigo('ABCDE FGH23'), 'ABCDEFGH23');
  for (const invalido of ['ABCDE-FGH2', 'ABCDE-FGH234', 'ABCDE-FGH2O', 'ABCDE-FGH21', 42, null, undefined]) assert.equal(normalizarCodigo(invalido), null, String(invalido));
});

test('TV: o banco guarda só o resumo do código, que não revela o código', () => {
  const resumo = codigosDeAcesso.resumo('ABCDEFGH23');
  assert.match(resumo, /^[0-9a-f]{64}$/);
  assert.equal(resumo.includes('ABCDEFGH23'), false);
  assert.equal(codigosDeAcesso.resumo('ABCDEFGH23'), resumo);
  assert.notEqual(codigosDeAcesso.resumo('ABCDEFGH24'), resumo);
});

test('TV: atualiza a cada 5 s; online até 20 s sem sinal; depois offline; sem nenhuma conexão, nunca conectou', () => {
  assert.deepEqual([INTERVALO_ATUALIZACAO_MS, LIMITE_ONLINE_MS], [5_000, 20_000]);
  const agora = Date.parse('2026-11-09T12:00:00.000Z');
  assert.equal(situacaoConexao(null, agora), 'NUNCA_CONECTOU');
  assert.equal(situacaoConexao(new Date(agora - LIMITE_ONLINE_MS).toISOString(), agora), 'ONLINE');
  assert.equal(situacaoConexao(new Date(agora - LIMITE_ONLINE_MS - 1).toISOString(), agora), 'OFFLINE');
});

test('TV: cadastro exige nome até 120 caracteres; local opcional; setor precisa ser um identificador', () => {
  assert.deepEqual(validarCadastroDispositivo({ nome: '  TV da Montagem ', local: ' ', setorId: '' }), { nome: 'TV da Montagem', local: null, setorId: null });
  assert.throws(() => validarCadastroDispositivo({ nome: '  ' }), erroCom('ENTRADA_INVALIDA', /Nome/));
  assert.throws(() => validarCadastroDispositivo({ nome: 'x'.repeat(121) }), erroCom('ENTRADA_INVALIDA', /120/));
  assert.throws(() => validarCadastroDispositivo({ nome: 'TV', setorId: 'abc' }), erroCom('ENTRADA_INVALIDA', /Setor/));
  assert.throws(() => validarAlteracaoDispositivo({}), erroCom('ENTRADA_INVALIDA'));
});

// ---------- serviço ----------
test('TV: cadastrar devolve o código uma vez e grava apenas o resumo', async () => {
  const { service, repositorio } = novoServico();
  const { dispositivo, codigo } = await service.criar({ nome: 'TV da Montagem', setorId: SETOR_MON.id });
  assert.match(codigo, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.equal(dispositivo.setor?.nome, 'Montagem');
  assert.equal(repositorio.linhas[0].codigoHash, codigosDeAcesso.resumo(normalizarCodigo(codigo)!));
  assert.equal(JSON.stringify(await service.listar()).includes(codigo), false);
  await assert.rejects(() => service.criar({ nome: 'TV da Montagem' }), erroCom('CONFLITO'));
  await assert.rejects(() => service.criar({ nome: 'TV 2', setorId: uuid(999) }), erroCom('ENTRADA_INVALIDA', /Setor não encontrado/));
});

test('TV: o código libera só TV ativa; código novo invalida o anterior', async () => {
  const { service } = novoServico();
  const { dispositivo, codigo } = await service.criar({ nome: 'TV A' });
  assert.equal((await service.autenticarCodigo(codigo.toLowerCase())).id, dispositivo.id);
  await assert.rejects(() => service.autenticarCodigo('ZZZZZ-ZZZZZ'), erroCom('NAO_AUTENTICADO'));
  await service.definirStatus(dispositivo.id, false);
  await assert.rejects(() => service.autenticarCodigo(codigo), erroCom('NAO_AUTENTICADO'));
  assert.equal(await service.identificar(codigo), null);
  await service.definirStatus(dispositivo.id, true);
  const novo = await service.gerarNovoCodigo(dispositivo.id);
  assert.equal(await service.identificar(codigo), null);
  assert.equal((await service.identificar(novo.codigo))?.id, dispositivo.id);
  await assert.rejects(() => service.gerarNovoCodigo(uuid(999)), erroCom('NAO_ENCONTRADO'));
});

test('TV: a conexão é gravada no máximo a cada 10 s e aparece como online/offline na lista', async () => {
  const { service, repositorio, avancar } = novoServico();
  const { codigo } = await service.criar({ nome: 'TV A' });
  assert.equal((await service.listar())[0].conexao, 'NUNCA_CONECTOU');
  for (const passo of [0, 5_000, 4_000]) { avancar(passo); await service.registrarConexao((await service.identificar(codigo))!); }
  assert.equal(repositorio.conexoesGravadas, 1);
  avancar(1_000);
  await service.registrarConexao((await service.identificar(codigo))!);
  assert.equal(repositorio.conexoesGravadas, 2);
  assert.equal((await service.listar())[0].conexao, 'ONLINE');
  avancar(46_000);
  assert.equal((await service.listar())[0].conexao, 'OFFLINE');
});

// ---------- tela da TV ----------
const POSTOS: PostoDoPainel[] = [
  { id: uuid(1), codigo: 'MON-02', nome: 'Montagem 2', setor: SETOR_MON },
  { id: uuid(2), codigo: 'MON-01', nome: 'Montagem 1', setor: SETOR_MON },
  { id: uuid(3), codigo: 'COR-01', nome: 'Corte 1', setor: SETOR_COR },
];
function execucao(id: string, postoId: string, status: 'EM_EXECUCAO' | 'PAUSADA'): ExecucaoAcompanhada {
  return {
    id, status, ordem: { id: 'o', numero: 'OP-0001', quantidade: 10, unidade: 'un' }, produto: { codigo: 'PRD-001', nome: 'Produto A' },
    etapa: { id: 'e', ordem: 2, operacao: 'Montagem' }, posto: { id: postoId, codigo: 'x', nome: 'x' },
    eventos: [{ tipo: 'INICIO', dataHora: '2026-11-09T11:00:00.000Z', motivo: null }],
    operador: { matricula: 'OF-MON1', nome: 'Fulano de Tal' }, setor: 'Montagem', tempoPadraoSegundos: 60,
  };
}
const fontes: FontesDoPainel = {
  postosAtivos: async () => POSTOS,
  execucoesAbertas: async () => [execucao('a', uuid(1), 'PAUSADA'), execucao('b', uuid(3), 'EM_EXECUCAO')],
  indicadores: async () => ({
    producaoFinal: [{ produtoCodigo: 'PRD-001', unidade: 'un', quantidadeBoa: 28 }],
    porDia: [{ baixas: 2 }, { baixas: 1 }],
    cargaPorPosto: [
      { posto: { id: uuid(2), codigo: 'MON-01', nome: 'Montagem 1' }, cargaPendenteSegundos: 600, percentualDaCarga: 20 },
      { posto: { id: uuid(1), codigo: 'MON-02', nome: 'Montagem 2' }, cargaPendenteSegundos: 1800, percentualDaCarga: 60 },
      { posto: { id: uuid(3), codigo: 'COR-01', nome: 'Corte 1' }, cargaPendenteSegundos: 600, percentualDaCarga: 20 },
    ],
  }),
};
const tvMontagem: Dispositivo = { id: uuid(50), nome: 'TV da Montagem', local: null, setor: SETOR_MON, ativo: true, ultimaConexaoEm: null, createdAt: '', updatedAt: '' };

test('TV: mostra só os postos do setor dela, com a situação de cada um, e sem nome de operador', async () => {
  const painel = await montarPainelTv(tvMontagem, fontes, Date.parse('2026-11-09T12:00:00.000Z'), 15);
  assert.deepEqual(painel.postos.map((p) => [p.codigo, p.situacao]), [['MON-01', 'LIVRE'], ['MON-02', 'PAUSADA']]);
  assert.deepEqual(painel.cargaPorPosto.map((c) => c.codigo), ['MON-02', 'MON-01']);
  assert.deepEqual(painel.producaoHoje, { pecasBoas: [{ produtoCodigo: 'PRD-001', unidade: 'un', quantidadeBoa: 28 }], baixas: 3 });
  const texto = JSON.stringify(painel);
  assert.equal(texto.includes('Fulano'), false);
  assert.equal(texto.includes('OF-MON1'), false);
  assert.deepEqual(lerPainelTv(JSON.parse(texto)).dispositivo, { nome: 'TV da Montagem', local: null, setor: 'Montagem' });
  const todos = await montarPainelTv({ ...tvMontagem, setor: null }, fontes, Date.parse('2026-11-09T12:00:00.000Z'), 15);
  assert.deepEqual(todos.postos.map((p) => [p.codigo, p.situacao]), [['COR-01', 'EM_EXECUCAO'], ['MON-01', 'LIVRE'], ['MON-02', 'PAUSADA']]);
});

test('TV: "hoje" começa à meia-noite de Brasília', () => {
  // 02:30 UTC do dia 09 ainda é dia 08 em Brasília (23:30).
  assert.deepEqual(janelaDeHoje(Date.parse('2026-11-09T02:30:00.000Z')), { inicioMs: Date.parse('2026-11-08T03:00:00.000Z'), fimMs: Date.parse('2026-11-09T02:30:00.000Z') + 1 });
  assert.equal(janelaDeHoje(Date.parse('2026-11-09T15:00:00.000Z')).inicioMs, Date.parse('2026-11-09T03:00:00.000Z'));
});

test('TV: páginas de postos se alternam quando não cabem numa tela', () => {
  const muitos = Array.from({ length: POSTOS_POR_PAGINA + 2 }, (_, i) => ({ codigo: `P-${i}`, nome: '', setor: '', situacao: 'LIVRE' as const, execucoes: [] }));
  assert.deepEqual([paginarPostos(muitos, 0).itens.length, paginarPostos(muitos, 1).itens.length, paginarPostos(muitos, 2).atual], [POSTOS_POR_PAGINA, 2, 0]);
  assert.deepEqual(paginarPostos([], 5), { itens: [], total: 1, atual: 0 });
  assert.deepEqual(resumoDosPostos([{ ...muitos[0], situacao: 'EM_EXECUCAO' }, muitos[1]]), { emExecucao: 1, pausados: 0, livres: 1 });
  assert.throws(() => lerPainelTv({ meta: {} }), /Resposta inválida/);
});

// ---------- rotas ----------
test('TV: o cadastro exige administrador e devolve o código só na criação', async () => {
  const { service } = novoServico();
  const negar = criarHandlersDispositivos({ autorizar: async () => { throw new ErroDeAcesso('NAO_AUTENTICADO', 'Autenticação obrigatória.'); }, dispositivos: service });
  assert.equal((await negar.GET()).status, 401);
  const handlers = criarHandlersDispositivos({ autorizar: async () => ({ id: 'adm' }), dispositivos: service });
  const criado = await handlers.POST(new Request('http://local/api/dispositivos', { method: 'POST', body: JSON.stringify({ nome: 'TV A', setorId: SETOR_MON.id }) }));
  assert.equal(criado.status, 201);
  const corpo = await criado.json();
  assert.match(corpo.codigo, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.equal(JSON.stringify(await (await handlers.GET()).json()).includes(corpo.codigo), false);
  assert.equal((await handlers.POST(new Request('http://local', { method: 'POST', body: JSON.stringify({ nome: 'TV B', codigoHash: 'x' }) }))).status, 400);
  assert.equal((await handlers.PATCH_STATUS(new Request('http://local', { method: 'PATCH', body: '{"ativo":"sim"}' }), corpo.dispositivo.id)).status, 400);
});

test('TV: liberação pelo código com espera no erro, cookie HttpOnly e dados só para TV liberada', async () => {
  const { service, repositorio } = novoServico();
  const { codigo } = await service.criar({ nome: 'TV A', setorId: SETOR_MON.id });
  let esperas = 0;
  const tv = criarHandlersTv({ dispositivos: service, fontes, agora: () => new Date('2026-11-09T12:00:00.000Z'), esperarAposErro: async () => { esperas++; } });
  const errado = await tv.ACESSO_POST(new Request('http://local/api/tv/acesso', { method: 'POST', body: JSON.stringify({ codigo: 'ZZZZZ-ZZZZZ' }) }));
  assert.deepEqual([errado.status, esperas, errado.headers.get('set-cookie')], [401, 1, null]);
  const certo = await tv.ACESSO_POST(new Request('http://local/api/tv/acesso', { method: 'POST', body: JSON.stringify({ codigo: codigo.toLowerCase() }) }));
  assert.equal(certo.status, 204);
  const cookie = certo.headers.get('set-cookie') ?? '';
  assert.match(cookie, new RegExp(`^${COOKIE_TV}=${normalizarCodigo(codigo)};`));
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);

  assert.equal((await tv.PAINEL_GET(new Request('http://local/api/tv/painel'))).status, 401);
  assert.equal((await tv.PAINEL_GET(new Request('http://local/api/tv/painel', { headers: { cookie: `${COOKIE_TV}=XXXXXXXXXX` } }))).status, 401);
  const painel = await tv.PAINEL_GET(new Request('http://local/api/tv/painel', { headers: { cookie: cookie.split(';')[0] } }));
  assert.equal(painel.status, 200);
  assert.equal(painel.headers.get('cache-control'), 'no-store');
  assert.equal((await painel.json()).postos.length, 2);
  assert.ok(repositorio.linhas[0].ultimaConexaoEm, 'a busca dos dados registra a conexão');

  await service.definirStatus(repositorio.linhas[0].id, false);
  assert.equal((await tv.PAINEL_GET(new Request('http://local/api/tv/painel', { headers: { cookie: cookie.split(';')[0] } }))).status, 401);
  assert.match((await tv.ACESSO_DELETE().headers.get('set-cookie')) ?? '', /Max-Age=0/);
});
