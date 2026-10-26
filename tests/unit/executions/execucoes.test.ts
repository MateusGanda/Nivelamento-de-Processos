import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecucoesService } from '../../../modules/executions/application/execucoes.ts';
import type { ExecucaoRepository, SituacaoDestino } from '../../../modules/executions/application/contracts.ts';
import { ErroDeExecucao, validarBaixa, type Baixa, type Destino, type ExecucaoAberta, type StatusExecucao, type TipoEvento } from '../../../modules/executions/domain/execucao.ts';
import { traduzirErroGravacaoExecucao } from '../../../modules/executions/infrastructure/persistence-errors.ts';
import { criarChaveIlha } from '../../../modules/executions/infrastructure/chave-ilha.ts';
import { COOKIE_ILHA, criarHandlersIlha } from '../../../modules/executions/presentation/http.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ORDEM = uuid(1);
const ETAPA1 = uuid(11);
const ETAPA2 = uuid(12);
const ETAPA_OUTRO_ROTEIRO = uuid(19);
const POSTO1 = uuid(21);
const POSTO2 = uuid(22);
const POSTO_INATIVO = uuid(23);
const MOTIVO = uuid(31);
const MOTIVO_INATIVO = uuid(32);
const ANA = { id: uuid(41), matricula: 'AS-MON1', nome: 'Ana Souza', ativo: true, setor: 'Montagem' };
const BIA = { id: uuid(42), matricula: 'BL-MON1', nome: 'Bia Lima', ativo: true, setor: 'Montagem' };
const CAIO = { id: uuid(43), matricula: 'CR-MON1', nome: 'Caio Reis', ativo: false, setor: null };

type Linha = { id: string; operadorId: string; status: StatusExecucao; destino: Destino; tipoFinalizacao: string | null; baixa: Baixa | null; eventos: { tipo: TipoEvento; dataHora: string; motivoId: string | null }[] };

