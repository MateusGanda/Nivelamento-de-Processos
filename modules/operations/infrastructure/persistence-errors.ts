import { ErroDeOperacao } from '../domain/operacao.ts';

// A constraint continua sendo a garantia contra duplicidade em pedidos simultâneos.
export function traduzirErroGravacaoOperacao(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    if ((dados.sqlState === '23505' || dados.code === '23505') && dados.constraint === 'Operacao_nome_key') {
      throw new ErroDeOperacao('CONFLITO', 'Nome de operação já cadastrado.');
    }
    atual = dados.cause;
  }
  throw erro;
}
