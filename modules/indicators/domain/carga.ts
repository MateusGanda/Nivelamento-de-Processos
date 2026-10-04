import { naoNegativo, quantidade } from './validacao.ts';

export type ItemCarga = { quantidadePlanejada: number; tempoReferenciaSegundosPorPar: number | null };

/** Um único posto e período; tempo de referência ausente não vale zero.
 * Ocupação acima de 100% é carga planejada superior à disponibilidade,
 * não comprovação de gargalo.
 */
export function calcularCarga(itens: readonly ItemCarga[], disponibilidadeSegundos: number | null) {
  if (disponibilidadeSegundos !== null) naoNegativo(disponibilidadeSegundos, 'Disponibilidade');
  for (const i of itens) {
    quantidade(i.quantidadePlanejada);
    if (i.tempoReferenciaSegundosPorPar !== null) {
      naoNegativo(i.tempoReferenciaSegundosPorPar, 'Tempo de referência');
      if (i.tempoReferenciaSegundosPorPar === 0) throw new Error('Tempo de referência deve ser positivo.');
    }
  }
  const referenciasPendentes = itens.filter(i => i.quantidadePlanejada > 0 && i.tempoReferenciaSegundosPorPar === null).length;
  const cargaSegundos = referenciasPendentes > 0 ? null : itens.reduce((s, i) => s + i.quantidadePlanejada * (i.tempoReferenciaSegundosPorPar ?? 0), 0);
  if (cargaSegundos !== null && !Number.isFinite(cargaSegundos)) throw new Error('Carga excedeu o limite numérico.');
  return {
    cargaSegundos,
    referenciasPendentes,
    disponibilidadeSegundos,
    ocupacaoPlanejadaPercentual: cargaSegundos !== null && disponibilidadeSegundos !== null && disponibilidadeSegundos > 0
      ? cargaSegundos / disponibilidadeSegundos * 100 : null,
  };
}
