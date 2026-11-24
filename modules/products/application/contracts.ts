import type { AlteracaoProduto, NovoProduto, Produto } from '../domain/produto.ts';

export interface ProdutoRepository {
  listar(): Promise<Produto[]>;
  buscarPorId(id: string): Promise<Produto | null>;
  codigosReservados(): Promise<string[]>;
  criar(dados: NovoProduto): Promise<Produto>;
  alterar(id: string, dados: AlteracaoProduto): Promise<Produto | null>;
  definirAtivo(id: string, ativo: boolean): Promise<Produto | null>;
}
