// Dados fictícios. Testes das fórmulas, sem banco, API ou tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTempos, descontarPausasProgramadas, calcularTempoMedioPorPar } from '../../../../modules/indicators/domain/tempos.ts';
import type { Intervalo } from '../../../../modules/indicators/domain/tempos.ts';
import { calcularCarga } from '../../../../modules/indicators/domain/carga.ts';
import { calcularSaldo, calcularCumprimento, calcularProducaoFinal } from '../../../../modules/indicators/domain/producao.ts';

const instante = (hora: string) => Date.parse(`2026-09-29T${hora}:00-03:00`);
const janela = (inicio: string, fim: string) => ({ inicioMs: instante(inicio), fimMs: instante(fim) });
const registros: Intervalo[] = [
  { ...janela('08:00', '08:40'), categoria: 'PRODUTIVO' },
  { ...janela('08:40', '08:50'), categoria: 'INTERRUPCAO' },
  { ...janela('08:50', '09:30'), categoria: 'PRODUTIVO' },
];

test('TEMPO-01: 80 min produtivos, 10 de interrupção e 120 s/par', () => {
  const r = calcularTempos(registros, janela('08:00', '09:30'), null);
  assert.equal(r.porCategoria.PRODUTIVO, 4800);
  assert.equal(r.porCategoria.INTERRUPCAO, 600);
  assert.equal(calcularTempoMedioPorPar([{ produtivoSegundos: 4800, paresBons: 40 }]), 120);
});
test('TEMPO-01: sem janela, só a cobertura fica indisponível', () => {
  const r = calcularTempos(registros, janela('08:00', '09:30'), null);
  assert.equal(r.cobertura, null);
  assert.equal(r.classificadoSegundos, 5400);
  assert.equal(r.naoProdutivoApontadoSegundos, 600);
});
test('TEMPO-02: recorte 08:30–09:00', () => {
  const r = calcularTempos(registros, janela('08:30', '09:00'), null);
  assert.equal(r.porCategoria.PRODUTIVO, 1200);
  assert.equal(r.porCategoria.INTERRUPCAO, 600);
});
test('TEMPO-03: 30 min sem informação e 75% de cobertura', () => {
  const r = calcularTempos(registros, janela('08:00', '10:00'), [janela('08:00', '10:00')]);
  assert.equal(r.cobertura!.janelaSegundos, 7200);
  assert.equal(r.cobertura!.semInformacaoSegundos, 1800);
  assert.equal(r.cobertura!.coberturaPercentual, 75);
  assert.equal(r.naoProdutivoApontadoSegundos, 600);
});
test('cobertura recorta a janela ao período consultado', () => {
  const r = calcularTempos(registros, janela('08:30', '09:00'), [janela('08:00', '10:00')]);
  assert.equal(r.cobertura!.janelaSegundos, 1800);
  assert.equal(r.cobertura!.coberturaPercentual, 100);
});
test('retira pausa programada do numerador e denominador da cobertura', () => {
  const liquida = descontarPausasProgramadas([janela('08:00', '10:00')], [janela('09:00', '09:15')]);
  const r = calcularTempos([{ ...janela('08:00', '10:00'), categoria: 'PRODUTIVO' }], janela('08:00', '10:00'), liquida.janelas);
  assert.equal(liquida.excluidoSegundos, 900);
  assert.equal(r.cobertura!.janelaSegundos, 6300);
  assert.equal(r.cobertura!.classificadoSegundos, 6300);
  assert.equal(r.cobertura!.coberturaPercentual, 100);
  assert.equal(r.porCategoria.PRODUTIVO, 7200);
});
test('rejeita sobreposição de intervalos e janelas', () => {
  const periodo = janela('08:00', '10:00');
  assert.throws(() => calcularTempos([...registros, registros[0]], periodo, null), /sobrepostos/);
  assert.throws(() => calcularTempos([], periodo, [janela('08:00', '10:00'), janela('09:00', '11:00')]), /sobrepostos/);
});
test('aceita limites adjacentes e não altera entrada', () => {
  const entrada = [...registros].reverse();
  const copia = structuredClone(entrada);
  assert.equal(calcularTempos(entrada, janela('08:00', '10:00'), null).classificadoSegundos, 5400);
  assert.deepEqual(entrada, copia);
});
test('período sem registros: zeros nos tempos e tudo sem informação na janela', () => {
  const r = calcularTempos([], janela('08:00', '10:00'), [janela('08:00', '10:00')]);
  assert.equal(r.classificadoSegundos, 0);
  assert.equal(r.naoProdutivoApontadoSegundos, 0);
  assert.equal(r.cobertura!.semInformacaoSegundos, 7200);
  assert.equal(r.cobertura!.coberturaPercentual, 0);
});
test('janela vazia ou fora do período não gera percentual inventado', () => {
  assert.equal(calcularTempos(registros, janela('08:00', '10:00'), [])!.cobertura!.coberturaPercentual, null);
  assert.equal(calcularTempos(registros, janela('08:00', '10:00'), [janela('11:00', '12:00')]).cobertura!.coberturaPercentual, null);
});
test('intervalos fora do período não entram nos totais', () => {
  assert.equal(calcularTempos(registros, janela('11:00', '12:00'), null).classificadoSegundos, 0);
});
test('rejeita fim anterior ao início, duração zero e instantes inválidos', () => {
  const periodo = janela('08:00', '10:00');
  assert.throws(() => calcularTempos([], janela('10:00', '08:00'), null), /Janela inválida/);
  assert.throws(() => calcularTempos([], periodo, [{ inicioMs: NaN, fimMs: 10 }]), /Janela inválida/);
  assert.throws(() => calcularTempos([{ ...janela('08:00', '08:00'), categoria: 'PRODUTIVO' }], periodo, null), /Janela inválida/);
});
test('média ponderada pelos pares, não média simples', () => {
  assert.equal(calcularTempoMedioPorPar([{ produtivoSegundos: 600, paresBons: 10 }, { produtivoSegundos: 600, paresBons: 30 }]), 30);
  assert.equal(calcularTempoMedioPorPar([{ produtivoSegundos: 600, paresBons: 0 }]), null);
  assert.equal(calcularTempoMedioPorPar([]), null);
});

