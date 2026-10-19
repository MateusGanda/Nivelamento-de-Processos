import { ErroDeRoteiro } from '../domain/roteiro.ts';

const MENSAGENS: Record<string, string> = {
  Roteiro_nome_versao_key: 'Outra versão deste roteiro foi criada ao mesmo tempo. Atualize a página e tente novamente.',
  EtapaRoteiro_roteiroId_ordem_key: 'As etapas foram alteradas ao mesmo tempo por outra pessoa. Atualize a página e tente novamente.',
  ProdutoRoteiro_produtoId_roteiroId_key: 'Este produto já está ligado a este roteiro.',
  // O índice parcial ganha um sufixo no banco; a comparação usa o começo do nome.
  ProdutoRoteiro_vigente_unica: 'A vigência deste produto foi alterada ao mesmo tempo por outra pessoa. Atualize a página e tente novamente.',
};

const mensagemDaRestricao = (nome: string) => MENSAGENS[nome] ?? (nome.startsWith('ProdutoRoteiro_vigente_unica') ? MENSAGENS.ProdutoRoteiro_vigente_unica : undefined);

// Traduz as violações de unicidade que as consultas prévias não evitam em pedidos simultâneos.
// mensagemNomeVersao substitui a mensagem de nome + versão repetidos, usada na criação.
export function traduzirErroGravacaoRoteiro(erro: unknown, mensagemNomeVersao?: string): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    const mensagem = typeof dados.constraint === 'string' ? mensagemDaRestricao(dados.constraint) : undefined;
    if ((dados.sqlState ?? dados.code) === '23505' && mensagem) {
      throw new ErroDeRoteiro('CONFLITO', dados.constraint === 'Roteiro_nome_versao_key' && mensagemNomeVersao ? mensagemNomeVersao : mensagem);
    }
    atual = dados.cause;
  }
  throw erro;
}
