/** Instantes em milissegundos Unix; fim exclusivo. */
export type Janela = { inicioMs: number; fimMs: number };

export function naoNegativo(valor: number, campo: string): void {
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`${campo}: informe um número finito não negativo.`);
}

export function quantidade(valor: number): void {
  naoNegativo(valor, 'Quantidade');
  if (!Number.isSafeInteger(valor)) throw new Error('Quantidade: informe pares inteiros seguros.');
}

export function validarJanela(j: Janela): void {
  if (!Number.isSafeInteger(j.inicioMs) || !Number.isSafeInteger(j.fimMs) || j.fimMs <= j.inicioMs) {
    throw new Error('Janela inválida: fim deve ser posterior ao início, em milissegundos Unix inteiros.');
  }
}

/** Devolve cópia ordenada; não altera a entrada. Limites adjacentes são aceitos. */
export function semSobreposicao<T extends Janela>(itens: readonly T[]): T[] {
  const ordenados = [...itens].sort((a, b) => a.inicioMs - b.inicioMs);
  ordenados.forEach((item, i) => {
    validarJanela(item);
    if (i > 0 && item.inicioMs < ordenados[i - 1].fimMs) throw new Error('Intervalos sobrepostos.');
  });
  return ordenados;
}

export function intersecao(a: Janela, b: Janela): Janela | null {
  const inicioMs = Math.max(a.inicioMs, b.inicioMs);
  const fimMs = Math.min(a.fimMs, b.fimMs);
  return fimMs > inicioMs ? { inicioMs, fimMs } : null;
}

export function segundos(j: Janela): number {
  return (j.fimMs - j.inicioMs) / 1000;
}
