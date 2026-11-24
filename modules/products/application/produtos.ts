import { gerarCodigoProduto } from '../domain/codigo-produto.ts';
import {
  ehIdentificadorValido, ErroCodigoProdutoReservado, ErroDeProduto, validarAlteracaoProduto, validarCadastroProduto,
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
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const codigo = gerarCodigoProduto(await this.produtos.codigosReservados());
      try { return await this.produtos.criar({ ...dados, codigo }); }
      catch (erro) { if (!(erro instanceof ErroCodigoProdutoReservado)) throw erro; }
    }
    throw new ErroCodigoProdutoReservado();
  }

  async alterar(id: string, input: AlteracaoProduto): Promise<Produto> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const dados = validarAlteracaoProduto(input);
    if (!await this.produtos.buscarPorId(id)) throw naoEncontrado();
    const alterado = await this.produtos.alterar(id, dados);
    // O produto pode ter sido removido entre a consulta e a gravação.
    if (!alterado) throw naoEncontrado();
    return alterado;
  }

  // Inativo sai das listas de escolha de novos roteiros, mas continua nos que já o usam.
  async definirStatus(id: string, ativo: boolean): Promise<Produto> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    if (typeof ativo !== 'boolean') throw new ErroDeProduto('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
    const alterado = await this.produtos.definirAtivo(id, ativo);
    if (!alterado) throw naoEncontrado();
    return alterado;
  }
}
