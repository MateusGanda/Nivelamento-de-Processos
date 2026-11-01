// Formatação dos valores da tela de indicadores. A API manda números sem arredondar;
// `null` é indisponível e nunca é mostrado como zero.

const quantidade = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const percentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const instante = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const INDISPONIVEL = '—';

/** Duração legível: "45 s", "12 min", "2 h 05 min". */
export function formatarDuracao(segundos: number | null): string {
  if (segundos === null) return INDISPONIVEL;
  const total = Math.max(0, Math.round(segundos));
  if (total < 60) return `${total} s`;
  const minutos = Math.floor(total / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

export function formatarQuantidade(valor: number, unidade: string): string {
  return `${quantidade.format(valor)} ${unidade}`;
}

export function formatarPercentual(valor: number | null): string {
  return valor === null ? INDISPONIVEL : `${percentual.format(valor)}%`;
}

/** Segundos por unidade com até duas casas, por exemplo "110,5 s/un". */
export function formatarSegundosPorUnidade(valor: number | null, unidade: string): string {
  return valor === null ? INDISPONIVEL : `${quantidade.format(valor)} s/${unidade}`;
}

export function formatarInstante(iso: string | null): string {
  return iso === null ? INDISPONIVEL : instante.format(new Date(iso));
}

/** Passo "redondo" para as marcas do eixo, em segundos, com no máximo quatro marcas. */
export function passoDoEixo(maximoSegundos: number): number {
  const passos = [60, 300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400];
  return passos.find((p) => maximoSegundos / p <= 4) ?? Math.ceil(maximoSegundos / 4 / 86400) * 86400;
}
