// Dados fictícios. Testa os blocos do período do caso de uso com repositório em memória.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IndicadoresService } from '../../../../modules/indicators/application/indicadores.ts';
import type { RegistrosDeProducao } from '../../../../modules/indicators/application/contracts.ts';
import { DIA_06, RepositorioEmMemoria, base, evento, instante, semQuantidades } from './registros-ficticios.ts';

const DIAS_05_06 = { inicioMs: instante('05', '08:00'), fimMs: instante('06', '18:00') };
const consultar = (dados: RegistrosDeProducao, periodo = DIA_06) => new IndicadoresService(new RepositorioEmMemoria(dados)).consultar(periodo);

test('PER-01: produção do período — só baixas válidas com finalização dentro dele', async () => {
  const { producao, producaoFinal } = await consultar(base());
  // No dia 06: a baixa do corte da 0001. A da 0004 tem soma errada; as da 0003 são do dia 05.
  assert.deepEqual(producao, [{
    produtoCodigo: 'P-100', etapaRoteiroId: 'etapa-1', ordem: 1, operacaoNome: 'Corte', ultimaEtapa: false, unidade: 'un',
    ordensBaixadas: 1, quantidadeBoa: 38, quantidadeRetrabalho: 1, quantidadeRefugo: 1,
  }]);
  assert.deepEqual(producaoFinal, []);
});

test('PER-02: produção final é a quantidade boa da última etapa, sem somar o mesmo lote nas etapas', async () => {
  const { producao, producaoFinal } = await consultar(base(), DIAS_05_06);
  assert.deepEqual(producao.map((p) => [p.etapaRoteiroId, p.ultimaEtapa, p.ordensBaixadas, p.quantidadeBoa, p.quantidadeRetrabalho, p.quantidadeRefugo]), [
    ['etapa-1', false, 2, 48, 1, 1],
    ['etapa-2', false, 1, 10, 0, 0],
    ['etapa-3', true, 1, 9, 1, 0],
  ]);
  assert.deepEqual(producaoFinal, [{ produtoCodigo: 'P-100', unidade: 'un', quantidadeBoa: 9 }]);
});

test('PER-03: tempos por posto — produtivo, pausa por motivo e execução aberta', async () => {
  const { tempos, pendencias } = await consultar(base());
  assert.deepEqual(tempos, [
    // P01: 0001 (08:00–08:30) e 0004 (08:00–09:00), simultâneas: tempo de execução somado.
    { posto: { id: 'posto-1', codigo: 'P01', nome: 'Corte 1', setorNome: 'Setor A' }, produtivoSegundos: 5400, pausaSegundos: 0, totalSegundos: 5400, pausasPorMotivo: [], execucoesFinalizadas: 2, execucoesAbertas: 0 },
    // P02: troca de operação, 09:00–09:20.
    { posto: { id: 'posto-2', codigo: 'P02', nome: 'Montagem 1', setorNome: 'Setor B' }, produtivoSegundos: 1200, pausaSegundos: 0, totalSegundos: 1200, pausasPorMotivo: [], execucoesFinalizadas: 1, execucoesAbertas: 0 },
    // P03: aberta desde 10:00, com pausa 10:30–10:40. O trecho depois da retomada não tem fim e fica de fora.
    { posto: { id: 'posto-3', codigo: 'P03', nome: 'Montagem 2', setorNome: 'Setor B' }, produtivoSegundos: 1800, pausaSegundos: 600, totalSegundos: 2400,
      pausasPorMotivo: [{ motivoNome: 'Falta de material', segundos: 600, ocorrencias: 1 }], execucoesFinalizadas: 0, execucoesAbertas: 1 },
  ]);
  assert.deepEqual(pendencias.filter((p) => p.codigo === 'EXECUCAO_ABERTA'), [{ codigo: 'EXECUCAO_ABERTA', execucaoId: 'exec-0001-aberta', postoId: 'posto-3' }]);
});

