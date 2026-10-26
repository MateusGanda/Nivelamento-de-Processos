import { validarJanela } from '../../../shared/validation.ts';
import type { Janela } from '../../../shared/validation.ts';

/** O Brasil não tem horário de verão desde 2019: o dia de Brasília é sempre UTC−3. */
export const FUSO_BRASILIA_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
/** Acima disso a série por dia não é montada: o gráfico deixaria de ser legível. */
export const MAXIMO_DE_DIAS = 366;

export type Dia = Janela & { data: string };

/** Dias locais que cobrem o período, cada um recortado a ele. A data é AAAA-MM-DD no fuso. */
export function dividirEmDias(periodo: Janela, deslocamentoMs = FUSO_BRASILIA_MS): Dia[] {
  validarJanela(periodo);
  const dias: Dia[] = [];
  let inicioDoDia = Math.floor((periodo.inicioMs + deslocamentoMs) / DIA_MS) * DIA_MS - deslocamentoMs;
  while (inicioDoDia < periodo.fimMs) {
    if (dias.length === MAXIMO_DE_DIAS) return [];
    const fimDoDia = inicioDoDia + DIA_MS;
    dias.push({
      data: new Date(inicioDoDia + deslocamentoMs).toISOString().slice(0, 10),
      inicioMs: Math.max(inicioDoDia, periodo.inicioMs),
      fimMs: Math.min(fimDoDia, periodo.fimMs),
    });
    inicioDoDia = fimDoDia;
  }
  return dias;
}

/** Data local (AAAA-MM-DD) de um instante. */
export function dataDoInstante(instanteMs: number, deslocamentoMs = FUSO_BRASILIA_MS): string {
  return new Date(instanteMs + deslocamentoMs).toISOString().slice(0, 10);
}
