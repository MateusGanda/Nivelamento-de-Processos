import { ErroDePosto } from '../domain/posto.ts';

// Traduz as violações do banco que a consulta prévia não evita em pedidos simultâneos.
export function traduzirErroCriacaoPosto(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    const estado = dados.sqlState ?? dados.code;
    if (estado === '23505' && dados.constraint === 'Posto_codigo_key') {
      throw new ErroDePosto('CONFLITO', 'Código de posto já cadastrado.');
    }
    if (estado === '23503' && dados.constraint === 'Posto_setorId_fkey') {
      throw new ErroDePosto('ENTRADA_INVALIDA', 'Setor não encontrado.');
    }
    atual = dados.cause;
  }
  throw erro;
}
