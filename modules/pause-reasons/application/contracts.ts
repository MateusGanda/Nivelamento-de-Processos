import type { AlteracaoMotivoPausa, DadosMotivoPausa, MotivoPausa } from '../domain/motivoPausa.ts';

export interface MotivoPausaRepository {
  listar(): Promise<MotivoPausa[]>;
  buscarPorId(id: string): Promise<MotivoPausa | null>;
  buscarPorNome(nome: string): Promise<MotivoPausa | null>;
  criar(dados: DadosMotivoPausa): Promise<MotivoPausa>;
  alterar(id: string, dados: AlteracaoMotivoPausa): Promise<MotivoPausa | null>;
  definirAtivo(id: string, ativo: boolean): Promise<MotivoPausa | null>;
}
