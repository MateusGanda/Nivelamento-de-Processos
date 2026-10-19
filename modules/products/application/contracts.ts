import type { AlteracaoProduto, CadastroProduto, Produto } from '../domain/produto.ts';

export interface ProdutoRepository {
  listar(): Promise<Produto[]>;
  buscarPorId(id: string): Promise<Produto | null>;
  buscarPorCodigo(codigo: string): Promise<Produto | null>;
  criar(dados: CadastroProduto): Promise<Produto>;
  alterar(id: string, dados: AlteracaoProduto): Promise<Produto | null>;
}
