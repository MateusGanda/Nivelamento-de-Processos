import { ErroDeExecucao } from '../domain/execucao.ts';

// Os índices únicos parciais ganham um sufixo no banco; a comparação usa o começo do nome.
const RESTRICOES: [prefixo: string, mensagem: string][] = [
  ['Execucao_operador_aberta_unica', 'O operador já tem uma execução aberta. Finalize ou troque a operação antes de iniciar outra.'],
  ['Execucao_baixa_unica', 'Esta etapa da ordem já teve baixa.'],
];

// Traduz as violações que as consultas prévias não evitam em pedidos simultâneos.
export function traduzirErroGravacaoExecucao(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    const restricao = typeof dados.constraint === 'string' ? dados.constraint : '';
    const encontrada = RESTRICOES.find(([prefixo]) => restricao.startsWith(prefixo));
    if ((dados.sqlState ?? dados.code) === '23505' && encontrada) throw new ErroDeExecucao('CONFLITO', encontrada[1]);
    atual = dados.cause;
  }
  throw erro;
}
