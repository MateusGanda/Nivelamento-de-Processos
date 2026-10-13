import { ErroDeOperador } from '../domain/operador.ts';

export function traduzirErroCriacaoOperador(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    if ((dados.sqlState === '23505' || dados.code === '23505') && dados.constraint === 'Operador_matricula_key') {
      throw new ErroDeOperador('CONFLITO', 'Matrícula já cadastrada.');
    }
    atual = dados.cause;
  }
  throw erro;
}
