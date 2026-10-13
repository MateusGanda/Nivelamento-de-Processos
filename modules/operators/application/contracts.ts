import type { CadastroOperador, Operador } from '../domain/operador.ts';

export interface OperadorRepository {
  listar(): Promise<Operador[]>;
  buscarPorMatricula(matricula: string): Promise<Operador | null>;
  criar(dados: CadastroOperador): Promise<Operador>;
}
