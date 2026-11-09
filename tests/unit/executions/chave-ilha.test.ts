import test from 'node:test';
import assert from 'node:assert/strict';
import { ChaveIlhaService, type ChaveIlhaRepository, type RegistroChaveIlha } from '../../../modules/executions/application/chave-ilha.ts';
import {
  ALFABETO_CHAVE, criarChaveIlha, criarChaveIlhaDoPainel, gerarChavePainel, normalizarChavePainel, resumoChavePainel,
} from '../../../modules/executions/infrastructure/chave-ilha.ts';
import { COOKIE_ILHA, criarHandlersIlha } from '../../../modules/executions/presentation/http.ts';
import { criarHandlersChaveIlha } from '../../../modules/executions/presentation/http-painel.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';

const SEGREDO = 'segredo-do-servidor-de-teste';
const CHAVE_AMBIENTE = 'chave-do-ambiente-com-tamanho';

class Repositorio implements ChaveIlhaRepository {
  linhas: { chaveHash: string; criadaEm: string; usuarioId: string }[] = [];
  private relogio = Date.parse('2026-11-09T12:00:00.000Z');
  async atual() {
    const ultima = this.linhas.at(-1);
    return ultima ? { chaveHash: ultima.chaveHash, criadaEm: ultima.criadaEm, criadaPor: { nome: `Usuário ${ultima.usuarioId}` } } : null;
  }
  async registrar(chaveHash: string, usuarioId: string): Promise<RegistroChaveIlha> {
    const criadaEm = new Date(this.relogio += 60_000).toISOString();
    this.linhas.push({ chaveHash, criadaEm, usuarioId });
    return { criadaEm, criadaPor: { nome: `Usuário ${usuarioId}` } };
  }
}

function novoServico(ambiente: string | null = CHAVE_AMBIENTE) {
  const repositorio = new Repositorio();
  const service = new ChaveIlhaService(repositorio, {
    doAmbiente: () => criarChaveIlha(ambiente ?? undefined),
    doPainel: (chaveHash) => criarChaveIlhaDoPainel(chaveHash, SEGREDO),
    gerar: () => { const chave = gerarChavePainel(); return { chave, chaveHash: resumoChavePainel(normalizarChavePainel(chave)!) }; },
  });
  return { repositorio, service };
}

// Serviço de execuções mínimo: só para conferir se o terminal passa pela verificação da chave.
const execucoes = { listarMotivos: async () => [{ id: 'm', nome: 'Falta de material' }] } as never;
const pedido = (url: string, method = 'GET', corpo?: unknown, cookie?: string) => new Request(`http://localhost${url}`, {
  method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: corpo === undefined ? undefined : JSON.stringify(corpo),
});

test('chave da ilha: gerada pelo sistema com 20 caracteres sem ambíguos, em quatro blocos', () => {
  const chave = gerarChavePainel();
  assert.match(chave, /^([A-Z2-9]{5}-){3}[A-Z2-9]{5}$/);
  assert.ok(!/[IO01]/.test(ALFABETO_CHAVE));
  assert.notEqual(gerarChavePainel(), chave);
  assert.equal(normalizarChavePainel(` ${chave.toLowerCase().replaceAll('-', ' ')} `), chave.replaceAll('-', ''));
  for (const invalida of ['ABCDE-FGH23', `${chave}A`, chave.replace(/.$/, '0'), 42, undefined]) assert.equal(normalizarChavePainel(invalida), null, String(invalida));
});

test('chave da ilha: o banco guarda só o resumo; o cookie depende do segredo do servidor', () => {
  const chave = gerarChavePainel();
  const resumo = resumoChavePainel(normalizarChavePainel(chave)!);
  assert.match(resumo, /^[0-9a-f]{64}$/);
  assert.equal(resumo.includes(chave.replaceAll('-', '')), false);
  const emUso = criarChaveIlhaDoPainel(resumo, SEGREDO);
  assert.equal(emUso.origem, 'PAINEL');
  assert.equal(emUso.confere(chave), true);
  assert.equal(emUso.confere(chave.toLowerCase().replaceAll('-', '')), true, 'aceita minúsculas e sem hífen');
  assert.equal(emUso.confere(gerarChavePainel()), false);
  assert.equal(emUso.confere(CHAVE_AMBIENTE), false);
  assert.equal(emUso.credencialValida(emUso.credencial()), true);
  // Com só uma cópia do banco (o resumo), sem o segredo, não dá para montar o cookie.
  assert.equal(emUso.credencialValida(criarChaveIlhaDoPainel(resumo, 'outro-segredo').credencial()), false);
  assert.equal(criarChaveIlhaDoPainel(resumo, undefined).configurada, false);
});

