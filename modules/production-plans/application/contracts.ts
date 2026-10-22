import type { AlteracaoPlano, DadosPlano, Plano } from '../domain/plano.ts';

export interface PlanoRepository {
  listar(): Promise<Plano[]>;
  buscarPorId(id: string): Promise<Plano | null>;
  buscarPorCodigo(codigo: string): Promise<Plano | null>;
  criar(dados: DadosPlano): Promise<Plano>;
  alterar(id: string, dados: AlteracaoPlano): Promise<Plano | null>;
}
