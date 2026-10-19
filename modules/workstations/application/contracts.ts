import type { AlteracaoPosto, CadastroPosto, Posto } from '../domain/posto.ts';

export interface PostoRepository {
  listar(): Promise<Posto[]>;
  buscarPorId(id: string): Promise<Posto | null>;
  buscarPorCodigo(codigo: string): Promise<Posto | null>;
  buscarSetor(id: string): Promise<{ id: string; nome: string } | null>;
  criar(dados: CadastroPosto): Promise<Posto>;
  alterar(id: string, dados: AlteracaoPosto): Promise<Posto | null>;
  definirAtivo(id: string, ativo: boolean): Promise<Posto | null>;
}
