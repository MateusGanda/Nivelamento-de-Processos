import type { PostoNoPainel } from '../application/painel-tv.ts';

// Regras puras da tela da TV (sem React), para poderem ser testadas.

/** Quadros de posto por página da TV; acima disso as páginas se alternam. */
export const POSTOS_POR_PAGINA = 9;
/** Tempo de cada página quando há mais postos do que cabem. */
export const TEMPO_POR_PAGINA_MS = 20_000;
/** A TV recarrega a página de tempos em tempos para receber versões novas do sistema. */
export const RECARREGAR_A_CADA_MS = 6 * 3_600_000;

export function paginarPostos(postos: readonly PostoNoPainel[], pagina: number): { itens: PostoNoPainel[]; total: number; atual: number } {
  const total = Math.max(1, Math.ceil(postos.length / POSTOS_POR_PAGINA));
  const atual = ((pagina % total) + total) % total;
  return { itens: postos.slice(atual * POSTOS_POR_PAGINA, (atual + 1) * POSTOS_POR_PAGINA), total, atual };
}

/** Contagem do topo da tela: quantos postos estão em cada situação. */
export function resumoDosPostos(postos: readonly PostoNoPainel[]) {
  return {
    emExecucao: postos.filter((p) => p.situacao === 'EM_EXECUCAO').length,
    pausados: postos.filter((p) => p.situacao === 'PAUSADA').length,
    livres: postos.filter((p) => p.situacao === 'LIVRE').length,
  };
}
