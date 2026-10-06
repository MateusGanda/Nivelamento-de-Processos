import { quantidade } from '../../../shared/validation.ts';

/** Saldo de UMA ficha/etapa: previsto da ficha menos pares bons acumulados nessa
 * mesma etapa, já líquidos de correções. Não depende do período consultado.
 * Saldo negativo é mantido para revelar inconsistência; o servidor deve impedir excesso.
 */
export function calcularSaldo(previsto: number | null, paresBonsAcumulados: number) {
  quantidade(paresBonsAcumulados);
  if (previsto !== null) quantidade(previsto);
  return {
    saldo: previsto === null ? null : previsto - paresBonsAcumulados,
    excedePrevisto: previsto !== null && paresBonsAcumulados > previsto,
  };
}

/** Previsto e realizado precisam ter o mesmo produto, etapa e período.
 * Previsto ausente ou zero resulta em indisponível (null).
 */
export function calcularCumprimento(previsto: number | null, realizadoBom: number): number | null {
  quantidade(realizadoBom);
  if (previsto !== null) quantidade(previsto);
  return previsto !== null && previsto > 0 ? realizadoBom / previsto * 100 : null;
}

/** Etapas de UMA ficha. A produção final é a da última etapa do roteiro;
 * o mesmo par não é somado em etapas sucessivas. Sem etapas: indisponível.
 */
export function calcularProducaoFinal(etapas: readonly { sequencia: number; paresBons: number }[]): number | null {
  let ultima: { sequencia: number; paresBons: number } | null = null;
  const vistas = new Set<number>();
  for (const e of etapas) {
    quantidade(e.paresBons);
    if (!Number.isSafeInteger(e.sequencia)) throw new Error('Sequência: informe um inteiro.');
    if (vistas.has(e.sequencia)) throw new Error('Sequência repetida na ficha.');
    vistas.add(e.sequencia);
    if (ultima === null || e.sequencia > ultima.sequencia) ultima = e;
  }
  return ultima === null ? null : ultima.paresBons;
}
