import {
  ehIdentificadorValido, ErroDeProduto, validarAlteracaoProduto, validarCadastroProduto,
  type AlteracaoProduto, type CadastroProduto, type Produto,
} from '../domain/produto.ts';
import type { ProdutoRepository } from './contracts.ts';

const naoEncontrado = () => new ErroDeProduto('NAO_ENCONTRADO', 'Produto não encontrado.');

export class ProdutosService {
  private readonly produtos: ProdutoRepository;

  constructor(produtos: ProdutoRepository) {
    this.produtos = produtos;
  }

  async listar(): Promise<Produto[]> {
    return this.produtos.listar();
  }

  async criar(input: CadastroProduto): Promise<Produto> {
    const dados = validarCadastroProduto(input);
    if (await this.produtos.buscarPorCodigo(dados.codigo)) {
      throw new ErroDeProduto('CONFLITO', 'Código de produto já cadastrado.');
    }
    return this.produtos.criar(dados);
  }

  async alterar(id: string, input: AlteracaoProduto): Promise<Produto> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const dados = validarAlteracaoProduto(input);
    if (!await this.produtos.buscarPorId(id)) throw naoEncontrado();
    if (dados.codigo !== undefined) {
      const outro = await this.produtos.buscarPorCodigo(dados.codigo);
      if (outro && outro.id !== id) throw new ErroDeProduto('CONFLITO', 'Código de produto já cadastrado.');
    }
    const alterado = await this.produtos.alterar(id, dados);
    // O produto pode ter sido removido entre a consulta e a gravação.
    if (!alterado) throw naoEncontrado();
    return alterado;
  }
}
