import { centesimos, naoNegativo } from '../../../shared/validation.ts';

/** Tempo padrão em segundos por unidade produzida, na unidade da ordem. */
export type ItemCarga = { quantidade: number; tempoPadraoSegundos: number | null };

/** Carga pendente de UMA etapa, em segundos: soma de quantidade sem baixa ×
 * tempo padrão do produto na etapa. Tempo padrão ausente torna a carga
 * indisponível, nunca zero. É estimativa para comparar etapas; não comprova gargalo.
 */
export function calcularCargaPendente(itens: readonly ItemCarga[]) {
  let carga = 0;
  let referenciasPendentes = 0;
  for (const item of itens) {
    const q = centesimos(item.quantidade, 'Quantidade');
    if (item.tempoPadraoSegundos === null) {
      if (q > 0) referenciasPendentes += 1;
      continue;
    }
    const t = centesimos(item.tempoPadraoSegundos, 'Tempo padrão');
    if (t === 0) throw new Error('Tempo padrão deve ser positivo.');
    carga += q * t;
  }
  if (!Number.isSafeInteger(carga)) throw new Error('Carga excedeu o limite numérico.');
  return { cargaSegundos: referenciasPendentes > 0 ? null : carga / 10000, referenciasPendentes };
}

/** Carga pendente de uma etapa e os postos ativos em que ela pode ser feita. */
export type CargaDaEtapaNosPostos = { cargaSegundos: number | null; postoIds: readonly string[] };

/** Carga pendente por posto. O modelo não diz em qual posto o trabalho pendente
 * será feito, então a carga de cada etapa é repartida em partes iguais entre os
 * seus postos. É estimativa: com um posto só o valor é exato; com mais de um, a
 * divisão real pode ser outra. Etapa sem posto não é atribuída a ninguém.
 * O percentual é a participação do posto na carga total distribuída. Se a carga
 * de uma etapa é indisponível, a dos seus postos e todos os percentuais também são.
 */
export function distribuirCargaPorPosto(etapas: readonly CargaDaEtapaNosPostos[], postoIds: readonly string[]) {
  const carga = new Map<string, number>(postoIds.map((id) => [id, 0]));
  const indisponiveis = new Set<string>();
  for (const etapa of etapas) {
    const postos = [...new Set(etapa.postoIds)];
    for (const id of postos) {
      if (!carga.has(id)) throw new Error('Posto da etapa fora da lista de postos.');
    }
    if (etapa.cargaSegundos === null) {
      for (const id of postos) indisponiveis.add(id);
      continue;
    }
    naoNegativo(etapa.cargaSegundos, 'Carga da etapa');
    for (const id of postos) carga.set(id, carga.get(id)! + etapa.cargaSegundos / postos.length);
  }
  let total = 0;
  for (const segundos of carga.values()) total += segundos;
  const comparavel = indisponiveis.size === 0 && total > 0;
  return [...carga.entries()].map(([postoId, segundos]) => ({
    postoId,
    cargaSegundos: indisponiveis.has(postoId) ? null : segundos,
    percentualDaCarga: comparavel ? (segundos / total) * 100 : null,
  }));
}
