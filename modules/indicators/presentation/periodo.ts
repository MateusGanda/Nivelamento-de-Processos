// Período da tela de indicadores, em dias inteiros do horário de Brasília.
// O Brasil não tem horário de verão desde 2019, então o fuso é sempre -03:00.
const FUSO = '-03:00';
const FUSO_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

export type Atalho = 'hoje' | '7dias' | '30dias';
export type Periodo = { inicio: string; fim: string };

/** Data AAAA-MM-DD do instante, no horário de Brasília. */
export function dataLocal(instanteMs: number): string {
  return new Date(instanteMs + FUSO_MS).toISOString().slice(0, 10);
}

function somarDias(data: string, dias: number): string {
  return new Date(Date.parse(data + 'T00:00:00Z') + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Dias de `primeiro` a `ultimo`, inclusive: a consulta vai até o início do dia seguinte. */
export function periodoEntreDatas(primeiro: string, ultimo: string): Periodo {
  return { inicio: primeiro + 'T00:00:00' + FUSO, fim: somarDias(ultimo, 1) + 'T00:00:00' + FUSO };
}

/** Hoje, ou os últimos 7 ou 30 dias contando hoje. */
export function periodoDoAtalho(atalho: Atalho, agoraMs: number): Periodo {
  const hoje = dataLocal(agoraMs);
  const dias = { hoje: 1, '7dias': 7, '30dias': 30 }[atalho];
  return periodoEntreDatas(somarDias(hoje, 1 - dias), hoje);
}

function dataValida(data: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && somarDias(data, 0) === data;
}

/** Confere as datas escolhidas na tela; devolve a mensagem de erro ou null. */
export function conferirDatas(primeiro: string, ultimo: string): string | null {
  if (!dataValida(primeiro) || !dataValida(ultimo)) return 'Informe as duas datas do período.';
  if (ultimo < primeiro) return 'A data final não pode ser anterior à inicial.';
  return null;
}
