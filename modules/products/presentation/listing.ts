import type { Produto } from '../domain/produto.ts';

export type ColunaProduto = 'codigo' | 'nome' | 'createdAt' | 'updatedAt';
export type OrdemProduto = { coluna: ColunaProduto; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

export function filtrarOrdenarProdutos(produtos: readonly Produto[], busca: string, ordem: OrdemProduto): Produto[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return produtos.filter((produto) => !termo || [produto.codigo, produto.nome].some((campo) => textoBusca(campo).includes(termo)))
    .sort((a, b) => {
      const comparacao = ordem.coluna === 'createdAt' || ordem.coluna === 'updatedAt'
        ? Date.parse(a[ordem.coluna]) - Date.parse(b[ordem.coluna])
        : collation.compare(a[ordem.coluna], b[ordem.coluna]);
      return (comparacao || collation.compare(a.codigo, b.codigo) || a.id.localeCompare(b.id)) * (ordem.direcao === 'asc' ? 1 : -1);
    });
}

export function formatarDataCadastro(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}
