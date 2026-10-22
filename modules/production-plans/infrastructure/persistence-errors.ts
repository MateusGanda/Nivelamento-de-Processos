import { ErroDePlano } from '../domain/plano.ts';

// Traduz a violação do código único que a consulta prévia não evita em pedidos simultâneos.
export function traduzirErroGravacaoPlano(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    if ((dados.sqlState ?? dados.code) === '23505' && dados.constraint === 'PlanoProducao_codigo_key') {
      throw new ErroDePlano('CONFLITO', 'Código de plano já cadastrado.');
    }
    atual = dados.cause;
  }
  throw erro;
}
