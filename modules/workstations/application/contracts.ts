import type { AlteracaoPosto, NovoPosto, Posto } from '../domain/posto.ts';

export interface PostoRepository {
  listar(): Promise<Posto[]>;
  buscarPorId(id: string): Promise<Posto | null>;
  codigosReservados(): Promise<string[]>;
  buscarSetor(id: string): Promise<{ id: string; nome: string; ativo: boolean } | null>;
  criar(dados: NovoPosto): Promise<Posto>;
  alterar(id: string, dados: AlteracaoPosto): Promise<Posto | null>;
  definirAtivo(id: string, ativo: boolean): Promise<Posto | null>;
}
