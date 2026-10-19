import { ErroDeRoteiro } from '../domain/roteiro.ts';

const MENSAGENS: Record<string, string> = {
  Roteiro_nome_versao_key: 'Outra versão deste roteiro foi criada ao mesmo tempo. Atualize a página e tente novamente.',
  EtapaRoteiro_roteiroId_ordem_key: 'As etapas foram alteradas ao mesmo tempo por outra pessoa. Atualize a página e tente novamente.',
};

// Traduz as violações de unicidade que as consultas prévias não evitam em pedidos simultâneos.
// mensagemNomeVersao substitui a mensagem de nome + versão repetidos, usada na criação.
export function traduzirErroGravacaoRoteiro(erro: unknown, mensagemNomeVersao?: string): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    if ((dados.sqlState ?? dados.code) === '23505' && typeof dados.constraint === 'string' && MENSAGENS[dados.constraint]) {
      const mensagem = dados.constraint === 'Roteiro_nome_versao_key' && mensagemNomeVersao ? mensagemNomeVersao : MENSAGENS[dados.constraint];
      throw new ErroDeRoteiro('CONFLITO', mensagem);
    }
    atual = dados.cause;
  }
  throw erro;
}
