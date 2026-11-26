// Prazo da ordem: a data de fim do plano de produção que agrupa a ordem (decisão de 26/11/2026, pedido da banca).
// A ordem não tem data de entrega própria; o plano é que tem o período.

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Atraso de UMA ordem em `hoje` (AAAA-MM-DD, horário de Brasília). Está atrasada a ordem ainda não
 * concluída (com etapa sem baixa) cujo prazo já passou: o último dia do plano conta como dentro do prazo.
 * Sem prazo ou concluída: não há atraso. `diasDeAtraso` conta os dias corridos depois do prazo.
 */
export function avaliarPrazo(prazo: string | null, concluida: boolean, hoje: string): { atrasada: boolean; diasDeAtraso: number | null } {
  if (!DATA.test(hoje)) throw new Error('Data de hoje inválida: use AAAA-MM-DD.');
  if (prazo === null || concluida) return { atrasada: false, diasDeAtraso: null };
  if (!DATA.test(prazo)) throw new Error('Prazo inválido: use AAAA-MM-DD.');
  if (prazo >= hoje) return { atrasada: false, diasDeAtraso: null };
  return { atrasada: true, diasDeAtraso: Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${prazo}T00:00:00Z`)) / DIA_MS) };
}
