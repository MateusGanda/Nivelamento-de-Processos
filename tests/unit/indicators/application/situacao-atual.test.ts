// Dados fictícios. Testa o caso de uso com repositório em memória, sem banco, API ou tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IndicadoresService } from '../../../../modules/indicators/application/indicadores.ts';
import type { RegistrosDeProducao } from '../../../../modules/indicators/application/contracts.ts';
import { DIA_06, RepositorioEmMemoria, baixa, base, instante, ordem } from './registros-ficticios.ts';

const consultar = (dados: RegistrosDeProducao, periodo = DIA_06) => new IndicadoresService(new RepositorioEmMemoria(dados)).consultarSituacaoAtual(periodo);

test('SIT-01: posição das ordens — etapa atual, execução aberta e última baixa', async () => {
  const { ordens } = await consultar(base());
  assert.deepEqual(ordens.map((o) => o.numero), ['0001', '0002', '0004']);
  assert.deepEqual(ordens[0], {
    ordemId: 'ordem-0001', numero: '0001', produtoCodigo: 'P-100', produtoNome: 'Produto A', quantidade: 40, unidade: 'un', planoCodigo: 'PL-01',
    etapasTotal: 3, etapasBaixadas: 1, etapasInconsistentes: 0,
    etapaAtual: { etapaRoteiroId: 'etapa-2', ordem: 2, operacaoNome: 'Montagem' },
    emExecucao: true, ultimaBaixaEm: '2026-10-06T11:30:00.000Z',
  });
  assert.deepEqual([ordens[1].etapasBaixadas, ordens[1].etapaAtual?.operacaoNome, ordens[1].emExecucao, ordens[1].ultimaBaixaEm], [0, 'Corte', false, null]);
});

test('SIT-02: baixa com soma diferente conta como sem baixa e vira pendência', async () => {
  const { ordens, pendencias } = await consultar(base());
  const o = ordens[2];
  assert.deepEqual([o.numero, o.etapasBaixadas, o.etapasInconsistentes, o.etapaAtual?.ordem, o.ultimaBaixaEm], ['0004', 0, 1, 1, null]);
  assert.deepEqual(pendencias.filter((p) => p.codigo === 'BAIXA_INCONSISTENTE'), [{ codigo: 'BAIXA_INCONSISTENTE', ordemId: 'ordem-0004', etapaRoteiroId: 'etapa-1' }]);
});

test('SIT-03: ordem concluída só aparece se teve baixa dentro do período', async () => {
  assert.equal((await consultar(base())).ordens.some((o) => o.numero === '0003'), false);
  const { ordens } = await consultar(base(), { inicioMs: instante('05', '08:00'), fimMs: instante('06', '18:00') });
  const o = ordens.find((x) => x.numero === '0003');
  assert.deepEqual([o?.etapasBaixadas, o?.etapaAtual, o?.emExecucao, o?.ultimaBaixaEm], [3, null, false, '2026-10-05T18:00:00.000Z']);
  // Fim do período é exclusivo: a baixa das 15:00 fica fora de 08:00–15:00.
  assert.equal((await consultar(base(), { inicioMs: instante('05', '11:01'), fimMs: instante('05', '15:00') })).ordens.some((x) => x.numero === '0003'), false);
});

test('CARGA-01: carga pendente por etapa = quantidade sem baixa × tempo padrão', async () => {
  const { cargaPendente } = await consultar(base());
  // Corte: 0002 (24) + 0004 (12,5) = 36,5 un × 60 s. Montagem e acabamento: 40 + 24 + 12,5 = 76,5 un.
  assert.deepEqual(cargaPendente, [
    { produtoCodigo: 'P-100', etapaRoteiroId: 'etapa-1', ordem: 1, operacaoNome: 'Corte', unidade: 'un', ordensPendentes: 2, quantidadePendente: 36.5, tempoPadraoSegundos: 60, cargaPendenteSegundos: 2190,
      postosCompativeis: [{ id: 'posto-1', codigo: 'P01', nome: 'Corte 1' }] },
    { produtoCodigo: 'P-100', etapaRoteiroId: 'etapa-2', ordem: 2, operacaoNome: 'Montagem', unidade: 'un', ordensPendentes: 3, quantidadePendente: 76.5, tempoPadraoSegundos: 100, cargaPendenteSegundos: 7650,
      postosCompativeis: [{ id: 'posto-2', codigo: 'P02', nome: 'Montagem 1' }, { id: 'posto-3', codigo: 'P03', nome: 'Montagem 2' }] },
    { produtoCodigo: 'P-100', etapaRoteiroId: 'etapa-3', ordem: 3, operacaoNome: 'Acabamento', unidade: 'un', ordensPendentes: 3, quantidadePendente: 76.5, tempoPadraoSegundos: null, cargaPendenteSegundos: null,
      postosCompativeis: [] },
  ]);
});

test('CARGA-02: sem tempo padrão ou sem posto a etapa gera uma pendência, sem repetir', async () => {
  const { pendencias } = await consultar(base());
  assert.deepEqual(pendencias.filter((p) => p.codigo !== 'BAIXA_INCONSISTENTE'), [
    { codigo: 'SEM_TEMPO_PADRAO', produtoCodigo: 'P-100', etapaRoteiroId: 'etapa-3' },
    { codigo: 'ETAPA_SEM_POSTO', etapaRoteiroId: 'etapa-3' },
  ]);
});

