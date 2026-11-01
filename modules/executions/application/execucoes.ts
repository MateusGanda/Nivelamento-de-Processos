import {
  ehIdentificadorValido, ErroDeExecucao, exigirStatus, MENSAGEM_ESTADO_MUDOU, validarBaixa, validarDestino, validarMatricula,
  type Baixa, type Destino, type OperadorDaIlha, type OrdemDisponivel,
} from '../domain/execucao.ts';
import type { ExecucaoEncontrada, ExecucaoRepository, OperadorEncontrado } from './contracts.ts';

const estadoMudou = () => new ErroDeExecucao('CONFLITO', MENSAGEM_ESTADO_MUDOU);

// Casos de uso da ilha. A matrícula identifica o operador; não autentica nem concede privilégios.
export class ExecucoesService {
  private readonly execucoes: ExecucaoRepository;
  private readonly agora: () => Date;

  constructor(execucoes: ExecucaoRepository, agora: () => Date = () => new Date()) {
    this.execucoes = execucoes;
    this.agora = agora;
  }

  async identificar(matriculaInformada: unknown): Promise<OperadorDaIlha> {
    const operador = await this.exigirOperador(matriculaInformada);
    return {
      id: operador.id, matricula: operador.matricula, nome: operador.nome, setor: operador.setor,
      execucaoAberta: await this.execucoes.buscarExecucaoAberta(operador.id),
    };
  }

  async listarOrdensDisponiveis(): Promise<OrdemDisponivel[]> {
    return this.execucoes.listarOrdensDisponiveis();
  }

  async listarMotivos(): Promise<{ id: string; nome: string }[]> {
    return this.execucoes.listarMotivosAtivos();
  }

  async iniciar(matricula: unknown, destinoInformado: Partial<Record<keyof Destino, unknown>>): Promise<OperadorDaIlha> {
    const operador = await this.exigirOperador(matricula);
    const destino = validarDestino(destinoInformado);
    if (await this.execucoes.buscarExecucaoAberta(operador.id)) {
      throw new ErroDeExecucao('CONFLITO', 'O operador já tem uma execução aberta. Finalize ou troque a operação antes de iniciar outra.');
    }
    await this.conferirDestino(destino);
    await this.execucoes.iniciar(operador.id, destino, this.instante());
    return this.identificar(operador.matricula);
  }

  async pausar(matricula: unknown, execucaoId: string, motivoId: unknown): Promise<OperadorDaIlha> {
    const { operador, execucao } = await this.exigirExecucaoDoOperador(matricula, execucaoId);
    exigirStatus(execucao.status, 'EM_EXECUCAO', 'pausar');
    if (!ehIdentificadorValido(motivoId)) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Selecione o motivo da pausa.');
    const motivo = await this.execucoes.buscarMotivo(motivoId);
    if (!motivo || !motivo.ativo) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Motivo de pausa não encontrado ou inativo.');
    if (!await this.execucoes.pausar(execucao.id, motivoId, this.instante())) throw estadoMudou();
    return this.identificar(operador.matricula);
  }

  async retomar(matricula: unknown, execucaoId: string): Promise<OperadorDaIlha> {
    const { operador, execucao } = await this.exigirExecucaoDoOperador(matricula, execucaoId);
    exigirStatus(execucao.status, 'PAUSADA', 'retomar');
    if (!await this.execucoes.retomar(execucao.id, this.instante())) throw estadoMudou();
    return this.identificar(operador.matricula);
  }

  // Troca de operação: finaliza a execução atual sem quantidades e abre a próxima, juntas.
  async trocar(matricula: unknown, execucaoId: string, destinoInformado: Partial<Record<keyof Destino, unknown>>): Promise<OperadorDaIlha> {
    const { operador, execucao } = await this.exigirExecucaoDoOperador(matricula, execucaoId);
    exigirStatus(execucao.status, 'EM_EXECUCAO', 'trocar de operação');
    const destino = validarDestino(destinoInformado);
    await this.conferirDestino(destino);
    if (!await this.execucoes.trocar(execucao.id, operador.id, destino, this.instante())) throw estadoMudou();
    return this.identificar(operador.matricula);
  }

  async baixar(matricula: unknown, execucaoId: string, baixaInformada: Partial<Record<keyof Baixa, unknown>>): Promise<OperadorDaIlha> {
    const { operador, execucao } = await this.exigirExecucaoDoOperador(matricula, execucaoId);
    exigirStatus(execucao.status, 'EM_EXECUCAO', 'dar baixa');
    const baixa = validarBaixa(baixaInformada, execucao.quantidadeOrdem);
    if (!await this.execucoes.baixar(execucao.id, baixa, this.instante())) throw estadoMudou();
    return this.identificar(operador.matricula);
  }

  private instante(): string {
    return this.agora().toISOString();
  }

  private async exigirOperador(matriculaInformada: unknown): Promise<OperadorEncontrado> {
    const operador = await this.execucoes.buscarOperador(validarMatricula(matriculaInformada));
    if (!operador) throw new ErroDeExecucao('NAO_ENCONTRADO', 'Operador não encontrado. Confira a matrícula.');
    if (!operador.ativo) throw new ErroDeExecucao('CONFLITO', 'Operador inativo não pode registrar apontamentos.');
    return operador;
  }

  private async exigirExecucaoDoOperador(matricula: unknown, execucaoId: string): Promise<{ operador: OperadorEncontrado; execucao: ExecucaoEncontrada }> {
    const operador = await this.exigirOperador(matricula);
    const execucao = ehIdentificadorValido(execucaoId) ? await this.execucoes.buscarExecucao(execucaoId) : null;
    // Execução de outro operador é tratada como inexistente: a matrícula só age sobre as próprias.
    if (!execucao || execucao.operadorId !== operador.id) throw new ErroDeExecucao('NAO_ENCONTRADO', 'Execução não encontrada para este operador.');
    return { operador, execucao };
  }

  private async conferirDestino(destino: Destino): Promise<void> {
    const situacao = await this.execucoes.conferirDestino(destino);
    if (!situacao.ordemExiste) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Ordem de produção não encontrada.');
    if (!situacao.etapaDaOrdem) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'A etapa não pertence ao roteiro desta ordem.');
    if (situacao.etapaBaixada) throw new ErroDeExecucao('CONFLITO', 'Esta etapa da ordem já teve baixa.');
    if (!situacao.posto) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Posto não encontrado.');
    if (!situacao.posto.ativo) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Posto inativo não pode receber execuções.');
    if (!situacao.posto.compativel) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'O posto não está entre os postos desta etapa.');
  }
}
