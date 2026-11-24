/** Identificador permanente; a sequência considera também os códigos legados. */
export function gerarCodigoPlano(reservados: readonly string[]): string {
  let maior = BigInt(0);
  for (const reservado of reservados) {
    const sufixo = /^PLN-(\d+)$/.exec(reservado)?.[1];
    if (sufixo !== undefined && BigInt(sufixo) > maior) maior = BigInt(sufixo);
  }
  return `PLN-${String(maior + BigInt(1)).padStart(4, '0')}`;
}
