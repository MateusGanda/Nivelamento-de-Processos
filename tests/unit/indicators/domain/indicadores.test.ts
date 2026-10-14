// Dados fictícios. Testes das fórmulas, sem banco, API ou tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { derivarIntervalos, calcularTempos, calcularTempoMedioPorUnidade, compararComTempoPadrao } from '../../../../modules/indicators/domain/tempos.ts';
import type { EventoTempo } from '../../../../modules/indicators/domain/tempos.ts';
import { calcularCargaPendente, distribuirCargaPorPosto } from '../../../../modules/indicators/domain/carga.ts';
import { somarResultados, conferirResultado, identificarBaixa, calcularPosicao, calcularProducaoFinal } from '../../../../modules/indicators/domain/producao.ts';

const instante = (hora: string) => Date.parse(`2026-10-06T${hora}:00-03:00`);
const janela = (inicio: string, fim: string) => ({ inicioMs: instante(inicio), fimMs: instante(fim) });
const evento = (tipo: EventoTempo['tipo'], hora: string, motivoPausaId: string | null = null): EventoTempo => ({ tipo, instanteMs: instante(hora), motivoPausaId });
const FALTA_MATERIAL = 'motivo-falta-material';
const AJUSTE = 'motivo-ajuste';
const execucao: EventoTempo[] = [
  evento('INICIO', '08:00'),
  evento('PAUSA', '08:40', FALTA_MATERIAL),
  evento('RETOMADA', '08:50'),
  evento('FINALIZACAO', '09:30'),
];

