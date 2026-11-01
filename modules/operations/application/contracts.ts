import type { AlteracaoOperacao, DadosOperacao, Operacao } from '../domain/operacao.ts';

export interface OperacaoRepository {
  listar(): Promise<Operacao[]>;
  buscarPorId(id: string): Promise<Operacao | null>;
  buscarPorNome(nome: string): Promise<Operacao | null>;
  criar(dados: DadosOperacao): Promise<Operacao>;
  alterar(id: string, dados: AlteracaoOperacao): Promise<Operacao | null>;
  definirAtivo(id: string, ativo: boolean): Promise<Operacao | null>;
}
