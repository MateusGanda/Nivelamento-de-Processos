// Dados fictícios. Ordem atrasada: prazo é a data de fim do plano; atrasada é a ordem não concluída depois dele.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IndicadoresService } from '../../../../modules/indicators/application/indicadores.ts';
import type { RegistrosDeProducao } from '../../../../modules/indicators/application/contracts.ts';
import { avaliarPrazo } from '../../../../modules/indicators/domain/prazo.ts';
import { textoDoPrazo } from '../../../../modules/indicators/presentation/resumo.ts';
import { DIA_06, RepositorioEmMemoria, base } from './registros-ficticios.ts';

// 06/10/2026 às 10:00 em Brasília.
const relogio = () => new Date('2026-10-06T13:00:00.000Z');
const consultar = (dados: RegistrosDeProducao) => new IndicadoresService(new RepositorioEmMemoria(dados), relogio).consultar(DIA_06);

test('ATR-01: prazo é o fim do plano; o último dia ainda está no prazo', () => {
  assert.deepEqual(avaliarPrazo('2026-10-05', false, '2026-10-06'), { atrasada: true, diasDeAtraso: 1 });
  assert.deepEqual(avaliarPrazo('2026-10-06', false, '2026-10-06'), { atrasada: false, diasDeAtraso: null });
  assert.deepEqual(avaliarPrazo('2026-09-26', false, '2026-10-06'), { atrasada: true, diasDeAtraso: 10 });
  // Concluída ou sem prazo: não há atraso.
  assert.deepEqual(avaliarPrazo('2026-09-26', true, '2026-10-06'), { atrasada: false, diasDeAtraso: null });
  assert.deepEqual(avaliarPrazo(null, false, '2026-10-06'), { atrasada: false, diasDeAtraso: null });
  assert.throws(() => avaliarPrazo('06/10/2026', false, '2026-10-06'), /Prazo inválido/);
});

test('ATR-02: posição das ordens marca a ordem em andamento com prazo vencido, no dia de Brasília', async () => {
  const dados = base();
  // 0001 e 0002 em andamento; a 0003 está concluída. Todas no plano com fim em 05/10.
  const { ordens } = await consultar({ ...dados, ordens: dados.ordens.map((o) => ({ ...o, prazo: o.numero === '0002' ? '2026-10-06' : '2026-10-05' })) });
  const por = new Map(ordens.map((o) => [o.numero, o]));
  assert.deepEqual([por.get('0001')?.atrasada, por.get('0001')?.diasDeAtraso, por.get('0001')?.prazo], [true, 1, '2026-10-05']);
  assert.deepEqual([por.get('0002')?.atrasada, por.get('0002')?.diasDeAtraso], [false, null]);
  assert.equal(textoDoPrazo(por.get('0001')!), '05/10/2026 · atrasada há 1 dia');
  assert.equal(textoDoPrazo(por.get('0002')!), '06/10/2026');
  assert.equal(textoDoPrazo({ ...por.get('0002')!, prazo: null }), 'Sem prazo');
});
