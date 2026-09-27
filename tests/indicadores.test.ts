import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTempos, descontarPausasProgramadas, calcularCarga, calcularTempoMedioPorPar, calcularProducao } from '../src/indicadores.ts';
import type { Intervalo } from '../src/indicadores.ts';

const instante = (hora: string) => Date.parse(`2026-09-29T${hora}:00-03:00`);
const janela = (inicio: string, fim: string) => ({ inicioMs: instante(inicio), fimMs: instante(fim) });
const registros: Intervalo[] = [
  { ...janela('08:00', '08:40'), categoria: 'PRODUTIVO' },
  { ...janela('08:40', '08:50'), categoria: 'INTERRUPCAO' },
  { ...janela('08:50', '09:30'), categoria: 'PRODUTIVO' },
];

test('TEMPO-01: 80 min produtivos, 10 de interrupção e 120 s/par', () => {
  const r = calcularTempos(registros, [janela('08:00', '09:30')])!;
  assert.equal(r.porCategoria.PRODUTIVO, 4800);
  assert.equal(r.porCategoria.INTERRUPCAO, 600);
  assert.equal(calcularTempoMedioPorPar([{ produtivoSegundos: 4800, paresBons: 40 }]), 120);
});
test('TEMPO-02: recorte 08:30–09:00', () => {
  const r = calcularTempos(registros, [janela('08:30', '09:00')])!;
  assert.equal(r.porCategoria.PRODUTIVO, 1200);
  assert.equal(r.porCategoria.INTERRUPCAO, 600);
});
test('TEMPO-03: 30 min sem informação e 75% de cobertura', () => {
  const r = calcularTempos(registros, [janela('08:00', '10:00')])!;
  assert.equal(r.semInformacaoSegundos, 1800);
  assert.equal(r.coberturaPercentual, 75);
  assert.equal(r.naoProdutivoApontadoSegundos, 600);
});
test('CARGA-01: 480 min previstos para 420 min disponíveis', () => {
  const r = calcularCarga([{ quantidadePlanejada: 240, tempoReferenciaSegundosPorPar: 120 }], 25200);
  assert.equal(r.cargaSegundos, 28800);
  assert.equal(r.ocupacaoPlanejadaPercentual!.toFixed(2), '114.29');
});
test('retira pausa programada do numerador e denominador', () => {
  const liquida = descontarPausasProgramadas([janela('08:00', '10:00')], [janela('09:00', '09:15')]);
  const r = calcularTempos([{ ...janela('08:00', '10:00'), categoria: 'PRODUTIVO' }], liquida.janelas)!;
  assert.equal(liquida.excluidoSegundos, 900);
  assert.equal(r.janelaSegundos, 6300);
  assert.equal(r.porCategoria.PRODUTIVO, 6300);
  assert.equal(r.coberturaPercentual, 100);
});
test('rejeita sobreposição de intervalos e janelas', () => {
  assert.throws(() => calcularTempos([...registros, registros[0]], [janela('08:00', '10:00')]), /sobrepostos/);
  assert.throws(() => calcularTempos([], [janela('08:00', '10:00'), janela('09:00', '11:00')]), /sobrepostos/);
});
test('aceita limites adjacentes e não altera entrada', () => {
  const entrada = [...registros].reverse();
  const copia = structuredClone(entrada);
  assert.equal(calcularTempos(entrada, [janela('08:00', '10:00')])!.classificadoSegundos, 5400);
  assert.deepEqual(entrada, copia);
});
test('janela ausente e disponibilidade zero não geram percentuais inventados', () => {
  assert.equal(calcularTempos(registros, null), null);
  assert.equal(calcularTempos([], [])!.coberturaPercentual, null);
  assert.equal(calcularCarga([], 0).ocupacaoPlanejadaPercentual, null);
  assert.equal(calcularCarga([], null).ocupacaoPlanejadaPercentual, null);
});
test('sem registros com janela válida significa sem informação', () => {
  const r = calcularTempos([], [janela('08:00', '10:00')])!;
  assert.equal(r.semInformacaoSegundos, 7200);
  assert.equal(r.coberturaPercentual, 0);
  assert.equal(r.naoProdutivoApontadoSegundos, 0);
});
test('intervalos fora da janela não entram nos totais', () => {
  assert.equal(calcularTempos(registros, [janela('11:00', '12:00')])!.classificadoSegundos, 0);
});
test('rejeita fim anterior ao início e instantes inválidos', () => {
  assert.throws(() => calcularTempos([], [janela('10:00', '08:00')]), /Janela inválida/);
  assert.throws(() => calcularTempos([], [{ inicioMs: NaN, fimMs: 10 }]), /Janela inválida/);
});
test('média ponderada pelos pares, não média simples', () => {
  assert.equal(calcularTempoMedioPorPar([{ produtivoSegundos: 600, paresBons: 10 }, { produtivoSegundos: 600, paresBons: 30 }]), 30);
  assert.equal(calcularTempoMedioPorPar([{ produtivoSegundos: 600, paresBons: 0 }]), null);
});
test('produção: saldo, meta ausente, zero e excesso visível', () => {
  assert.equal(calcularProducao(100, 50).saldo, 50);
  assert.equal(calcularProducao(100, 50).cumprimentoPercentual, 50);
  assert.equal(calcularProducao(null, 50).saldo, null);
  assert.equal(calcularProducao(0, 0).cumprimentoPercentual, null);
  assert.equal(calcularProducao(100, 110).excedePrevisto, true);
});
test('referência ausente torna carga indisponível, não zero', () => {
  const r = calcularCarga([{ quantidadePlanejada: 40, tempoReferenciaSegundosPorPar: null }], 3600);
  assert.equal(r.cargaSegundos, null);
  assert.equal(r.referenciasPendentes, 1);
});
test('rejeita negativos, frações de pares e valores não finitos', () => {
  assert.throws(() => calcularProducao(100, -1));
  assert.throws(() => calcularProducao(100, 1.5));
  assert.throws(() => calcularCarga([{ quantidadePlanejada: 1, tempoReferenciaSegundosPorPar: 0 }], 100));
  assert.throws(() => calcularCarga([], Infinity));
  assert.throws(() => calcularTempoMedioPorPar([{ produtivoSegundos: NaN, paresBons: 1 }]));
});
