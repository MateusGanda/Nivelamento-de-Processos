// Saída automática da ilha (decisão da equipe em 05/11/2026). Limpar a identificação só muda a tela:
// a execução no banco continua como está, sem pausa nem finalização.

/** Depois de um registro concluído, a confirmação fica na tela por este tempo, com contagem. */
export const CONFIRMACAO_MS = 10_000;
/** Sem toque, clique, tecla ou leitura do leitor por este tempo, a identificação é limpa. */
export const INATIVIDADE_MS = 30_000;

export type SituacaoLimpeza = {
  /** Há operador identificado ou matrícula digitada no campo. */
  temIdentificacao: boolean;
  /** Pedido em andamento: não limpa até a resposta, como o botão Sair. */
  ocupado: boolean;
  /** Terminal sendo bloqueado: a tela já foi limpa e nenhum tempo corre. */
  bloqueando: boolean;
  ultimaInteracaoMs: number;
  /** Instante em que um registro foi concluído; null quando não há contagem. */
  confirmacaoDesdeMs: number | null;
};

export type DecisaoLimpeza =
  | { tipo: 'nada' }
  | { tipo: 'contagem'; segundosRestantes: number }
  | { tipo: 'aguardando' }
  | { tipo: 'limpar'; motivo: 'confirmacao' | 'inatividade' };

/**
 * Decide o que a tela faz no instante `agoraMs`. Uma interação depois do registro cancela a contagem
 * da confirmação e passa a valer a regra de inatividade. O cálculo usa o relógio, e não a soma de
 * intervalos, para continuar certo quando o navegador atrasa os timers de uma aba em segundo plano.
 */
export function avaliarLimpeza(situacao: SituacaoLimpeza, agoraMs: number): DecisaoLimpeza {
  const { temIdentificacao, ocupado, bloqueando, ultimaInteracaoMs, confirmacaoDesdeMs } = situacao;
  if (!temIdentificacao || ocupado || bloqueando) return { tipo: 'nada' };

  if (confirmacaoDesdeMs !== null && ultimaInteracaoMs <= confirmacaoDesdeMs) {
    const restante = confirmacaoDesdeMs + CONFIRMACAO_MS - agoraMs;
    if (restante <= 0) return { tipo: 'limpar', motivo: 'confirmacao' };
    return { tipo: 'contagem', segundosRestantes: Math.min(CONFIRMACAO_MS / 1000, Math.ceil(restante / 1000)) };
  }

  return ultimaInteracaoMs + INATIVIDADE_MS - agoraMs <= 0 ? { tipo: 'limpar', motivo: 'inatividade' } : { tipo: 'aguardando' };
}