test('TEMPO-01: eventos geram 80 min produtivos, 10 de pausa e 120 s por unidade', () => {
  const { intervalos, aberta } = derivarIntervalos(execucao);
  assert.equal(aberta, false);
  assert.equal(intervalos.length, 3);
  const r = calcularTempos(intervalos, janela('08:00', '09:30'));
  assert.equal(r.produtivoSegundos, 4800);
  assert.equal(r.pausaSegundos, 600);
  assert.deepEqual(r.pausasPorMotivo, [{ motivoPausaId: FALTA_MATERIAL, segundos: 600, ocorrencias: 1 }]);
  assert.equal(calcularTempoMedioPorUnidade([{ produtivoSegundos: 4800, quantidadeBoa: 40 }]), 120);
});
test('TEMPO-02: recorte 08:30–09:00', () => {
  const r = calcularTempos(derivarIntervalos(execucao).intervalos, janela('08:30', '09:00'));
  assert.equal(r.produtivoSegundos, 1200);
  assert.equal(r.pausaSegundos, 600);
});
test('eventos fora de ordem são ordenados e a entrada não é alterada', () => {
  const entrada = [...execucao].reverse();
  const copia = structuredClone(entrada);
  assert.deepEqual(derivarIntervalos(entrada), derivarIntervalos(execucao));
  assert.deepEqual(entrada, copia);
});
test('execução aberta não recebe término presumido', () => {
  const emExecucao = derivarIntervalos(execucao.slice(0, 3));
  assert.equal(emExecucao.aberta, true);
  const r1 = calcularTempos(emExecucao.intervalos, janela('08:00', '12:00'));
  assert.equal(r1.produtivoSegundos, 2400);
  assert.equal(r1.pausaSegundos, 600);
  const pausada = derivarIntervalos(execucao.slice(0, 2));
  assert.equal(pausada.aberta, true);
  const r2 = calcularTempos(pausada.intervalos, janela('08:00', '12:00'));
  assert.equal(r2.produtivoSegundos, 2400);
  assert.equal(r2.pausaSegundos, 0);
  assert.deepEqual(derivarIntervalos([evento('INICIO', '08:00')]), { intervalos: [], aberta: true });
});
test('sequência de eventos fora das transições do modelo é rejeitada', () => {
  assert.throws(() => derivarIntervalos([]), /começa por INICIO/);
  assert.throws(() => derivarIntervalos([evento('PAUSA', '08:00', AJUSTE)]), /começa por INICIO/);
  assert.throws(() => derivarIntervalos([evento('INICIO', '08:00'), evento('INICIO', '08:10')]), /INICIO depois de INICIO/);
  assert.throws(() => derivarIntervalos([evento('INICIO', '08:00'), evento('RETOMADA', '08:10')]), /RETOMADA depois de INICIO/);
  assert.throws(() => derivarIntervalos([evento('INICIO', '08:00'), evento('PAUSA', '08:10', AJUSTE), evento('FINALIZACAO', '08:20')]), /FINALIZACAO depois de PAUSA/);
  assert.throws(() => derivarIntervalos([...execucao, evento('PAUSA', '09:40', AJUSTE)]), /PAUSA depois de FINALIZACAO/);
  assert.throws(() => derivarIntervalos([{ tipo: 'INICIO', instanteMs: NaN, motivoPausaId: null }]), /Instante inválido/);
});
test('pausa e retomada no mesmo instante não geram intervalo de duração zero', () => {
  const { intervalos } = derivarIntervalos([evento('INICIO', '08:00'), evento('PAUSA', '08:30', AJUSTE), evento('RETOMADA', '08:30'), evento('FINALIZACAO', '09:00')]);
  assert.equal(intervalos.length, 2);
  assert.equal(calcularTempos(intervalos, janela('08:00', '09:00')).produtivoSegundos, 3600);
});
test('pausas são agrupadas por motivo, e pausa sem motivo fica identificada', () => {
  const { intervalos } = derivarIntervalos([
    evento('INICIO', '08:00'), evento('PAUSA', '08:10', AJUSTE), evento('RETOMADA', '08:15'),
    evento('PAUSA', '08:30', FALTA_MATERIAL), evento('RETOMADA', '08:50'),
    evento('PAUSA', '09:00', AJUSTE), evento('RETOMADA', '09:05'),
    evento('PAUSA', '09:10'), evento('RETOMADA', '09:12'), evento('FINALIZACAO', '09:30'),
  ]);
  const r = calcularTempos(intervalos, janela('08:00', '09:30'));
  assert.equal(r.pausaSegundos, 1920);
  assert.equal(r.produtivoSegundos, 3480);
  assert.deepEqual(r.pausasPorMotivo, [
    { motivoPausaId: FALTA_MATERIAL, segundos: 1200, ocorrencias: 1 },
    { motivoPausaId: AJUSTE, segundos: 600, ocorrencias: 2 },
    { motivoPausaId: null, segundos: 120, ocorrencias: 1 },
  ]);
});
test('execuções simultâneas no mesmo posto somam tempo de execução', () => {
  const a = derivarIntervalos([evento('INICIO', '08:00'), evento('FINALIZACAO', '09:00')]).intervalos;
  const b = derivarIntervalos([evento('INICIO', '08:30'), evento('FINALIZACAO', '09:30')]).intervalos;
  assert.equal(calcularTempos([...a, ...b], janela('08:00', '10:00')).produtivoSegundos, 7200);
});
test('período sem registros dá zero, e período inválido é rejeitado', () => {
  assert.deepEqual(calcularTempos([], janela('08:00', '10:00')), { produtivoSegundos: 0, pausaSegundos: 0, totalSegundos: 0, pausasPorMotivo: [] });
  assert.equal(calcularTempos(derivarIntervalos(execucao).intervalos, janela('11:00', '12:00')).produtivoSegundos, 0);
  assert.throws(() => calcularTempos([], janela('10:00', '08:00')), /Janela inválida/);
});
test('TEMPO-03: tempo total é produtivo + pausa, no mesmo recorte do período', () => {
  const { intervalos } = derivarIntervalos(execucao);
  assert.equal(calcularTempos(intervalos, janela('08:00', '09:30')).totalSegundos, 5400);
  // 08:30–09:00: 10 min produtivos + 10 de pausa + 10 produtivos.
  assert.equal(calcularTempos(intervalos, janela('08:30', '09:00')).totalSegundos, 1800);
});
test('TEMPO-04: comparação com o tempo padrão — diferença e percentual', () => {
  assert.deepEqual(compararComTempoPadrao(120, 100), { diferencaSegundos: 20, percentualDoPadrao: 120 });
  assert.deepEqual(compararComTempoPadrao(90, 120), { diferencaSegundos: -30, percentualDoPadrao: 75 });
  assert.equal(compararComTempoPadrao(null, 100), null);
  assert.equal(compararComTempoPadrao(120, null), null);
  assert.throws(() => compararComTempoPadrao(120, 0), /positivo/);
  assert.throws(() => compararComTempoPadrao(-1, 100));
});
test('tempo médio é ponderado pela quantidade e aceita decimais', () => {
  assert.equal(calcularTempoMedioPorUnidade([{ produtivoSegundos: 600, quantidadeBoa: 10 }, { produtivoSegundos: 600, quantidadeBoa: 30 }]), 30);
  assert.equal(calcularTempoMedioPorUnidade([{ produtivoSegundos: 250, quantidadeBoa: 12.5 }]), 20);
  assert.equal(calcularTempoMedioPorUnidade([{ produtivoSegundos: 600, quantidadeBoa: 0 }]), null);
  assert.equal(calcularTempoMedioPorUnidade([]), null);
});

