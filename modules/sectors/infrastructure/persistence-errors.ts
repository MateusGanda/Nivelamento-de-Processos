import { ErroDeSetor } from '../domain/setor.ts';

export function traduzirErroCriacaoSetor(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    if ((dados.sqlState === '23505' || dados.code === '23505') && dados.constraint === 'Setor_nome_key') {
      throw new ErroDeSetor('CONFLITO', 'Nome de setor já cadastrado.');
    }
    atual = dados.cause;
  }
  throw erro;
}
