import type { AlteracaoOrdem, NovaOrdem, OpcoesOrdem, Ordem } from '../domain/ordem.ts';

export type ProdutoConsultado = { id: string; ativo: boolean };
export type RoteiroConsultado = { id: string; ativo: boolean; quantidadeEtapas: number; ligadoAoProduto: boolean };

export interface OrdemRepository {
  listar(): Promise<Ordem[]>;
  buscarPorId(id: string): Promise<Ordem | null>;
  numerosReservados(): Promise<string[]>;
  listarOpcoes(): Promise<OpcoesOrdem>;
  existePlano(id: string): Promise<boolean>;
  buscarProduto(id: string): Promise<ProdutoConsultado | null>;
  buscarRoteiro(roteiroId: string, produtoId: string): Promise<RoteiroConsultado | null>;
  criar(dados: NovaOrdem): Promise<Ordem>;
  // Recusa mudar quantidade ou unidade se a ordem passou a ter execuções.
  alterar(id: string, dados: AlteracaoOrdem): Promise<Ordem | null>;
}
