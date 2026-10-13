import type { DadosSetor, Setor } from '../domain/setor.ts';

export interface SetorRepository {
  listar(): Promise<Setor[]>;
  buscarPorNome(nome: string): Promise<Setor | null>;
  criar(dados: DadosSetor): Promise<Setor>;
}
