import type { ExecucaoAcompanhada } from '../domain/execucao.ts';
import { tempoDecorrido } from './tempo-decorrido.ts';

// Acompanhamento das execuções abertas no painel: cliente de GET /api/execucoes e funções puras da tela.

/** Intervalo da atualização automática da lista. */
export const INTERVALO_ATUALIZACAO_MS = 30_000;

/** Campos que bastam para tempos, pausa e atenção; a tela da TV usa estas funções sem dados do operador. */
export type ExecucaoComTempos = Pick<ExecucaoAcompanhada, 'status' | 'eventos' | 'tempoPadraoSegundos'> & { ordem: { quantidade: number } };

export type RespostaAcompanhamento = { meta: { consultadoEm: string }; execucoes: ExecucaoAcompanhada[] };
export type FiltroSituacao = 'todas' | 'EM_EXECUCAO' | 'PAUSADA' | 'ATENCAO';

/**
 * Sinais de atenção mostrados no acompanhamento (decisão de 05/11/2026). Só destacam; não mudam a execução.
 * - ACIMA_DO_PREVISTO: tempo produtivo maior que o previsto para a ordem (tempo padrão × quantidade).
 * - INICIADA_EM_OUTRO_DIA: começou antes do dia de hoje no horário de Brasília, sinal de execução esquecida.
 */
export type Atencao = { tipo: 'ACIMA_DO_PREVISTO'; previstoSegundos: number } | { tipo: 'INICIADA_EM_OUTRO_DIA'; inicio: string };

export class ErroApiAcompanhamento extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiAcompanhamento';
    this.status = status;
  }
}

type Registro = Record<string, unknown>;
const objeto = (valor: unknown): valor is Registro => !!valor && typeof valor === 'object' && !Array.isArray(valor);
const texto = (valor: unknown): valor is string => typeof valor === 'string';
const instante = (valor: unknown) => texto(valor) && Number.isFinite(Date.parse(valor));
const TIPOS_EVENTO = ['INICIO', 'PAUSA', 'RETOMADA', 'FINALIZACAO'];

function ehExecucaoAcompanhada(valor: unknown): valor is ExecucaoAcompanhada {
  if (!objeto(valor)) return false;
  const { ordem, produto, etapa, posto, operador, eventos } = valor;
  const tempoPadrao = valor.tempoPadraoSegundos;
  return texto(valor.id) && (valor.status === 'EM_EXECUCAO' || valor.status === 'PAUSADA') && texto(valor.setor) &&
    (tempoPadrao === null || (typeof tempoPadrao === 'number' && Number.isFinite(tempoPadrao) && tempoPadrao >= 0)) &&
    objeto(ordem) && texto(ordem.id) && texto(ordem.numero) && typeof ordem.quantidade === 'number' && Number.isFinite(ordem.quantidade) && texto(ordem.unidade) &&
    objeto(produto) && texto(produto.codigo) && texto(produto.nome) &&
    objeto(etapa) && texto(etapa.id) && Number.isInteger(etapa.ordem) && texto(etapa.operacao) &&
    objeto(posto) && texto(posto.id) && texto(posto.codigo) && texto(posto.nome) &&
    objeto(operador) && texto(operador.matricula) && texto(operador.nome) &&
    Array.isArray(eventos) && eventos.length > 0 && eventos.every((evento: unknown) => objeto(evento) && texto(evento.tipo) &&
      TIPOS_EVENTO.includes(evento.tipo) && instante(evento.dataHora) && (evento.motivo === null || texto(evento.motivo)));
}

/** Confere o formato da resposta antes de entregá-la à tela; resposta malformada vira erro recuperável. */
export function lerRespostaAcompanhamento(corpo: unknown): RespostaAcompanhamento {
  if (!objeto(corpo) || !objeto(corpo.meta) || !instante(corpo.meta.consultadoEm) || !Array.isArray(corpo.execucoes) || !corpo.execucoes.every(ehExecucaoAcompanhada)) {
    throw new ErroApiAcompanhamento(500, 'Resposta inválida. Tente atualizar a lista.');
  }
  return corpo as RespostaAcompanhamento;
}

