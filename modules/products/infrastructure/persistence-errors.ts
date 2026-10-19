import { ErroDeProduto } from '../domain/produto.ts';

// Traduz a violação do código único que a consulta prévia não evita em pedidos simultâneos.
export function traduzirErroGravacaoProduto(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    if ((dados.sqlState ?? dados.code) === '23505' && dados.constraint === 'Produto_codigo_key') {
      throw new ErroDeProduto('CONFLITO', 'Código de produto já cadastrado.');
    }
    atual = dados.cause;
  }
  throw erro;
}
