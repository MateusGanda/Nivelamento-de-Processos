// Testa a divisão do período em dias de Brasília.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataDoInstante, dividirEmDias, MAXIMO_DE_DIAS } from '../../../../modules/indicators/domain/dias.ts';

const ms = (texto: string) => Date.parse(texto);

test('dias: período recortado nas pontas e datas no horário de Brasília', () => {
  assert.deepEqual(dividirEmDias({ inicioMs: ms('2026-10-05T08:00:00-03:00'), fimMs: ms('2026-10-06T18:00:00-03:00') }), [
    { data: '2026-10-05', inicioMs: ms('2026-10-05T08:00:00-03:00'), fimMs: ms('2026-10-06T00:00:00-03:00') },
    { data: '2026-10-06', inicioMs: ms('2026-10-06T00:00:00-03:00'), fimMs: ms('2026-10-06T18:00:00-03:00') },
  ]);
  // 01:00 UTC ainda é o dia anterior em Brasília.
  assert.equal(dataDoInstante(ms('2026-10-06T01:00:00Z')), '2026-10-05');
  assert.equal(dataDoInstante(ms('2026-10-06T03:00:00Z')), '2026-10-06');
  const virada = dividirEmDias({ inicioMs: ms('2026-12-31T00:00:00-03:00'), fimMs: ms('2027-01-02T00:00:00-03:00') });
  assert.deepEqual(virada.map((d) => d.data), ['2026-12-31', '2027-01-01']);
});

test('dias: período longo demais não gera série', () => {
  const inicioMs = ms('2026-01-01T00:00:00-03:00');
  assert.equal(dividirEmDias({ inicioMs, fimMs: inicioMs + MAXIMO_DE_DIAS * 86_400_000 }).length, MAXIMO_DE_DIAS);
  assert.deepEqual(dividirEmDias({ inicioMs, fimMs: inicioMs + (MAXIMO_DE_DIAS + 1) * 86_400_000 }), []);
  assert.throws(() => dividirEmDias({ inicioMs, fimMs: inicioMs }));
});
