import { ehIdentificadorValido, ErroDeOperador, ErroMatriculaReservada, validarAlteracaoOperador, validarCadastroOperador, type AlteracaoOperador, type CadastroOperador, type Operador } from '../domain/operador.ts';
import { gerarMatriculaOperador } from '../domain/matricula.ts';
import type { OperadorRepository } from './contracts.ts';

export class OperadoresService {
  private readonly operadores: OperadorRepository;

  constructor(operadores: OperadorRepository) {
    this.operadores = operadores;
  }

  async listar(): Promise<Operador[]> {
    return this.operadores.listar();
  }

  async criar(input: CadastroOperador): Promise<Operador> {
    const dados = validarCadastroOperador(input);
    const setor = await this.exigirSetor(dados.setorPrincipalId);
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const matricula = gerarMatriculaOperador(dados.nome, setor.codigo, await this.operadores.matriculasReservadas());
      try { return await this.operadores.criar({ ...dados, matricula }); }
      catch (erro) { if (!(erro instanceof ErroMatriculaReservada)) throw erro; }
    }
    throw new ErroMatriculaReservada();
  }

  async alterar(id: string, input: AlteracaoOperador): Promise<Operador> {
    const naoEncontrado = () => new ErroDeOperador('NAO_ENCONTRADO', 'Operador não encontrado.');
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const dados = validarAlteracaoOperador(input);
    const atual = await this.operadores.buscarPorId(id);
    if (!atual) throw naoEncontrado();
    // Manter o setor atual é sempre permitido; trocar só para um setor ativo.
    if (dados.setorPrincipalId !== undefined && dados.setorPrincipalId !== atual.setorPrincipal?.id) await this.exigirSetor(dados.setorPrincipalId);
    const alterado = await this.operadores.alterar(id, dados);
    if (!alterado) throw naoEncontrado();
    return alterado;
  }

  private async exigirSetor(id: string) {
    const setor = await this.operadores.buscarSetorPrincipal(id);
    if (!setor) throw new ErroDeOperador('ENTRADA_INVALIDA', 'Setor principal não encontrado.');
    if (!setor.ativo) throw new ErroDeOperador('ENTRADA_INVALIDA', 'Setor inativo não pode ser o setor principal.');
    return setor;
  }
}
