import type { AlteracaoPlano, NovoPlano, Plano } from '../domain/plano.ts';

export interface PlanoRepository {
  listar(): Promise<Plano[]>;
  buscarPorId(id: string): Promise<Plano | null>;
  codigosReservados(): Promise<string[]>;
  criar(dados: NovoPlano): Promise<Plano>;
  alterar(id: string, dados: AlteracaoPlano): Promise<Plano | null>;
}