test('resultado da baixa: soma exata em duas casas e conferência com a ordem', () => {
  assert.deepEqual(somarResultados([{ quantidadeBoa: 0.1, quantidadeRetrabalho: 0, quantidadeRefugo: 0 }, { quantidadeBoa: 0.2, quantidadeRetrabalho: 0, quantidadeRefugo: 0 }]),
    { quantidadeBoa: 0.3, quantidadeRetrabalho: 0, quantidadeRefugo: 0, total: 0.3 });
  assert.deepEqual(conferirResultado(40, { quantidadeBoa: 38, quantidadeRetrabalho: 1, quantidadeRefugo: 1 }), { total: 40, diferenca: 0, confere: true });
  assert.deepEqual(conferirResultado(40, { quantidadeBoa: 38, quantidadeRetrabalho: 1, quantidadeRefugo: 0 }), { total: 39, diferenca: 1, confere: false });
  assert.deepEqual(conferirResultado(12.5, { quantidadeBoa: 12.25, quantidadeRetrabalho: 0.25, quantidadeRefugo: 0 }), { total: 12.5, diferenca: 0, confere: true });
  assert.deepEqual(conferirResultado(40, { quantidadeBoa: 0, quantidadeRetrabalho: 0, quantidadeRefugo: 0 }), { total: 0, diferenca: 40, confere: false });
});
test('PROD-02: o mesmo lote em duas etapas não é somado na produção final', () => {
  assert.equal(calcularProducaoFinal([{ ordem: 1, quantidadeBoa: 40 }, { ordem: 2, quantidadeBoa: 40 }]), 40);
  assert.equal(calcularProducaoFinal([{ ordem: 2, quantidadeBoa: 38 }, { ordem: 1, quantidadeBoa: 40 }]), 38);
  assert.equal(calcularProducaoFinal([]), null);
  assert.throws(() => calcularProducaoFinal([{ ordem: 1, quantidadeBoa: 10 }, { ordem: 1, quantidadeBoa: 20 }]), /repetida/);
});

