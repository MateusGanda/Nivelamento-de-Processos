const PARTICULAS = new Set(['de', 'da', 'das', 'do', 'dos', 'e']);

export function iniciaisOperador(nome: string): string {
  const palavras = nome.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().match(/\p{L}+/gu) ?? [];
  const significativas = palavras.filter((palavra) => !PARTICULAS.has(palavra.toLowerCase()));
  return (significativas.length ? significativas : palavras).slice(0, 4).map((palavra) => Array.from(palavra)[0]).join('') || 'OP';
}

export function gerarMatriculaOperador(nome: string, codigoSetor: string, reservadas: readonly string[]): string {
  const base = iniciaisOperador(nome);
  const final = `-${codigoSetor}`;
  let maior = BigInt(0);
  for (const matricula of reservadas) {
    if (!matricula.startsWith(base) || !matricula.endsWith(final)) continue;
    const numero = matricula.slice(base.length, -final.length);
    if (numero === '') { if (maior < BigInt(1)) maior = BigInt(1); }
    else if (/^[1-9]\d*$/.test(numero) && BigInt(numero) > maior) maior = BigInt(numero);
  }
  const proximo = maior + BigInt(1);
  return `${base}${proximo === BigInt(1) ? '' : proximo}${final}`;
}
