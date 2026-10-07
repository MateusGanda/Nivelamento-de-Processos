import { centesimos } from '../../../shared/validation.ts';

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
