import { ErroDeOrdem } from '../domain/ordem.ts';

// Traduz as violações que as consultas prévias não evitam em pedidos simultâneos.
export function traduzirErroGravacaoOrdem(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    const estado = dados.sqlState ?? dados.code;
    if (estado === '23505' && dados.constraint === 'OrdemProducao_numero_key') throw new ErroDeOrdem('CONFLITO', 'Número de ordem já cadastrado.');
    if (estado === '23503' && dados.constraint === 'OrdemProducao_planoProducaoId_fkey') throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Plano de produção não encontrado.');
    atual = dados.cause;
  }
  throw erro;
}