test('baixa é a execução com tipo de finalização BAIXA', () => {
  const semQuantidade = { quantidadeBoa: null, quantidadeRetrabalho: null, quantidadeRefugo: null };
  const aberta = { tipoFinalizacao: null, ...semQuantidade };
  const troca = { tipoFinalizacao: 'TROCA_OPERACAO' as const, ...semQuantidade };
  const completa = { quantidadeBoa: 38, quantidadeRetrabalho: 1, quantidadeRefugo: 1 };
  assert.deepEqual(identificarBaixa(40, []), { situacao: 'SEM_BAIXA', resultado: null });
  assert.equal(identificarBaixa(40, [aberta]).situacao, 'SEM_BAIXA');
  assert.equal(identificarBaixa(40, [troca, troca]).situacao, 'SEM_BAIXA');
  assert.deepEqual(identificarBaixa(40, [troca, { tipoFinalizacao: 'BAIXA', ...completa }]), { situacao: 'BAIXADA', resultado: completa });
  // lote inteiro refugado continua sendo baixa
  assert.equal(identificarBaixa(40, [{ tipoFinalizacao: 'BAIXA', quantidadeBoa: 0, quantidadeRetrabalho: 0, quantidadeRefugo: 40 }]).situacao, 'BAIXADA');
});
test('baixa com soma diferente da ordem, em duplicidade ou sem quantidade é inconsistência', () => {
  const completa = { tipoFinalizacao: 'BAIXA' as const, quantidadeBoa: 40, quantidadeRetrabalho: 0, quantidadeRefugo: 0 };
  assert.equal(identificarBaixa(40, [{ ...completa, quantidadeBoa: 30 }]).situacao, 'INCONSISTENTE');
  assert.equal(identificarBaixa(40, [{ ...completa, quantidadeBoa: 41 }]).situacao, 'INCONSISTENTE');
  // o banco aceita quantidade negativa; a soma fecha em 40, mas não vale como baixa
  assert.equal(identificarBaixa(40, [{ ...completa, quantidadeBoa: 41, quantidadeRefugo: -1 }]).situacao, 'INCONSISTENTE');
  // o banco impede estes dois casos; a função não os aceita se chegarem
  assert.equal(identificarBaixa(40, [completa, completa]).situacao, 'INCONSISTENTE');
  assert.equal(identificarBaixa(40, [{ ...completa, quantidadeRefugo: null }]).situacao, 'INCONSISTENTE');
  assert.throws(() => identificarBaixa(0, []), /positiva/);
});
test('posição da ordem: etapa atual é a primeira sem baixa', () => {
  assert.deepEqual(calcularPosicao([{ ordem: 1, situacao: 'BAIXADA' }, { ordem: 2, situacao: 'SEM_BAIXA' }, { ordem: 3, situacao: 'SEM_BAIXA' }]),
    { etapasTotal: 3, etapasBaixadas: 1, etapasInconsistentes: 0, etapaAtual: 2 });
  assert.deepEqual(calcularPosicao([{ ordem: 2, situacao: 'BAIXADA' }, { ordem: 1, situacao: 'BAIXADA' }]),
    { etapasTotal: 2, etapasBaixadas: 2, etapasInconsistentes: 0, etapaAtual: null });
  // sequência nominal: etapa posterior pode ter baixa antes da anterior
  assert.deepEqual(calcularPosicao([{ ordem: 1, situacao: 'INCONSISTENTE' }, { ordem: 2, situacao: 'BAIXADA' }]),
    { etapasTotal: 2, etapasBaixadas: 1, etapasInconsistentes: 1, etapaAtual: 1 });
  assert.throws(() => calcularPosicao([{ ordem: 1, situacao: 'BAIXADA' }, { ordem: 1, situacao: 'SEM_BAIXA' }]), /repetida/);
});