test('CARGA-03: quantidades de unidades diferentes não são somadas', async () => {
  const dados = base();
  const { cargaPendente } = await consultar({ ...dados, ordens: [ordem('0002', 24), ordem('0005', 3, 'cx')], execucoes: [] });
  assert.deepEqual(cargaPendente.filter((c) => c.etapaRoteiroId === 'etapa-1').map((c) => [c.unidade, c.quantidadePendente, c.cargaPendenteSegundos]), [['cx', 3, 180], ['un', 24, 1440]]);
});

test('POSTO-01: carga por posto — a etapa com dois postos divide a carga em partes iguais', async () => {
  const { cargaPorPosto } = await consultar(base());
  // Corte (2.190 s) só no P01. Montagem (7.650 s) em P02 e P03: 3.825 s cada. Acabamento não tem posto.
  assert.deepEqual(cargaPorPosto.map((c) => [c.posto.codigo, c.posto.nome, c.cargaPendenteSegundos]), [['P01', 'Corte 1', 2190], ['P02', 'Montagem 1', 3825], ['P03', 'Montagem 2', 3825]]);
  const percentuais = cargaPorPosto.map((c) => c.percentualDaCarga ?? NaN);
  assert.ok(Math.abs(percentuais[0] - (2190 / 9840) * 100) < 1e-9);
  assert.equal(percentuais[1], percentuais[2]);
  assert.ok(Math.abs(percentuais[0] + percentuais[1] + percentuais[2] - 100) < 1e-9);
});

test('POSTO-02: posto inativo não recebe carga; etapa só com posto inativo vira pendência', async () => {
  const dados = base();
  const postos = dados.postos.map((p) => ({ ...p, ativo: p.codigo === 'P02' }));
  const { cargaPorPosto, cargaPendente, pendencias } = await consultar({ ...dados, postos });
  assert.deepEqual(cargaPorPosto, [{ posto: { id: 'posto-2', codigo: 'P02', nome: 'Montagem 1' }, cargaPendenteSegundos: 7650, percentualDaCarga: 100 }]);
  assert.deepEqual(cargaPendente.map((c) => c.postosCompativeis.map((p) => p.codigo)), [[], ['P02'], []]);
  assert.deepEqual(pendencias.filter((p) => p.codigo === 'ETAPA_SEM_POSTO').map((p) => p.etapaRoteiroId).sort(), ['etapa-1', 'etapa-3']);
});

test('POSTO-03: etapa sem tempo padrão deixa a carga do posto e os percentuais indisponíveis', async () => {
  const dados = base();
  const postosDasEtapas = [...dados.postosDasEtapas, { etapaRoteiroId: 'etapa-3', postoId: 'posto-4' }];
  const { cargaPorPosto } = await consultar({ ...dados, postosDasEtapas });
  assert.deepEqual(cargaPorPosto.map((c) => [c.posto.codigo, c.cargaPendenteSegundos, c.percentualDaCarga]), [['P01', 2190, null], ['P02', 3825, null], ['P03', 3825, null], ['P04', null, null]]);
});

test('POSTO-04: posto sem trabalho pendente aparece com carga zero', async () => {
  const dados = base();
  const { cargaPorPosto } = await consultar({ ...dados, ordens: [ordem('0001', 40)] });
  // Só a 0001, com o corte já baixado: sobram 40 un × 100 s na montagem.
  assert.deepEqual(cargaPorPosto.map((c) => [c.posto.codigo, c.cargaPendenteSegundos, c.percentualDaCarga]), [['P01', 0, 0], ['P02', 2000, 50], ['P03', 2000, 50]]);
});

test('baixa com quantidade negativa é inconsistência, não erro da consulta', async () => {
  const dados = base();
  const { ordens } = await consultar({ ...dados, ordens: [ordem('0002', 24)], execucoes: [baixa('0002', 'etapa-1', 25, -1, 0, '06', '09:00')] });
  assert.deepEqual([ordens[0].etapasBaixadas, ordens[0].etapasInconsistentes], [0, 1]);
});

test('sem ordens o resultado é vazio, e período inválido é rejeitado antes de ler os registros', async () => {
  const vazio = await consultar({ ...base(), ordens: [] });
  assert.deepEqual([vazio.ordens, vazio.cargaPendente, vazio.pendencias], [[], [], []]);
  // Sem carga para repartir, os postos aparecem com zero e sem percentual.
  assert.deepEqual(vazio.cargaPorPosto.map((c) => [c.posto.codigo, c.cargaPendenteSegundos, c.percentualDaCarga]), [['P01', 0, null], ['P02', 0, null], ['P03', 0, null]]);
  const repositorio = new RepositorioEmMemoria(base());
  await assert.rejects(() => new IndicadoresService(repositorio).consultarSituacaoAtual({ inicioMs: DIA_06.fimMs, fimMs: DIA_06.inicioMs }), /Janela inválida/);
  assert.equal(repositorio.leituras, 0);
});
