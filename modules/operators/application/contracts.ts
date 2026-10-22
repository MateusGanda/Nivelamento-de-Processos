import type { AlteracaoOperador, NovoOperador, Operador, SetorPrincipal } from '../domain/operador.ts';

export interface OperadorRepository {
  listar(): Promise<Operador[]>;
  buscarPorId(id: string): Promise<Operador | null>;
  buscarSetorPrincipal(id: string): Promise<SetorPrincipal | null>;
  matriculasReservadas(): Promise<string[]>;
  criar(dados: NovoOperador): Promise<Operador>;
  alterar(id: string, dados: AlteracaoOperador): Promise<Operador | null>;
}