test('carga pendente em segundos: quantidade sem baixa × tempo padrão por unidade', () => {
  assert.deepEqual(calcularCargaPendente([{ quantidade: 24, tempoPadraoSegundos: 100 }, { quantidade: 40, tempoPadraoSegundos: 100 }]), { cargaSegundos: 6400, referenciasPendentes: 0 });
  assert.deepEqual(calcularCargaPendente([{ quantidade: 12.5, tempoPadraoSegundos: 1.25 }]), { cargaSegundos: 15.625, referenciasPendentes: 0 });
  assert.deepEqual(calcularCargaPendente([]), { cargaSegundos: 0, referenciasPendentes: 0 });
});
test('tempo padrão ausente torna a carga indisponível, não zero', () => {
  assert.deepEqual(calcularCargaPendente([{ quantidade: 24, tempoPadraoSegundos: 100 }, { quantidade: 12, tempoPadraoSegundos: null }]), { cargaSegundos: null, referenciasPendentes: 1 });
  assert.deepEqual(calcularCargaPendente([{ quantidade: 0, tempoPadraoSegundos: null }]), { cargaSegundos: 0, referenciasPendentes: 0 });
});
test('POSTO-01: carga da etapa repartida em partes iguais entre os seus postos', () => {
  // Corte 6.000 s (um posto), montagem 18.000 s (dois postos), acabamento 12.000 s (um posto).
  const r = distribuirCargaPorPosto([
    { cargaSegundos: 6000, postoIds: ['corte-1'] },
    { cargaSegundos: 18000, postoIds: ['montagem-1', 'montagem-2'] },
    { cargaSegundos: 12000, postoIds: ['acabamento-1'] },
  ], ['corte-1', 'montagem-1', 'montagem-2', 'acabamento-1']);
  assert.deepEqual(r.map((p) => p.cargaSegundos), [6000, 9000, 9000, 12000]);
  assert.deepEqual(r.map((p) => Math.round((p.percentualDaCarga ?? NaN) * 100) / 100), [16.67, 25, 25, 33.33]);
  assert.equal(r.reduce((soma, p) => soma + (p.cargaSegundos ?? NaN), 0), 36000);
});
test('POSTO-02: etapa sem posto não é atribuída, e posto sem etapa pendente fica com zero', () => {
  const r = distribuirCargaPorPosto([{ cargaSegundos: 500, postoIds: [] }, { cargaSegundos: 300, postoIds: ['a', 'a'] }], ['a', 'b']);
  assert.deepEqual(r, [{ postoId: 'a', cargaSegundos: 300, percentualDaCarga: 100 }, { postoId: 'b', cargaSegundos: 0, percentualDaCarga: 0 }]);
});
test('POSTO-03: carga indisponível de uma etapa não vira zero no posto nem nos percentuais', () => {
  const r = distribuirCargaPorPosto([{ cargaSegundos: null, postoIds: ['a'] }, { cargaSegundos: 300, postoIds: ['a', 'b'] }], ['a', 'b']);
  assert.deepEqual(r, [{ postoId: 'a', cargaSegundos: null, percentualDaCarga: null }, { postoId: 'b', cargaSegundos: 150, percentualDaCarga: null }]);
  assert.deepEqual(distribuirCargaPorPosto([], ['a']), [{ postoId: 'a', cargaSegundos: 0, percentualDaCarga: null }]);
  assert.throws(() => distribuirCargaPorPosto([{ cargaSegundos: 10, postoIds: ['x'] }], ['a']), /fora da lista/);
  assert.throws(() => distribuirCargaPorPosto([{ cargaSegundos: -1, postoIds: ['a'] }], ['a']));
});
test('rejeita negativos, mais de duas casas e valores não finitos', () => {
  const r = (q: number) => ({ quantidadeBoa: q, quantidadeRetrabalho: 0, quantidadeRefugo: 0 });
  assert.throws(() => somarResultados([r(-1)]));
  assert.throws(() => somarResultados([r(1.005)]), /duas casas/);
  assert.throws(() => conferirResultado(NaN, r(1)));
  assert.throws(() => calcularCargaPendente([{ quantidade: 1, tempoPadraoSegundos: 0 }]), /positivo/);
  assert.throws(() => calcularCargaPendente([{ quantidade: Infinity, tempoPadraoSegundos: 1 }]));
  assert.throws(() => calcularTempoMedioPorUnidade([{ produtivoSegundos: NaN, quantidadeBoa: 1 }]));
});