class RepositorioEmMemoria implements ExecucaoRepository {
  execucoes: Linha[] = [];
  private seq = 0;
  // Compatibilidade etapa → postos e qual posto está ativo.
  compativeis: Record<string, string[]> = { [ETAPA1]: [POSTO1, POSTO2, POSTO_INATIVO], [ETAPA2]: [POSTO2] };
  async buscarOperador(matricula: string) { return [ANA, BIA, CAIO].find((o) => o.matricula === matricula) ?? null; }
  async buscarExecucaoAberta(operadorId: string): Promise<ExecucaoAberta | null> {
    const e = this.execucoes.find((item) => item.operadorId === operadorId && item.status !== 'FINALIZADA');
    if (!e || e.status === 'FINALIZADA') return null;
    return {
      id: e.id, status: e.status, ordem: { id: ORDEM, numero: 'OP-0001', quantidade: 40, unidade: 'un' }, produto: { codigo: 'PRD-001', nome: 'Produto A' },
      etapa: { id: e.destino.etapaId, ordem: e.destino.etapaId === ETAPA1 ? 1 : 2, operacao: e.destino.etapaId === ETAPA1 ? 'Corte' : 'Montagem' },
      posto: { id: e.destino.postoId, codigo: 'P', nome: 'Posto' }, eventos: e.eventos.map((ev) => ({ tipo: ev.tipo, dataHora: ev.dataHora, motivo: ev.motivoId ? 'Falta de material' : null })),
    };
  }
  async buscarExecucao(id: string) { const e = this.execucoes.find((item) => item.id === id); return e ? { id: e.id, operadorId: e.operadorId, status: e.status, quantidadeOrdem: 40 } : null; }
  async listarOrdensDisponiveis() { return []; }
  async listarMotivosAtivos() { return [{ id: MOTIVO, nome: 'Falta de material' }]; }
  async buscarMotivo(id: string) { return id === MOTIVO ? { id, ativo: true } : id === MOTIVO_INATIVO ? { id, ativo: false } : null; }
  async conferirDestino(destino: Destino): Promise<SituacaoDestino> {
    const postoExiste = [POSTO1, POSTO2, POSTO_INATIVO].includes(destino.postoId);
    return {
      ordemExiste: destino.ordemId === ORDEM,
      etapaDaOrdem: [ETAPA1, ETAPA2].includes(destino.etapaId),
      etapaBaixada: this.execucoes.some((e) => e.tipoFinalizacao === 'BAIXA' && e.destino.ordemId === destino.ordemId && e.destino.etapaId === destino.etapaId),
      posto: postoExiste ? { ativo: destino.postoId !== POSTO_INATIVO, compativel: (this.compativeis[destino.etapaId] ?? []).includes(destino.postoId) } : null,
    };
  }
  private abrir(operadorId: string, destino: Destino, agora: string) {
    // Simula o índice único: uma execução aberta por operador.
    if (this.execucoes.some((e) => e.operadorId === operadorId && e.status !== 'FINALIZADA')) {
      return traduzirErroGravacaoExecucao({ code: '23505', constraint: 'Execucao_operador_aberta_unica_6ac54f96' });
    }
    const id = uuid(100 + ++this.seq);
    this.execucoes.push({ id, operadorId, status: 'EM_EXECUCAO', destino, tipoFinalizacao: null, baixa: null, eventos: [{ tipo: 'INICIO', dataHora: agora, motivoId: null }] });
    return id;
  }
  async iniciar(operadorId: string, destino: Destino, agora: string) { return this.abrir(operadorId, destino, agora); }
  private mudar(id: string, de: StatusExecucao, para: StatusExecucao) {
    const e = this.execucoes.find((item) => item.id === id && item.status === de);
    if (e) e.status = para;
    return e;
  }
  async pausar(id: string, motivoId: string, agora: string) {
    const e = this.mudar(id, 'EM_EXECUCAO', 'PAUSADA');
    e?.eventos.push({ tipo: 'PAUSA', dataHora: agora, motivoId });
    return !!e;
  }
  async retomar(id: string, agora: string) {
    const e = this.mudar(id, 'PAUSADA', 'EM_EXECUCAO');
    e?.eventos.push({ tipo: 'RETOMADA', dataHora: agora, motivoId: null });
    return !!e;
  }
  async trocar(id: string, operadorId: string, destino: Destino, agora: string) {
    const e = this.mudar(id, 'EM_EXECUCAO', 'FINALIZADA');
    if (!e) return null;
    e.tipoFinalizacao = 'TROCA_OPERACAO';
    e.eventos.push({ tipo: 'FINALIZACAO', dataHora: agora, motivoId: null });
    return this.abrir(operadorId, destino, agora);
  }
  async baixar(id: string, baixa: Baixa, agora: string) {
    const atual = this.execucoes.find((item) => item.id === id);
    if (atual && this.execucoes.some((e) => e.tipoFinalizacao === 'BAIXA' && e.destino.ordemId === atual.destino.ordemId && e.destino.etapaId === atual.destino.etapaId)) {
      return traduzirErroGravacaoExecucao({ code: '23505', constraint: 'Execucao_baixa_unica_d8d722ee' });
    }
    const e = this.mudar(id, 'EM_EXECUCAO', 'FINALIZADA');
    if (!e) return false;
    Object.assign(e, { tipoFinalizacao: 'BAIXA', baixa });
    e.eventos.push({ tipo: 'FINALIZACAO', dataHora: agora, motivoId: null });
    return true;
  }
}

let relogio = 0;
const novoServico = () => {
  const repositorio = new RepositorioEmMemoria();
  return { repositorio, service: new ExecucoesService(repositorio, () => new Date(Date.UTC(2026, 9, 26, 12, 0, relogio++))) };
};
const destino = (extra: Partial<Destino> = {}): Destino => ({ ordemId: ORDEM, etapaId: ETAPA1, postoId: POSTO1, ...extra });
const erroCom = (codigo: ErroDeExecucao['codigo'], mensagem?: RegExp) => (erro: unknown) =>
  erro instanceof ErroDeExecucao && erro.codigo === codigo && (!mensagem || mensagem.test(erro.message));
const baixaDe = (boa: number, retrabalho = 0, refugo = 0) => ({ quantidadeBoa: boa, quantidadeRetrabalho: retrabalho, quantidadeRefugo: refugo });