test('chave da ilha: sem chave no painel vale a do servidor; a primeira chave do painel passa a valer e derruba a antiga', async () => {
  const { service, repositorio } = novoServico();
  assert.deepEqual(await service.situacao(), { origem: 'AMBIENTE', trocadaEm: null, trocadaPor: null });
  const doAmbiente = await service.atual();
  assert.equal(doAmbiente.confere(CHAVE_AMBIENTE), true);
  const cookieAntigo = doAmbiente.credencial();

  const { chave, situacao } = await service.gerarNova('adm-1');
  assert.equal(situacao.origem, 'PAINEL');
  assert.equal(situacao.trocadaPor, 'Usuário adm-1');
  assert.equal(repositorio.linhas.length, 1);
  assert.equal(JSON.stringify(repositorio.linhas).includes(chave.replaceAll('-', '')), false, 'a chave não vai para o banco');
  const emUso = await service.atual();
  assert.equal(emUso.confere(chave), true);
  assert.equal(emUso.confere(CHAVE_AMBIENTE), false, 'a chave do servidor deixa de valer');
  assert.equal(emUso.credencialValida(cookieAntigo), false, 'terminais liberados antes ficam bloqueados');

  const segunda = await service.gerarNova('adm-2');
  const depois = await service.atual();
  assert.equal(depois.confere(segunda.chave), true);
  assert.equal(depois.confere(chave), false, 'a chave anterior do painel também deixa de valer');
  assert.equal(depois.credencialValida(emUso.credencial()), false);
  assert.equal((await service.situacao()).trocadaPor, 'Usuário adm-2');
});

test('chave da ilha: sem variável e sem chave no painel a ilha fica sem chave até o administrador gerar a primeira', async () => {
  const { service } = novoServico(null);
  assert.equal((await service.situacao()).origem, 'NENHUMA');
  assert.equal((await service.atual()).configurada, false);
  const { chave } = await service.gerarNova('adm-1');
  assert.equal((await service.atual()).confere(chave), true);
});

test('chave da ilha: só o administrador consulta ou gera; a chave aparece só na geração e não pode ser escolhida', async () => {
  const { service } = novoServico();
  const negar = criarHandlersChaveIlha({ autorizar: async () => { throw new ErroDeAcesso('NAO_AUTENTICADO', 'Autenticação obrigatória.'); }, chaves: service });
  assert.equal((await negar.GET()).status, 401);
  assert.equal((await negar.POST(pedido('/api/execucoes/chave-ilha', 'POST', {}))).status, 401);
  const inativo = criarHandlersChaveIlha({ autorizar: async () => { throw new ErroDeAcesso('SEM_AUTORIZACAO', 'Usuário sem acesso.'); }, chaves: service });
  assert.equal((await inativo.POST(pedido('/api/execucoes/chave-ilha', 'POST', {}))).status, 403);

  const handlers = criarHandlersChaveIlha({ autorizar: async () => ({ id: 'adm-1' }), chaves: service });
  assert.equal((await handlers.POST(pedido('/api/execucoes/chave-ilha', 'POST', { chave: 'MINHA-CHAVE-ESCOLHIDA' }))).status, 400);
  const gerada = await handlers.POST(pedido('/api/execucoes/chave-ilha', 'POST', {}));
  assert.equal(gerada.status, 201);
  assert.equal(gerada.headers.get('cache-control'), 'no-store');
  const corpo = await gerada.json();
  assert.match(corpo.chave, /^([A-Z2-9]{5}-){3}[A-Z2-9]{5}$/);
  assert.equal(corpo.situacao.origem, 'PAINEL');
  const consulta = await (await handlers.GET()).text();
  assert.equal(consulta.includes(corpo.chave), false, 'a consulta nunca devolve a chave');
  assert.equal((await handlers.POST(new Request('http://localhost/api/execucoes/chave-ilha', { method: 'POST' }))).status, 201, 'sem corpo também gera');
});

test('chave da ilha: gerar pelo painel bloqueia na hora o terminal liberado e a chave nova o libera de novo', async () => {
  const { service } = novoServico();
  const ilha = criarHandlersIlha({ chave: () => service.atual(), execucoes, esperarAposErro: async () => {} });
  const liberado = await ilha.ACESSO_POST(pedido('/api/ilha/acesso', 'POST', { chave: CHAVE_AMBIENTE }));
  assert.equal(liberado.status, 204);
  const cookie = liberado.headers.get('Set-Cookie')!.split(';')[0];
  assert.equal((await ilha.MOTIVOS_GET(pedido('/api/ilha/motivos', 'GET', undefined, cookie))).status, 200);

  const { chave } = await service.gerarNova('adm-1');
  assert.equal((await ilha.MOTIVOS_GET(pedido('/api/ilha/motivos', 'GET', undefined, cookie))).status, 401, 'terminal bloqueado na hora');
  assert.equal((await ilha.ACESSO_POST(pedido('/api/ilha/acesso', 'POST', { chave: CHAVE_AMBIENTE }))).status, 401, 'chave antiga recusada');
  const deNovo = await ilha.ACESSO_POST(pedido('/api/ilha/acesso', 'POST', { chave: chave.toLowerCase() }));
  assert.equal(deNovo.status, 204);
  const novoCookie = deNovo.headers.get('Set-Cookie')!.split(';')[0];
  assert.ok(novoCookie.startsWith(`${COOKIE_ILHA}=`));
  assert.equal((await ilha.MOTIVOS_GET(pedido('/api/ilha/motivos', 'GET', undefined, novoCookie))).status, 200);
  assert.deepEqual(await (await ilha.ACESSO_GET(pedido('/api/ilha/acesso', 'GET', undefined, novoCookie))).json(), { configurada: true, liberado: true });
});