export async function consultarExecucoesAbertas(signal?: AbortSignal): Promise<RespostaAcompanhamento> {
  const resposta = await fetch('/api/execucoes', { cache: 'no-store', signal, headers: { Accept: 'application/json' } });
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = objeto(corpo) && objeto(corpo.erro) ? corpo.erro : null;
    throw new ErroApiAcompanhamento(resposta.status, erro && texto(erro.mensagem) ? erro.mensagem : 'Não foi possível carregar as execuções. Tente novamente.');
  }
  return lerRespostaAcompanhamento(corpo);
}

/** Setores presentes na lista, em ordem alfabética, para o filtro. */
export function setoresDasExecucoes(execucoes: readonly ExecucaoAcompanhada[]): string[] {
  return [...new Set(execucoes.map((execucao) => execucao.setor))].sort(new Intl.Collator('pt-BR', { sensitivity: 'base' }).compare);
}

/** Filtra por setor e situação; "ATENCAO" usa os sinais calculados no instante `agoraServidorMs`. */
export function filtrarExecucoes(
  execucoes: readonly ExecucaoAcompanhada[], filtro: { setor: string | null; situacao: FiltroSituacao }, agoraServidorMs: number,
): ExecucaoAcompanhada[] {
  return execucoes.filter((execucao) => (filtro.setor === null || execucao.setor === filtro.setor) && (
    filtro.situacao === 'todas' ||
    (filtro.situacao === 'ATENCAO' ? atencoesDaExecucao(execucao, agoraServidorMs).length > 0 : execucao.status === filtro.situacao)));
}

const DIA_COMPLETO = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

export function atencoesDaExecucao(execucao: ExecucaoComTempos, agoraServidorMs: number): Atencao[] {
  const atencoes: Atencao[] = [];
  if (execucao.tempoPadraoSegundos !== null && execucao.tempoPadraoSegundos > 0) {
    const previstoSegundos = Math.round(execucao.tempoPadraoSegundos * execucao.ordem.quantidade);
    if (temposAteAgora(execucao, agoraServidorMs).produtivoSegundos > previstoSegundos) atencoes.push({ tipo: 'ACIMA_DO_PREVISTO', previstoSegundos });
  }
  const inicio = inicioDaExecucao(execucao);
  if (inicio && DIA_COMPLETO.format(new Date(inicio)) !== DIA_COMPLETO.format(new Date(agoraServidorMs))) {
    atencoes.push({ tipo: 'INICIADA_EM_OUTRO_DIA', inicio });
  }
  return atencoes;
}

export function inicioDaExecucao(execucao: ExecucaoComTempos): string | null {
  return execucao.eventos.find((evento) => evento.tipo === 'INICIO')?.dataHora ?? null;
}

/** Motivo e horário da pausa em andamento; null se a execução não está pausada. */
export function pausaAtual(execucao: ExecucaoComTempos): { motivo: string | null; desde: string } | null {
  if (execucao.status !== 'PAUSADA') return null;
  const pausa = execucao.eventos.findLast((evento) => evento.tipo === 'PAUSA');
  return pausa ? { motivo: pausa.motivo, desde: pausa.dataHora } : null;
}

/**
 * Instante "agora" no relógio do servidor: o horário da consulta mais o tempo passado desde a resposta.
 * Assim um relógio errado no computador do administrador não distorce os tempos.
 */
export function agoraDoServidor(consultadoEm: string, recebidoEmMs: number, agoraLocalMs: number): number {
  return Date.parse(consultadoEm) + Math.max(0, agoraLocalMs - recebidoEmMs);
}

/** Tempo produtivo e em pausa até agora, com a mesma regra da ilha e dos indicadores. */
export function temposAteAgora(execucao: ExecucaoComTempos, agoraServidorMs: number) {
  return tempoDecorrido(execucao.eventos, execucao.status, agoraServidorMs);
}

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const DIA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const HORA_COMPLETA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** "14:05" se for no mesmo dia da consulta; "03/11 14:05" se for de outro dia (horário de Brasília). */
export function formatarHorario(iso: string, referenciaIso: string): string {
  const quando = new Date(iso);
  return DIA.format(quando) === DIA.format(new Date(referenciaIso)) ? HORA.format(quando) : `${DIA.format(quando)} ${HORA.format(quando)}`;
}

export function formatarHoraCompleta(iso: string): string {
  return HORA_COMPLETA.format(new Date(iso));
}
