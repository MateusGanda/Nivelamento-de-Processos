import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarDuracao, lerQuantidade, tempoDecorrido } from '../../../modules/executions/presentation/tempo-decorrido.ts';
import type { EventoDaExecucao } from '../../../modules/executions/domain/execucao.ts';

const t = (min: number) => new Date(Date.UTC(2026, 9, 26, 13, min)).toISOString();
const ms = (min: number) => Date.UTC(2026, 9, 26, 13, min);
const evento = (tipo: EventoDaExecucao['tipo'], min: number): EventoDaExecucao => ({ tipo, dataHora: t(min), motivo: null });

test('ilha: tempo produtivo conta só os intervalos ativos até agora', () => {
  const eventos = [evento('INICIO', 0), evento('PAUSA', 10), evento('RETOMADA', 15)];
  assert.deepEqual(tempoDecorrido(eventos, 'EM_EXECUCAO', ms(20)), { produtivoSegundos: 15 * 60, pausaSegundos: 5 * 60 });
  // Pausada: o trecho em andamento conta como pausa.
  const pausada = [...eventos, evento('PAUSA', 20)];
  assert.deepEqual(tempoDecorrido(pausada, 'PAUSADA', ms(26)), { produtivoSegundos: 15 * 60, pausaSegundos: 11 * 60 });
  // Relógio do terminal atrás do servidor não gera tempo negativo.
  assert.deepEqual(tempoDecorrido([evento('INICIO', 0)], 'EM_EXECUCAO', ms(0) - 5000), { produtivoSegundos: 0, pausaSegundos: 0 });
});

test('ilha: formata a duração e lê as quantidades da baixa', () => {
  assert.equal(formatarDuracao(65), '01:05');
  assert.equal(formatarDuracao(3 * 3600 + 7 * 60 + 9), '3:07:09');
  assert.equal(formatarDuracao(-3), '00:00');
  assert.equal(lerQuantidade(' 12,5 '), 12.5);
  assert.equal(lerQuantidade(''), 0);
  for (const texto of ['-1', 'abc', '1,234']) assert.equal(lerQuantidade(texto), undefined, texto);
});
