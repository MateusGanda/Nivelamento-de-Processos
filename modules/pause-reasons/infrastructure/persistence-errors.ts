import { ErroDeMotivoPausa } from '../domain/motivoPausa.ts';

// A constraint continua sendo a garantia contra duplicidade em pedidos simultâneos.
export function traduzirErroGravacaoMotivoPausa(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    if ((dados.sqlState === '23505' || dados.code === '23505') && dados.constraint === 'MotivoPausa_nome_key') {
      throw new ErroDeMotivoPausa('CONFLITO', 'Nome de motivo de pausa já cadastrado.');
    }
    atual = dados.cause;
  }
  throw erro;
}
