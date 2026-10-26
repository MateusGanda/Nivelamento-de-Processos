import type { AlteracaoOperador, NovoOperador, Operador, SetorPrincipal } from '../domain/operador.ts';

export interface OperadorRepository {
  listar(): Promise<Operador[]>;
  buscarPorId(id: string): Promise<Operador | null>;
  buscarSetorPrincipal(id: string): Promise<(SetorPrincipal & { ativo: boolean }) | null>;
  matriculasReservadas(): Promise<string[]>;
  criar(dados: NovoOperador): Promise<Operador>;
  alterar(id: string, dados: AlteracaoOperador): Promise<Operador | null>;
  definirAtivo(id: string, ativo: boolean): Promise<Operador | null>;
  // Execução em andamento ou pausada do operador.
  temExecucaoAberta(id: string): Promise<boolean>;
}
