import { ErroDeOperador, validarCadastroOperador, type CadastroOperador, type Operador } from '../domain/operador.ts';
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
    if (await this.operadores.buscarPorMatricula(dados.matricula)) {
      throw new ErroDeOperador('CONFLITO', 'Matrícula já cadastrada.');
    }
    return this.operadores.criar(dados);
  }
}