test('execução: identifica o operador ativo pela matrícula; inativo ou desconhecido não aponta', async () => {
  const { service } = novoServico();
  const ana = await service.identificar('  AS-MON1 ');
  assert.deepEqual([ana.nome, ana.setor, ana.execucaoAberta], ['Ana Souza', 'Montagem', null]);
  await assert.rejects(() => service.identificar('XX-0'), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.identificar('CR-MON1'), erroCom('CONFLITO', /inativo/));
  await assert.rejects(() => service.identificar('  '), erroCom('ENTRADA_INVALIDA'));
});

test('execução: fluxo completo início → pausa → retomada → baixa grava os eventos na ordem', async () => {
  const { service, repositorio } = novoServico();
  const iniciada = await service.iniciar('AS-MON1', destino());
  const id = iniciada.execucaoAberta!.id;
  assert.equal(iniciada.execucaoAberta!.status, 'EM_EXECUCAO');
  assert.equal((await service.pausar('AS-MON1', id, MOTIVO)).execucaoAberta!.status, 'PAUSADA');
  assert.equal((await service.retomar('AS-MON1', id)).execucaoAberta!.status, 'EM_EXECUCAO');
  const final = await service.baixar('AS-MON1', id, baixaDe(35, 3, 2));
  assert.equal(final.execucaoAberta, null);
  const linha = repositorio.execucoes[0];
  assert.deepEqual([linha.status, linha.tipoFinalizacao, linha.baixa], ['FINALIZADA', 'BAIXA', baixaDe(35, 3, 2)]);
  assert.deepEqual(linha.eventos.map((e) => e.tipo), ['INICIO', 'PAUSA', 'RETOMADA', 'FINALIZACAO']);
  assert.deepEqual(linha.eventos.map((e) => e.dataHora), [...linha.eventos.map((e) => e.dataHora)].sort());
  assert.equal(linha.eventos[1].motivoId, MOTIVO);
});

test('execução: um operador não tem duas execuções abertas, nem com a pausada', async () => {
  const { service } = novoServico();
  const { execucaoAberta } = await service.iniciar('AS-MON1', destino());
  await assert.rejects(() => service.iniciar('AS-MON1', destino({ etapaId: ETAPA2, postoId: POSTO2 })), erroCom('CONFLITO', /já tem uma execução aberta/));
  await service.pausar('AS-MON1', execucaoAberta!.id, MOTIVO);
  await assert.rejects(() => service.iniciar('AS-MON1', destino({ etapaId: ETAPA2, postoId: POSTO2 })), erroCom('CONFLITO', /já tem uma execução aberta/));
  // Outro operador pode trabalhar na mesma etapa ao mesmo tempo.
  assert.equal((await service.iniciar('BL-MON1', destino())).execucaoAberta!.status, 'EM_EXECUCAO');
});

