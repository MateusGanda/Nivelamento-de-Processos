import type { CadastroPosto, Posto } from '../domain/posto.ts';

export interface PostoRepository {
  listar(): Promise<Posto[]>;
  buscarPorCodigo(codigo: string): Promise<Posto | null>;
  buscarSetor(id: string): Promise<{ id: string; nome: string } | null>;
  criar(dados: CadastroPosto): Promise<Posto>;
}
