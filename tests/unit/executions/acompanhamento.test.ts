import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecucoesService } from '../../../modules/executions/application/execucoes.ts';
import type { ExecucaoRepository } from '../../../modules/executions/application/contracts.ts';
import type { ExecucaoAcompanhada, EventoDaExecucao } from '../../../modules/executions/domain/execucao.ts';
import { criarHandlersAcompanhamento } from '../../../modules/executions/presentation/http-painel.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';
import {
  agoraDoServidor, filtrarExecucoes, formatarHorario, inicioDaExecucao, lerRespostaAcompanhamento, pausaAtual, setoresDasExecucoes, temposAteAgora,
} from '../../../modules/executions/presentation/acompanhamento.ts';

const t = (hora: string) => `2026-11-05T${hora}:00.000Z`;
const evento = (tipo: EventoDaExecucao['tipo'], hora: string, motivo: string | null = null): EventoDaExecucao => ({ tipo, dataHora: t(hora), motivo });

function execucao(id: string, mudancas: Partial<ExecucaoAcompanhada> = {}): ExecucaoAcompanhada {
  return {
    id, status: 'EM_EXECUCAO',
    ordem: { id: `ordem-${id}`, numero: 'OP-0001', quantidade: 40, unidade: 'un' }, produto: { codigo: 'PRD-001', nome: 'Produto A' },
    etapa: { id: `etapa-${id}`, ordem: 1, operacao: 'Corte' }, posto: { id: `posto-${id}`, codigo: 'PRE-01', nome: 'Corte 1' },
    eventos: [evento('INICIO', '11:00')], operador: { matricula: 'OF-PRE1', nome: 'Operador Fictício 1' }, setor: 'Preparação',
    ...mudancas,
  };
}

const servico = (lista: ExecucaoAcompanhada[]) => new ExecucoesService({ listarExecucoesAbertas: async () => lista } as unknown as ExecucaoRepository);

test('acompanhamento: a execução aberta há mais tempo vem primeiro', async () => {
  const lista = [
    execucao('c', { eventos: [evento('INICIO', '13:00')] }),
    execucao('a', { eventos: [evento('INICIO', '08:00'), evento('PAUSA', '09:00', 'Falta de material')], status: 'PAUSADA' }),
    execucao('b', { eventos: [evento('INICIO', '10:00')] }),
  ];
  assert.deepEqual((await servico(lista).listarAbertas()).map((e) => e.id), ['a', 'b', 'c']);
  assert.deepEqual(await servico([]).listarAbertas(), []);
});

test('acompanhamento: GET exige administrador e não aceita parâmetros', async () => {
  const lista = [execucao('a')];
  const negar = (codigo: 'NAO_AUTENTICADO' | 'SEM_AUTORIZACAO') => criarHandlersAcompanhamento({
    autorizar: async () => { throw new ErroDeAcesso(codigo, 'Sem acesso.'); }, execucoes: { listarAbertas: async () => lista },
  });
  const semLogin = await negar('NAO_AUTENTICADO').GET(new Request('http://local/api/execucoes'));
  assert.equal(semLogin.status, 401);
  assert.equal(JSON.stringify(await semLogin.json()).includes('OF-PRE1'), false);
  assert.equal((await negar('SEM_AUTORIZACAO').GET(new Request('http://local/api/execucoes'))).status, 403);

  const handlers = criarHandlersAcompanhamento({ autorizar: async () => ({ id: 'adm' }), execucoes: { listarAbertas: async () => lista } });
  const comParametro = await handlers.GET(new Request('http://local/api/execucoes?setor=x'));
  assert.equal(comParametro.status, 400);
  assert.equal((await comParametro.json()).erro.codigo, 'ENTRADA_INVALIDA');
});

test('acompanhamento: GET devolve a lista com o horário da consulta e sem cache', async () => {
  const handlers = criarHandlersAcompanhamento({
    autorizar: async () => ({ id: 'adm' }), execucoes: { listarAbertas: async () => [execucao('a')] }, agora: () => new Date(t('12:00')),
  });
  const resposta = await handlers.GET(new Request('http://local/api/execucoes'));
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get('cache-control'), 'no-store');
  const corpo = await resposta.json();
  assert.equal(corpo.meta.consultadoEm, t('12:00'));
  assert.deepEqual(lerRespostaAcompanhamento(corpo).execucoes.map((e) => e.operador.matricula), ['OF-PRE1']);
});