test('CARGA-01: 480 min previstos para 420 min disponíveis', () => {
  const r = calcularCarga([{ quantidadePlanejada: 240, tempoReferenciaSegundosPorPar: 120 }], 25200);
  assert.equal(r.cargaSegundos, 28800);
  assert.equal(r.ocupacaoPlanejadaPercentual!.toFixed(2), '114.29');
});
test('carga soma várias etapas do mesmo posto sobre uma única disponibilidade', () => {
  const r = calcularCarga([
    { quantidadePlanejada: 240, tempoReferenciaSegundosPorPar: 120 },
    { quantidadePlanejada: 100, tempoReferenciaSegundosPorPar: 30 },
  ], 25200);
  assert.equal(r.cargaSegundos, 31800);
  assert.equal(r.ocupacaoPlanejadaPercentual!.toFixed(2), '126.19');
});
test('disponibilidade ausente ou zero não gera ocupação inventada', () => {
  assert.equal(calcularCarga([], 0).ocupacaoPlanejadaPercentual, null);
  assert.equal(calcularCarga([], null).ocupacaoPlanejadaPercentual, null);
});
test('referência ausente torna carga indisponível, não zero', () => {
  const r = calcularCarga([{ quantidadePlanejada: 40, tempoReferenciaSegundosPorPar: null }], 3600);
  assert.equal(r.cargaSegundos, null);
  assert.equal(r.referenciasPendentes, 1);
  assert.equal(r.ocupacaoPlanejadaPercentual, null);
});

test('PROD-01: previsto 100, baixas de 30 e 20 geram realizado 50 e saldo 50', () => {
  const realizado = [30, 20].reduce((s, q) => s + q, 0);
  assert.equal(realizado, 50);
  assert.equal(calcularSaldo(100, realizado).saldo, 50);
  assert.equal(calcularCumprimento(100, realizado), 50);
});
test('baixa parcial: 30 de 100 deixa saldo 70 e cumprimento 30%', () => {
  assert.equal(calcularSaldo(100, 30).saldo, 70);
  assert.equal(calcularCumprimento(100, 30), 30);
});
test('PROD-02: 100 pares no corte e na costura não viram 200 finais', () => {
  assert.equal(calcularProducaoFinal([{ sequencia: 1, paresBons: 100 }, { sequencia: 2, paresBons: 100 }]), 100);
  assert.equal(calcularProducaoFinal([{ sequencia: 2, paresBons: 40 }, { sequencia: 1, paresBons: 100 }]), 40);
  assert.equal(calcularProducaoFinal([]), null);
});
test('previsto ausente ou zero é indisponível; excesso fica visível', () => {
  assert.equal(calcularSaldo(null, 50).saldo, null);
  assert.equal(calcularCumprimento(null, 50), null);
  assert.equal(calcularCumprimento(0, 0), null);
  assert.equal(calcularSaldo(100, 110).excedePrevisto, true);
  assert.equal(calcularSaldo(100, 110).saldo, -10);
});
test('rejeita negativos, frações de pares e valores não finitos', () => {
  assert.throws(() => calcularSaldo(100, -1));
  assert.throws(() => calcularCumprimento(100, 1.5));
  assert.throws(() => calcularProducaoFinal([{ sequencia: 1, paresBons: 10 }, { sequencia: 1, paresBons: 20 }]), /repetida/);
  assert.throws(() => calcularCarga([{ quantidadePlanejada: 1, tempoReferenciaSegundosPorPar: 0 }], 100));
  assert.throws(() => calcularCarga([], Infinity));
  assert.throws(() => calcularTempoMedioPorPar([{ produtivoSegundos: NaN, paresBons: 1 }]));
});
