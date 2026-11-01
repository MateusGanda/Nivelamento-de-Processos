import {
  ehIdentificadorValido, ErroDeOrdem, MENSAGEM_ORDEM_COM_EXECUCOES, validarAlteracaoOrdem, validarCadastroOrdem,
  type AlteracaoOrdem, type CadastroOrdem, type OpcoesOrdem, type Ordem,
} from '../domain/ordem.ts';
import type { OrdemRepository } from './contracts.ts';

const naoEncontrada = () => new ErroDeOrdem('NAO_ENCONTRADO', 'Ordem de produção não encontrada.');
const numeroRepetido = () => new ErroDeOrdem('CONFLITO', 'Número de ordem já cadastrado.');

export class OrdensService {
  private readonly ordens: OrdemRepository;

  constructor(ordens: OrdemRepository) {
    this.ordens = ordens;
  }

  async listar(): Promise<Ordem[]> {
    return this.ordens.listar();
  }

  async listarOpcoes(): Promise<OpcoesOrdem> {
    return this.ordens.listarOpcoes();
  }

  async criar(input: CadastroOrdem): Promise<Ordem> {
    const dados = validarCadastroOrdem(input);
    if (!await this.ordens.existePlano(dados.planoId)) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Plano de produção não encontrado.');
    const produto = await this.ordens.buscarProduto(dados.produtoId);
    if (!produto) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Produto não encontrado.');
    if (!produto.ativo) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Produto inativo não pode receber ordens novas.');
    const roteiro = await this.ordens.buscarRoteiro(dados.roteiroId, dados.produtoId);
    if (!roteiro) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Roteiro não encontrado.');
    if (!roteiro.ligadoAoProduto) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Esta versão de roteiro não está ligada ao produto.');
    if (!roteiro.ativo) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Roteiro inativo não pode receber ordens novas.');
    if (roteiro.quantidadeEtapas === 0) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'O roteiro escolhido ainda não tem etapas.');
    if (await this.ordens.existeNumero(dados.numero)) throw numeroRepetido();
    return this.ordens.criar(dados);
  }

  async alterar(id: string, input: AlteracaoOrdem): Promise<Ordem> {
    if (!ehIdentificadorValido(id)) throw naoEncontrada();
    const dados = validarAlteracaoOrdem(input);
    const atual = await this.ordens.buscarPorId(id);
    if (!atual) throw naoEncontrada();
    const mudaProducao = (dados.quantidade !== undefined && dados.quantidade !== atual.quantidade) ||
      (dados.unidade !== undefined && dados.unidade !== atual.unidade);
    // A baixa confere a soma das quantidades com a quantidade da ordem; depois de executada, ela não muda.
    if (mudaProducao && atual.quantidadeExecucoes > 0) throw new ErroDeOrdem('CONFLITO', MENSAGEM_ORDEM_COM_EXECUCOES);
    if (dados.planoId !== undefined && dados.planoId !== atual.plano.id && !await this.ordens.existePlano(dados.planoId)) {
      throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Plano de produção não encontrado.');
    }
    if (dados.numero !== undefined && dados.numero !== atual.numero && await this.ordens.existeNumero(dados.numero)) throw numeroRepetido();
    const alterada = await this.ordens.alterar(id, dados);
    // A ordem pode ter sido removida entre a consulta e a gravação.
    if (!alterada) throw naoEncontrada();
    return alterada;
  }
}