test('execução: dois inícios simultâneos do mesmo operador abrem só uma execução', async () => {
  const { service, repositorio } = novoServico();
  const resultados = await Promise.allSettled([service.iniciar('AS-MON1', destino()), service.iniciar('AS-MON1', destino({ postoId: POSTO2 }))]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(repositorio.execucoes.length, 1);
});

test('execução: transições inválidas são recusadas e execução finalizada é terminal', async () => {
  const { service } = novoServico();
  const id = (await service.iniciar('AS-MON1', destino())).execucaoAberta!.id;
  await assert.rejects(() => service.retomar('AS-MON1', id), erroCom('CONFLITO', /em andamento/));
  await service.pausar('AS-MON1', id, MOTIVO);
  await assert.rejects(() => service.pausar('AS-MON1', id, MOTIVO), erroCom('CONFLITO', /pausada/));
  await assert.rejects(() => service.baixar('AS-MON1', id, baixaDe(40)), erroCom('CONFLITO', /pausada/));
  await assert.rejects(() => service.trocar('AS-MON1', id, destino({ etapaId: ETAPA2, postoId: POSTO2 })), erroCom('CONFLITO', /pausada/));
  await service.retomar('AS-MON1', id);
  await service.baixar('AS-MON1', id, baixaDe(40));
  for (const acao of [() => service.pausar('AS-MON1', id, MOTIVO), () => service.retomar('AS-MON1', id), () => service.baixar('AS-MON1', id, baixaDe(40))]) {
    await assert.rejects(acao, erroCom('CONFLITO', /finalizada/));
  }
});

test('execução: pausa exige motivo ativo; a matrícula só age sobre as próprias execuções', async () => {
  const { service } = novoServico();
  const id = (await service.iniciar('AS-MON1', destino())).execucaoAberta!.id;
  await assert.rejects(() => service.pausar('AS-MON1', id, undefined), erroCom('ENTRADA_INVALIDA', /motivo/));
  await assert.rejects(() => service.pausar('AS-MON1', id, MOTIVO_INATIVO), erroCom('ENTRADA_INVALIDA', /inativo/));
  await assert.rejects(() => service.pausar('AS-MON1', id, uuid(999)), erroCom('ENTRADA_INVALIDA', /não encontrado/));
  await assert.rejects(() => service.pausar('BL-MON1', id, MOTIVO), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.retomar('AS-MON1', 'execucao-1'), erroCom('NAO_ENCONTRADO'));
});

test('execução: destino precisa de ordem, etapa da ordem, posto ativo e compatível, e etapa sem baixa', async () => {
  const { service } = novoServico();
  for (const [dados, codigo, mensagem] of [
    [destino({ ordemId: uuid(9) }), 'ENTRADA_INVALIDA', /Ordem/],
    [destino({ etapaId: ETAPA_OUTRO_ROTEIRO }), 'ENTRADA_INVALIDA', /não pertence/],
    [destino({ postoId: uuid(29) }), 'ENTRADA_INVALIDA', /Posto não encontrado/],
    [destino({ postoId: POSTO_INATIVO }), 'ENTRADA_INVALIDA', /inativo/],
    [destino({ etapaId: ETAPA2, postoId: POSTO1 }), 'ENTRADA_INVALIDA', /não está entre os postos/],
    [{ ...destino(), ordemId: 'op-1' }, 'ENTRADA_INVALIDA', /ordem válida/],
  ] as const) {
    await assert.rejects(() => service.iniciar('AS-MON1', dados), erroCom(codigo, mensagem));
  }
  const id = (await service.iniciar('AS-MON1', destino())).execucaoAberta!.id;
  await service.baixar('AS-MON1', id, baixaDe(40));
  await assert.rejects(() => service.iniciar('BL-MON1', destino()), erroCom('CONFLITO', /já teve baixa/));
});

test('execução: baixa exige a quantidade inteira da ordem, sem negativos, e só uma por etapa', async () => {
  const { service } = novoServico();
  const ana = (await service.iniciar('AS-MON1', destino())).execucaoAberta!.id;
  const bia = (await service.iniciar('BL-MON1', destino({ postoId: POSTO2 }))).execucaoAberta!.id;
  for (const [baixa, mensagem] of [
    [baixaDe(39), /precisa ser igual/], [baixaDe(41), /precisa ser igual/], [baixaDe(50, -10), /zero ou maior/],
    [baixaDe(39.999, 0.001), /duas casas/], [{ quantidadeBoa: '40', quantidadeRetrabalho: 0, quantidadeRefugo: 0 }, /zero ou maior/],
    [{ quantidadeBoa: 40 }, /zero ou maior/],
  ] as const) {
    await assert.rejects(() => service.baixar('AS-MON1', ana, baixa), erroCom('ENTRADA_INVALIDA', mensagem));
  }
  await service.baixar('AS-MON1', ana, baixaDe(39.5, 0.25, 0.25));
  // A segunda execução da mesma etapa não consegue dar outra baixa.
  await assert.rejects(() => service.baixar('BL-MON1', bia, baixaDe(40)), erroCom('CONFLITO', /já teve baixa/));
  assert.deepEqual(validarBaixa(baixaDe(0, 0, 40), 40), baixaDe(0, 0, 40));
});

test('execução: troca de operação finaliza sem quantidades e abre a próxima junto', async () => {
  const { service, repositorio } = novoServico();
  const id = (await service.iniciar('AS-MON1', destino())).execucaoAberta!.id;
  const depois = await service.trocar('AS-MON1', id, destino({ etapaId: ETAPA2, postoId: POSTO2 }));
  assert.equal(depois.execucaoAberta!.etapa.operacao, 'Montagem');
  const [anterior, nova] = repositorio.execucoes;
  assert.deepEqual([anterior.status, anterior.tipoFinalizacao, anterior.baixa], ['FINALIZADA', 'TROCA_OPERACAO', null]);
  assert.deepEqual([nova.status, nova.eventos.map((e) => e.tipo)], ['EM_EXECUCAO', ['INICIO']]);
  assert.equal(anterior.eventos.at(-1)!.dataHora, nova.eventos[0].dataHora);
  // Destino inválido não finaliza a execução atual.
  await assert.rejects(() => service.trocar('AS-MON1', nova.id, destino({ etapaId: ETAPA2, postoId: POSTO1 })), erroCom('ENTRADA_INVALIDA'));
  assert.equal(repositorio.execucoes[1].status, 'EM_EXECUCAO');
});

test('execução: traduz os índices únicos com sufixo, inclusive na cadeia cause', () => {
  assert.throws(() => traduzirErroGravacaoExecucao({ cause: { code: '23505', constraint: 'Execucao_operador_aberta_unica_6ac54f96' } }), erroCom('CONFLITO', /execução aberta/));
  assert.throws(() => traduzirErroGravacaoExecucao({ sqlState: '23505', constraint: 'Execucao_baixa_unica_d8d722ee' }), erroCom('CONFLITO', /baixa/));
  const outro = { code: '23505', constraint: 'Outra_key' };
  assert.throws(() => traduzirErroGravacaoExecucao(outro), (erro: unknown) => erro === outro);
});

const CHAVE = 'chave-de-teste-com-tamanho';
const pedido = (url: string, method = 'GET', corpo?: unknown, cookie?: string) => new Request(`http://localhost${url}`, {
  method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: corpo === undefined ? undefined : JSON.stringify(corpo),
});

test('ilha: chave curta ou ausente desativa; a credencial depende da chave', () => {
  assert.equal(criarChaveIlha(undefined).configurada, false);
  assert.equal(criarChaveIlha('curta').configurada, false);
  const chave = criarChaveIlha(CHAVE);
  assert.equal(chave.confere(CHAVE), true);
  assert.equal(chave.confere('outra-chave-qualquer-x'), false);
  assert.equal(chave.credencialValida(chave.credencial()), true);
  assert.equal(chave.credencialValida(criarChaveIlha('outra-chave-com-tamanho').credencial()), false);
  assert.equal(chave.credencialValida(undefined), false);
});

test('ilha: só o terminal liberado pela chave chega à API; a sessão administrativa não basta', async () => {
  const { service } = novoServico();
  let esperas = 0;
  const handlers = criarHandlersIlha({ chave: () => criarChaveIlha(CHAVE), execucoes: service, esperarAposErro: async () => { esperas++; } });
  assert.equal((await handlers.OPERADOR_GET(pedido('/api/ilha/operadores/AS-MON1'), 'AS-MON1')).status, 401);
  assert.equal((await handlers.OPERADOR_GET(pedido('/api/ilha/operadores/AS-MON1', 'GET', undefined, 'next-auth.session-token=abc'), 'AS-MON1')).status, 401);
  assert.equal((await handlers.ACESSO_POST(pedido('/api/ilha/acesso', 'POST', { chave: 'errada-com-tamanho-suficiente' }))).status, 401);
  assert.equal(esperas, 1);
  const liberado = await handlers.ACESSO_POST(pedido('/api/ilha/acesso', 'POST', { chave: CHAVE }));
  assert.equal(liberado.status, 204);
  const setCookie = liberado.headers.get('Set-Cookie')!;
  assert.match(setCookie, new RegExp(`^${COOKIE_ILHA}=[^;]+; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`));
  const cookie = setCookie.split(';')[0];
  assert.deepEqual(await handlers.ACESSO_GET(pedido('/api/ilha/acesso', 'GET', undefined, cookie)).json(), { configurada: true, liberado: true });
  const operador = await handlers.OPERADOR_GET(pedido('/api/ilha/operadores/AS-MON1', 'GET', undefined, cookie), 'AS-MON1');
  assert.equal(operador.status, 200);
  assert.equal((await operador.json()).nome, 'Ana Souza');
  // Trocar a chave no servidor bloqueia o terminal já liberado.
  const outraChave = criarHandlersIlha({ chave: () => criarChaveIlha('nova-chave-com-tamanho'), execucoes: service });
  assert.equal((await outraChave.MOTIVOS_GET(pedido('/api/ilha/motivos', 'GET', undefined, cookie))).status, 401);
  assert.match(handlers.ACESSO_DELETE().headers.get('Set-Cookie')!, /Max-Age=0/);
  const semChave = criarHandlersIlha({ chave: () => criarChaveIlha(undefined), execucoes: service });
  assert.equal((await semChave.ACESSO_POST(pedido('/api/ilha/acesso', 'POST', { chave: CHAVE }))).status, 503);
  assert.equal((await semChave.ORDENS_GET(pedido('/api/ilha/ordens', 'GET', undefined, cookie))).status, 503);
});

test('ilha: ações pela API respondem 201, 200, 400, 404 e 409 e recusam campos extras', async () => {
  const { service } = novoServico();
  const handlers = criarHandlersIlha({ chave: () => criarChaveIlha(CHAVE), execucoes: service, esperarAposErro: async () => {} });
  const cookie = `${COOKIE_ILHA}=${criarChaveIlha(CHAVE).credencial()}`;
  const iniciar = await handlers.INICIAR_POST(pedido('/api/ilha/execucoes', 'POST', { matricula: 'AS-MON1', ...destino() }, cookie));
  assert.equal(iniciar.status, 201);
  const id = (await iniciar.json()).execucaoAberta.id;
  assert.equal((await handlers.INICIAR_POST(pedido('/api/ilha/execucoes', 'POST', { matricula: 'AS-MON1', ...destino() }, cookie))).status, 409);
  assert.equal((await handlers.INICIAR_POST(pedido('/api/ilha/execucoes', 'POST', { matricula: 'AS-MON1', ...destino(), operadorId: ANA.id }, cookie))).status, 400);
  assert.equal((await handlers.PAUSA_POST(pedido('/x', 'POST', { matricula: 'AS-MON1', motivoId: MOTIVO, dataHora: '2026-01-01T00:00:00Z' }, cookie), id)).status, 400);
  assert.equal((await handlers.PAUSA_POST(pedido('/x', 'POST', { matricula: 'AS-MON1', motivoId: MOTIVO }, cookie), id)).status, 200);
  assert.equal((await handlers.RETOMADA_POST(pedido('/x', 'POST', { matricula: 'AS-MON1' }, cookie), id)).status, 200);
  assert.equal((await handlers.BAIXA_POST(pedido('/x', 'POST', { matricula: 'AS-MON1', ...baixaDe(10) }, cookie), id)).status, 400);
  assert.equal((await handlers.BAIXA_POST(pedido('/x', 'POST', { matricula: 'BL-MON1', ...baixaDe(40) }, cookie), id)).status, 404);
  const baixa = await handlers.BAIXA_POST(pedido('/x', 'POST', { matricula: 'AS-MON1', ...baixaDe(40) }, cookie), id);
  assert.equal(baixa.status, 200);
  assert.equal((await baixa.json()).execucaoAberta, null);
  assert.equal((await handlers.RETOMADA_POST(pedido('/x', 'POST', { matricula: 'AS-MON1' }, cookie), id)).status, 409);
  assert.equal((await handlers.OPERADOR_GET(pedido('/x', 'GET', undefined, cookie), 'NAO-EXISTE')).status, 404);
  const falha = async () => { throw new Error('connect ECONNREFUSED'); };
  const quebrado = criarHandlersIlha({ chave: () => criarChaveIlha(CHAVE), execucoes: {
    identificar: falha, listarOrdensDisponiveis: falha, listarMotivos: falha, iniciar: falha, pausar: falha, retomar: falha, trocar: falha, baixar: falha,
  } });
  const resposta = await quebrado.ORDENS_GET(pedido('/x', 'GET', undefined, cookie));
  assert.equal(resposta.status, 500);
  assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
});
