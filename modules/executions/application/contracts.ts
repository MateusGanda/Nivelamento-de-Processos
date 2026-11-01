import type { Baixa, Destino, ExecucaoAberta, OrdemDisponivel, StatusExecucao } from '../domain/execucao.ts';

export type OperadorEncontrado = { id: string; matricula: string; nome: string; ativo: boolean; setor: string | null };
export type ExecucaoEncontrada = { id: string; operadorId: string; status: StatusExecucao; quantidadeOrdem: number };

// Situação do destino escolhido, conferida antes de gravar.
export type SituacaoDestino = {
  ordemExiste: boolean;
  etapaDaOrdem: boolean;
  etapaBaixada: boolean;
  posto: { ativo: boolean; compativel: boolean } | null;
};

export interface ExecucaoRepository {
  buscarOperador(matricula: string): Promise<OperadorEncontrado | null>;
  buscarExecucaoAberta(operadorId: string): Promise<ExecucaoAberta | null>;
  buscarExecucao(id: string): Promise<ExecucaoEncontrada | null>;
  listarOrdensDisponiveis(): Promise<OrdemDisponivel[]>;
  listarMotivosAtivos(): Promise<{ id: string; nome: string }[]>;
  buscarMotivo(id: string): Promise<{ id: string; ativo: boolean } | null>;
  conferirDestino(destino: Destino): Promise<SituacaoDestino>;
  // As escritas abaixo são atômicas. As que mudam o estado só gravam se a execução ainda
  // estiver no estado esperado e devolvem false (ou null) quando outro pedido chegou antes.
  iniciar(operadorId: string, destino: Destino, agora: string): Promise<string>;
  pausar(execucaoId: string, motivoId: string, agora: string): Promise<boolean>;
  retomar(execucaoId: string, agora: string): Promise<boolean>;
  trocar(execucaoId: string, operadorId: string, destino: Destino, agora: string): Promise<string | null>;
  baixar(execucaoId: string, baixa: Baixa, agora: string): Promise<boolean>;
}
