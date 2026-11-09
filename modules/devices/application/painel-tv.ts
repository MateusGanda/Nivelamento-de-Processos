import type { Janela } from '../../../shared/validation.ts';
import type { EventoDaExecucao, ExecucaoAcompanhada } from '../../executions/domain/execucao.ts';
import type { CargaDoPosto, ProducaoFinal } from '../../indicators/application/indicadores.ts';
import type { Dispositivo } from '../domain/dispositivo.ts';
import type { PostoDoPainel } from './contracts.ts';

// Dados da tela da TV. Não há nome nem matrícula de operador: é uma tela pública no chão de fábrica,
// e o tempo é da execução, não do desempenho de uma pessoa.

export type ExecucaoNoPainel = {
  id: string;
  status: 'EM_EXECUCAO' | 'PAUSADA';
  ordem: { numero: string; quantidade: number; unidade: string };
  produto: { codigo: string; nome: string };
  etapa: { ordem: number; operacao: string };
  tempoPadraoSegundos: number | null;
  eventos: EventoDaExecucao[];
};

export type SituacaoDoPosto = 'LIVRE' | 'EM_EXECUCAO' | 'PAUSADA';

export type PostoNoPainel = { codigo: string; nome: string; setor: string; situacao: SituacaoDoPosto; execucoes: ExecucaoNoPainel[] };

export type PainelTv = {
  meta: { consultadoEm: string; intervaloSegundos: number };
  dispositivo: { nome: string; local: string | null; setor: string | null };
  postos: PostoNoPainel[];
  producaoHoje: { pecasBoas: ProducaoFinal[]; baixas: number };
  cargaPorPosto: { codigo: string; nome: string; segundos: number; percentual: number | null }[];
};

export type FontesDoPainel = {
  postosAtivos(): Promise<PostoDoPainel[]>;
  execucoesAbertas(): Promise<ExecucaoAcompanhada[]>;
  indicadores(periodo: Janela): Promise<{ producaoFinal: ProducaoFinal[]; porDia: { baixas: number }[]; cargaPorPosto: CargaDoPosto[] }>;
};

const DIA_MS = 86_400_000;
const FUSO_MS = 3 * 3_600_000; // Brasília, UTC−3, sem horário de verão (mesma regra dos indicadores).

/** Do início do dia de hoje, no horário de Brasília, até agora. */
export function janelaDeHoje(agoraMs: number): Janela {
  const inicioMs = Math.floor((agoraMs - FUSO_MS) / DIA_MS) * DIA_MS + FUSO_MS;
  return { inicioMs, fimMs: agoraMs + 1 };
}

function paraPainel(execucao: ExecucaoAcompanhada): ExecucaoNoPainel {
  return {
    id: execucao.id, status: execucao.status,
    ordem: { numero: execucao.ordem.numero, quantidade: execucao.ordem.quantidade, unidade: execucao.ordem.unidade },
    produto: { codigo: execucao.produto.codigo, nome: execucao.produto.nome },
    etapa: { ordem: execucao.etapa.ordem, operacao: execucao.etapa.operacao },
    tempoPadraoSegundos: execucao.tempoPadraoSegundos,
    eventos: execucao.eventos,
  };
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Monta a tela de uma TV: só os postos do setor dela (ou todos, quando a TV não tem setor). */
export async function montarPainelTv(dispositivo: Dispositivo, fontes: FontesDoPainel, agoraMs: number, intervaloSegundos: number): Promise<PainelTv> {
  const [postos, abertas, indicadores] = await Promise.all([fontes.postosAtivos(), fontes.execucoesAbertas(), fontes.indicadores(janelaDeHoje(agoraMs))]);
  const doSetor = postos.filter((p) => !dispositivo.setor || p.setor.id === dispositivo.setor.id)
    .sort((a, b) => collator.compare(a.setor.nome, b.setor.nome) || collator.compare(a.codigo, b.codigo));
  const idsDoSetor = new Set(doSetor.map((p) => p.id));

  const porPosto = new Map<string, ExecucaoNoPainel[]>();
  for (const execucao of abertas) {
    if (!idsDoSetor.has(execucao.posto.id)) continue;
    porPosto.set(execucao.posto.id, [...(porPosto.get(execucao.posto.id) ?? []), paraPainel(execucao)]);
  }

  return {
    meta: { consultadoEm: new Date(agoraMs).toISOString(), intervaloSegundos },
    dispositivo: { nome: dispositivo.nome, local: dispositivo.local, setor: dispositivo.setor?.nome ?? null },
    postos: doSetor.map((posto) => {
      const execucoes = porPosto.get(posto.id) ?? [];
      const situacao: SituacaoDoPosto = execucoes.some((e) => e.status === 'EM_EXECUCAO') ? 'EM_EXECUCAO' : execucoes.length ? 'PAUSADA' : 'LIVRE';
      return { codigo: posto.codigo, nome: posto.nome, setor: posto.setor.nome, situacao, execucoes };
    }),
    producaoHoje: { pecasBoas: indicadores.producaoFinal, baixas: indicadores.porDia.reduce((total, dia) => total + dia.baixas, 0) },
    cargaPorPosto: indicadores.cargaPorPosto
      .filter((c) => idsDoSetor.has(c.posto.id) && (c.cargaPendenteSegundos ?? 0) > 0)
      .map((c) => ({ codigo: c.posto.codigo, nome: c.posto.nome, segundos: c.cargaPendenteSegundos ?? 0, percentual: c.percentualDaCarga }))
      .sort((a, b) => b.segundos - a.segundos || collator.compare(a.codigo, b.codigo)),
  };
}
