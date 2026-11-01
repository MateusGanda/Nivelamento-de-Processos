import type { AlteracaoSetor, NovoSetor, Setor } from '../domain/setor.ts';

export interface SetorRepository {
  listar(): Promise<Setor[]>;
  buscarPorId(id: string): Promise<Setor | null>;
  buscarPorNome(nome: string): Promise<Setor | null>;
  codigosReservados(): Promise<string[]>;
  criar(dados: NovoSetor): Promise<Setor>;
  alterar(id: string, dados: AlteracaoSetor): Promise<Setor | null>;
  definirAtivo(id: string, ativo: boolean): Promise<Setor | null>;
}
