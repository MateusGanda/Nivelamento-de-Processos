import type { NovoSetor, Setor } from '../domain/setor.ts';

export interface SetorRepository {
  listar(): Promise<Setor[]>;
  buscarPorNome(nome: string): Promise<Setor | null>;
  codigosReservados(): Promise<string[]>;
  criar(dados: NovoSetor): Promise<Setor>;
}
