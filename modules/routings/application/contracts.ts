import type { EtapaInformada, OperacaoDoRoteiro, RoteiroDetalhe, RoteiroResumo } from '../domain/roteiro.ts';

export interface RoteiroRepository {
  listar(): Promise<RoteiroResumo[]>;
  buscar(id: string): Promise<RoteiroDetalhe | null>;
  existeNome(nome: string): Promise<boolean>;
  criar(nome: string): Promise<string>;
  definirAtivo(id: string, ativo: boolean): Promise<boolean>;
  listarOperacoes(): Promise<OperacaoDoRoteiro[]>;
  buscarOperacoes(ids: readonly string[]): Promise<string[]>;
  buscarPostos(ids: readonly string[]): Promise<{ id: string; ativo: boolean }[]>;
  // As escritas abaixo são atômicas; substituirEtapas recusa o roteiro que passou a ter ordens.
  substituirEtapas(roteiroId: string, etapas: readonly EtapaInformada[]): Promise<void>;
  definirPostos(etapaId: string, postoIds: readonly string[]): Promise<void>;
  criarVersao(roteiroId: string): Promise<string>;
}
