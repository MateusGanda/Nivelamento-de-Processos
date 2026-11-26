import type { Baixa, Destino, ExecucaoAberta, ExecucaoAcompanhada, OrdemDisponivel, StatusExecucao } from '../domain/execucao.ts';

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
  /** Todas as execuções em execução ou pausadas, para o acompanhamento no painel. Somente leitura. */
  listarExecucoesAbertas(): Promise<ExecucaoAcompanhada[]>;
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
  // Baixa e encerramento parcial dependem do que já foi apontado na etapa. O repositório trava a ordem,
  // soma os encerramentos parciais da etapa e chama `quantidades` com essa soma, na mesma transação:
  // dois encerramentos simultâneos na mesma etapa não passam juntos da quantidade da ordem.
  // `quantidades` valida (regra do domínio) e devolve o que será gravado; um erro dela desfaz a transação.
  // A baixa também encerra as outras execuções abertas (em execução ou pausadas) da mesma ordem e
  // etapa, sem quantidades: a etapa foi concluída e elas não teriam como terminar (decisão de 07/11/2026).
  baixar(execucaoId: string, quantidades: (jaApontado: Baixa) => Baixa, agora: string): Promise<boolean>;
  encerrarParcial(execucaoId: string, quantidades: (jaApontado: Baixa) => Baixa, agora: string): Promise<boolean>;
}
