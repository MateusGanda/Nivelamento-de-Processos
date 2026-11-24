// Considera todos os números reservados, inclusive os legados no mesmo formato.
export function gerarNumeroOrdem(reservados: readonly string[]): string {
  let maior = BigInt(0);
  for (const reservado of reservados) {
    const sufixo = /^OP-(\d+)$/.exec(reservado)?.[1];
    if (sufixo !== undefined && BigInt(sufixo) > maior) maior = BigInt(sufixo);
  }
  return `OP-${String(maior + BigInt(1)).padStart(4, '0')}`;
}
