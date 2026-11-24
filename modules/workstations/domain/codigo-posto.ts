/** Identificador permanente; a sequência considera também valores legados e inativos. */
export function gerarCodigoPosto(reservados: readonly string[]): string {
  let maior = BigInt(0);
  for (const reservado of reservados) {
    const sufixo = /^PST-(\d+)$/.exec(reservado)?.[1];
    if (sufixo !== undefined && BigInt(sufixo) > maior) maior = BigInt(sufixo);
  }
  return `PST-${String(maior + BigInt(1)).padStart(4, '0')}`;
}
