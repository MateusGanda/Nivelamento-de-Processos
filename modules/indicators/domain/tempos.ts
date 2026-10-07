import { centesimos, intersecao, naoNegativo, segundos, validarJanela } from '../../../shared/validation.ts';
import type { Janela } from '../../../shared/validation.ts';

/** Mesmos valores de TipoEventoTempo no contrato do banco. */
export type TipoEvento = 'INICIO' | 'PAUSA' | 'RETOMADA' | 'FINALIZACAO';
export type EventoTempo = { tipo: TipoEvento; instanteMs: number; motivoPausaId: string | null };
export type Intervalo = Janela & { tipo: 'PRODUTIVO' | 'PAUSA'; motivoPausaId: string | null };

const seguintes: Record<TipoEvento, readonly TipoEvento[]> = {
  INICIO: ['PAUSA', 'FINALIZACAO'],
  RETOMADA: ['PAUSA', 'FINALIZACAO'],
  PAUSA: ['RETOMADA'],
  FINALIZACAO: [],
};

/** Intervalos de UMA execução, derivados dos seus eventos de tempo.
 * A sequência segue as transições do modelo: INICIO, depois PAUSA e RETOMADA
 * alternadas, e FINALIZACAO a partir de execução ativa; sequência diferente é erro.
 * Sem FINALIZACAO a execução está aberta: o trecho em andamento fica de fora,
 * sem horário de término presumido.
 */
export function derivarIntervalos(eventos: readonly EventoTempo[]) {
  for (const e of eventos) {
    if (!Number.isSafeInteger(e.instanteMs)) throw new Error('Instante inválido: use milissegundos Unix inteiros.');
  }
  const ordenados = [...eventos].sort((a, b) => a.instanteMs - b.instanteMs);
  if (ordenados.length === 0 || ordenados[0].tipo !== 'INICIO') throw new Error('Sequência de eventos inválida: a execução começa por INICIO.');
  const intervalos: Intervalo[] = [];
  for (let i = 0; i + 1 < ordenados.length; i++) {
    const atual = ordenados[i];
    const proximo = ordenados[i + 1];
    if (!seguintes[atual.tipo].includes(proximo.tipo)) {
      throw new Error(`Sequência de eventos inválida: ${proximo.tipo} depois de ${atual.tipo}.`);
    }
    if (proximo.instanteMs === atual.instanteMs) continue;
    const pausa = atual.tipo === 'PAUSA';
    intervalos.push({
      inicioMs: atual.instanteMs,
      fimMs: proximo.instanteMs,
      tipo: pausa ? 'PAUSA' : 'PRODUTIVO',
      motivoPausaId: pausa ? atual.motivoPausaId : null,
    });
  }
  return { intervalos, aberta: ordenados[ordenados.length - 1].tipo !== 'FINALIZACAO' };
}

/** Tempos recortados ao período consultado. Aceita intervalos de várias execuções,
 * inclusive simultâneas: o total é tempo de execução somado, não tempo de relógio
 * do posto nem esforço de uma pessoa. Pausa não é automaticamente perda, e
 * período sem intervalo não é ociosidade.
 */
export function calcularTempos(intervalos: readonly Intervalo[], periodo: Janela) {
  validarJanela(periodo);
  let produtivoSegundos = 0;
  let pausaSegundos = 0;
  const porMotivo = new Map<string | null, { segundos: number; ocorrencias: number }>();
  for (const intervalo of intervalos) {
    validarJanela(intervalo);
    const parte = intersecao(intervalo, periodo);
    if (!parte) continue;
    if (intervalo.tipo === 'PRODUTIVO') {
      produtivoSegundos += segundos(parte);
      continue;
    }
    pausaSegundos += segundos(parte);
    const acumulado = porMotivo.get(intervalo.motivoPausaId) ?? { segundos: 0, ocorrencias: 0 };
    acumulado.segundos += segundos(parte);
    acumulado.ocorrencias += 1;
    porMotivo.set(intervalo.motivoPausaId, acumulado);
  }
  const pausasPorMotivo = [...porMotivo.entries()]
    .map(([motivoPausaId, v]) => ({ motivoPausaId, ...v }))
    .sort((a, b) => b.segundos - a.segundos);
  return { produtivoSegundos, pausaSegundos, pausasPorMotivo };
}

/** Mesmo produto e etapa; execuções inteiras, sem recortar só o numerador.
 * Média ponderada pela quantidade, não média de médias. Inclui o tempo gasto
 * em unidades de retrabalho e refugo e não é o ciclo da linha.
 */
export function calcularTempoMedioPorUnidade(execucoes: readonly { produtivoSegundos: number; quantidadeBoa: number }[]): number | null {
  let tempo = 0;
  let boas = 0;
  for (const e of execucoes) {
    naoNegativo(e.produtivoSegundos, 'Tempo produtivo');
    tempo += e.produtivoSegundos;
    boas += centesimos(e.quantidadeBoa, 'Quantidade');
  }
  if (!Number.isFinite(tempo) || !Number.isSafeInteger(boas)) throw new Error('Totais excederam o limite numérico.');
  return boas > 0 ? tempo / (boas / 100) : null;
}