test('PER-04: tempos recortados ao período; posto sem execução no período não aparece', async () => {
  const { tempos } = await consultar(base(), { inicioMs: instante('06', '08:15'), fimMs: instante('06', '08:45') });
  // 0001: 08:15–08:30 (900 s) e finalizada no período. 0004: 08:15–08:45 (1.800 s), finalizada depois.
  assert.deepEqual(tempos.map((t) => [t.posto.codigo, t.produtivoSegundos, t.totalSegundos, t.execucoesFinalizadas, t.execucoesAbertas]), [['P01', 2700, 2700, 1, 0]]);
});

test('PER-05: tempo médio por unidade da execução inteira, comparado com o tempo padrão', async () => {
  const { tempoMedio } = await consultar(base());
  const segundosPorUnidade = 1800 / 38;
  assert.deepEqual(tempoMedio, [{
    produtoCodigo: 'P-100', etapaRoteiroId: 'etapa-1', operacaoNome: 'Corte', unidade: 'un', execucoesConsideradas: 1,
    produtivoSegundos: 1800, quantidadeBoa: 38, segundosPorUnidade, tempoPadraoSegundos: 60,
    diferencaSegundos: segundosPorUnidade - 60, percentualDoPadrao: (segundosPorUnidade / 60) * 100,
  }]);
});

test('PER-06: tempo médio ponderado pela quantidade; sem tempo padrão a comparação é indisponível', async () => {
  const { tempoMedio } = await consultar(base(), DIAS_05_06);
  // Corte: (1.800 s + 3.600 s) ÷ (38 + 10) = 112,5 s. Montagem: 10.800 s ÷ 10. Acabamento: 25.200 s ÷ 9.
  assert.deepEqual(tempoMedio.map((m) => [m.etapaRoteiroId, m.execucoesConsideradas, m.produtivoSegundos, m.segundosPorUnidade, m.diferencaSegundos, m.percentualDoPadrao]), [
    ['etapa-1', 2, 5400, 112.5, 52.5, 187.5],
    ['etapa-2', 1, 10800, 1080, 980, 1080],
    ['etapa-3', 1, 25200, 2800, null, null],
  ]);
});

test('PER-07: sequência de eventos inválida vira pendência e não derruba a consulta', async () => {
  const dados = base();
  const ruim = { id: 'exec-ruim', ordemProducaoId: 'ordem-0002', etapaRoteiroId: 'etapa-1', postoId: 'posto-1', tipoFinalizacao: null, ...semQuantidades, eventos: [evento('FINALIZACAO', '06', '09:00')] };
  const { tempos, pendencias } = await consultar({ ...dados, execucoes: [...dados.execucoes, ruim] });
  assert.equal(tempos.find((t) => t.posto.codigo === 'P01')?.produtivoSegundos, 5400);
  assert.deepEqual(pendencias.filter((p) => p.codigo === 'EVENTOS_INCONSISTENTES'), [{ codigo: 'EVENTOS_INCONSISTENTES', execucaoId: 'exec-ruim' }]);
});

test('consulta completa lê os registros uma vez e junta as pendências dos dois tipos de bloco', async () => {
  const repositorio = new RepositorioEmMemoria(base());
  const r = await new IndicadoresService(repositorio).consultar(DIA_06);
  assert.equal(repositorio.leituras, 1);
  assert.deepEqual(Object.keys(r), ['ordens', 'producao', 'producaoFinal', 'tempos', 'tempoMedio', 'cargaPendente', 'cargaPorPosto', 'pendencias']);
  assert.deepEqual(r.pendencias.map((p) => p.codigo), ['BAIXA_INCONSISTENTE', 'SEM_TEMPO_PADRAO', 'ETAPA_SEM_POSTO', 'EXECUCAO_ABERTA']);
  await assert.rejects(() => new IndicadoresService(repositorio).consultar({ inicioMs: DIA_06.fimMs, fimMs: DIA_06.inicioMs }), /Janela inválida/);
  assert.equal(repositorio.leituras, 1);
});
