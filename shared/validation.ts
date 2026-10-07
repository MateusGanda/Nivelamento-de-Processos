/** Instantes em milissegundos Unix; fim exclusivo. */
export type Janela = { inicioMs: number; fimMs: number };

export function naoNegativo(valor: number, campo: string): void {
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`${campo}: informe um número finito não negativo.`);
}

/** Valor não negativo com no máximo duas casas decimais, devolvido em centésimos
 * inteiros. Somar em centésimos evita erro de ponto flutuante (0,1 + 0,2).
 */
export function centesimos(valor: number, campo: string): number {
  naoNegativo(valor, campo);
  const c = Math.round(valor * 100);
  if (!Number.isSafeInteger(c) || Math.abs(valor * 100 - c) > 1e-6) {
    throw new Error(`${campo}: informe no máximo duas casas decimais.`);
  }
  return c;
}

/** Quantidade como no banco: decimal não negativo com até duas casas. */
export function quantidade(valor: number): void {
  centesimos(valor, 'Quantidade');
}

export function validarJanela(j: Janela): void {
  if (!Number.isSafeInteger(j.inicioMs) || !Number.isSafeInteger(j.fimMs) || j.fimMs <= j.inicioMs) {
    throw new Error('Janela inválida: fim deve ser posterior ao início, em milissegundos Unix inteiros.');
  }
}

export function intersecao(a: Janela, b: Janela): Janela | null {
  const inicioMs = Math.max(a.inicioMs, b.inicioMs);
  const fimMs = Math.min(a.fimMs, b.fimMs);
  return fimMs > inicioMs ? { inicioMs, fimMs } : null;
}

export function segundos(j: Janela): number {
  return (j.fimMs - j.inicioMs) / 1000;
}
