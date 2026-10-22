/** Código funcional permanente, independente do UUID e das alterações do nome. */
export function baseCodigoSetor(nome: string): string {
  const letras = nome.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().match(/\p{L}/gu) ?? [];
  return letras.slice(0, 3).join('') || 'SET';
}

export function gerarCodigoSetor(nome: string, reservados: readonly string[]): string {
  const base = baseCodigoSetor(nome);
  let maior = BigInt(0);
  for (const codigo of reservados) {
    if (!codigo.startsWith(base)) continue;
    const numero = codigo.slice(base.length);
    if (/^[1-9]\d*$/.test(numero) && BigInt(numero) > maior) maior = BigInt(numero);
  }
  return `${base}${maior + BigInt(1)}`;
}