test('acompanhamento: erro interno não expõe detalhes', async () => {
  const handlers = criarHandlersAcompanhamento({ autorizar: async () => ({ id: 'adm' }), execucoes: { listarAbertas: async () => { throw new Error('senha do banco xyz'); } } });
  const resposta = await handlers.GET(new Request('http://local/api/execucoes'));
  assert.equal(resposta.status, 500);
  const texto = await resposta.text();
  assert.equal(texto.includes('xyz'), false);
  assert.equal(JSON.parse(texto).erro.codigo, 'ERRO_INTERNO');
});

test('acompanhamento: a tela recusa resposta malformada', () => {
  const valida = { meta: { consultadoEm: t('12:00') }, execucoes: [execucao('a')] };
  assert.equal(lerRespostaAcompanhamento(valida).execucoes.length, 1);
  const invalidas: unknown[] = [
    null, {}, { meta: { consultadoEm: 'ontem' }, execucoes: [] },
    { ...valida, execucoes: [{ ...execucao('a'), status: 'FINALIZADA' }] },
    { ...valida, execucoes: [{ ...execucao('a'), operador: null }] },
    { ...valida, execucoes: [{ ...execucao('a'), eventos: [] }] },
    { ...valida, execucoes: [{ ...execucao('a'), eventos: [{ tipo: 'INICIO', dataHora: 'x', motivo: null }] }] },
  ];
  for (const corpo of invalidas) assert.throws(() => lerRespostaAcompanhamento(corpo), /Resposta inválida/);
});

test('acompanhamento: filtros por setor e situação e lista de setores', () => {
  const lista = [
    execucao('a', { setor: 'Montagem', status: 'PAUSADA', eventos: [evento('INICIO', '08:00'), evento('PAUSA', '09:00', 'Falta de material')] }),
    execucao('b', { setor: 'Acabamento' }), execucao('c', { setor: 'Montagem' }),
  ];
  assert.deepEqual(setoresDasExecucoes(lista), ['Acabamento', 'Montagem']);
  assert.deepEqual(filtrarExecucoes(lista, { setor: null, situacao: 'todas' }).map((e) => e.id), ['a', 'b', 'c']);
  assert.deepEqual(filtrarExecucoes(lista, { setor: 'Montagem', situacao: 'todas' }).map((e) => e.id), ['a', 'c']);
  assert.deepEqual(filtrarExecucoes(lista, { setor: 'Montagem', situacao: 'PAUSADA' }).map((e) => e.id), ['a']);
  assert.deepEqual(filtrarExecucoes(lista, { setor: 'Acabamento', situacao: 'PAUSADA' }), []);
});

test('acompanhamento: início e pausa atual com o motivo da última pausa', () => {
  const pausada = execucao('a', {
    status: 'PAUSADA',
    eventos: [evento('INICIO', '08:00'), evento('PAUSA', '09:00', 'Falta de material'), evento('RETOMADA', '09:30'), evento('PAUSA', '10:00', 'Ajuste de máquina')],
  });
  assert.equal(inicioDaExecucao(pausada), t('08:00'));
  assert.deepEqual(pausaAtual(pausada), { motivo: 'Ajuste de máquina', desde: t('10:00') });
  assert.equal(pausaAtual(execucao('b')), null);
});

test('acompanhamento: tempos contados pelo relógio do servidor', () => {
  // O computador do administrador está 1 hora adiantado: só o tempo passado desde a resposta conta.
  const recebidoEm = Date.parse(t('13:00'));
  assert.equal(agoraDoServidor(t('12:00'), recebidoEm, recebidoEm + 90_000), Date.parse(t('12:00')) + 90_000);
  assert.equal(agoraDoServidor(t('12:00'), recebidoEm, recebidoEm - 5_000), Date.parse(t('12:00')));

  const pausada = execucao('a', { status: 'PAUSADA', eventos: [evento('INICIO', '11:00'), evento('PAUSA', '11:40', 'Falta de material')] });
  assert.deepEqual(temposAteAgora(pausada, Date.parse(t('12:00'))), { produtivoSegundos: 40 * 60, pausaSegundos: 20 * 60 });
  assert.deepEqual(temposAteAgora(execucao('b'), Date.parse(t('12:00'))), { produtivoSegundos: 60 * 60, pausaSegundos: 0 });
});

test('acompanhamento: horário no fuso de Brasília, com a data quando é de outro dia', () => {
  assert.equal(formatarHorario('2026-11-05T14:05:00.000Z', '2026-11-05T18:00:00.000Z'), '11:05');
  // 02:30 UTC do dia 05 ainda é dia 04 em Brasília.
  assert.equal(formatarHorario('2026-11-05T02:30:00.000Z', '2026-11-05T18:00:00.000Z'), '04/11 23:30');
});
