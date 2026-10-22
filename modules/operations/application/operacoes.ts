import {
  ehIdentificadorValido, ErroDeOperacao, validarAlteracaoOperacao, validarCadastroOperacao,
  type AlteracaoOperacao, type CadastroOperacao, type Operacao,
} from '../domain/operacao.ts';
import type { OperacaoRepository } from './contracts.ts';

const naoEncontrada = () => new ErroDeOperacao('NAO_ENCONTRADO', 'Operação não encontrada.');

export class OperacoesService {
  private readonly operacoes: OperacaoRepository;

  constructor(operacoes: OperacaoRepository) {
    this.operacoes = operacoes;
  }

  async listar(): Promise<Operacao[]> {
    return this.operacoes.listar();
  }

  async criar(input: CadastroOperacao): Promise<Operacao> {
    const dados = validarCadastroOperacao(input);
    if (await this.operacoes.buscarPorNome(dados.nome)) {
      throw new ErroDeOperacao('CONFLITO', 'Nome de operação já cadastrado.');
    }
    return this.operacoes.criar(dados);
  }

  async alterar(id: string, input: AlteracaoOperacao): Promise<Operacao> {
    if (!ehIdentificadorValido(id)) throw naoEncontrada();
    const dados = validarAlteracaoOperacao(input);
    if (!await this.operacoes.buscarPorId(id)) throw naoEncontrada();
    if (dados.nome !== undefined) {
      const outra = await this.operacoes.buscarPorNome(dados.nome);
      if (outra && outra.id !== id) throw new ErroDeOperacao('CONFLITO', 'Nome de operação já cadastrado.');
    }
    const alterada = await this.operacoes.alterar(id, dados);
    if (!alterada) throw naoEncontrada();
    return alterada;
  }

  // Inativa sai das listas de escolha de novos roteiros, mas continua nos que já a usam.
  async definirStatus(id: string, ativo: boolean): Promise<Operacao> {
    if (!ehIdentificadorValido(id)) throw naoEncontrada();
    if (typeof ativo !== 'boolean') throw new ErroDeOperacao('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
    const alterada = await this.operacoes.definirAtivo(id, ativo);
    if (!alterada) throw naoEncontrada();
    return alterada;
  }
}
