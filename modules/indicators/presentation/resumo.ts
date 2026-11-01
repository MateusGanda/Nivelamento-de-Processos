import type { PosicaoDaOrdem } from '../application/indicadores.ts';
import type { RespostaIndicadores } from './api-client.ts';

// Valores derivados da resposta, usados igualmente pela tela e pela planilha exportada.

export type Qualidade = { unidade: string; boa: number; retrabalho: number; refugo: number };

export function resumirIndicadores(dados: RespostaIndicadores) {
  // Unidades diferentes não se somam.
  const producaoPorUnidade = new Map<string, number>();
  for (const item of dados.producaoFinal) producaoPorUnidade.set(item.unidade, (producaoPorUnidade.get(item.unidade) ?? 0) + item.quantidadeBoa);
  const pausasPorMotivo = new Map<string, number>();
  for (const posto of dados.tempos) for (const motivo of posto.pausasPorMotivo) {
    const nome = motivo.motivoNome ?? 'Sem motivo';
    pausasPorMotivo.set(nome, (pausasPorMotivo.get(nome) ?? 0) + motivo.segundos);
  }
  const emAndamento = dados.ordens.filter((ordem) => ordem.etapaAtual !== null);
  return {
    producaoPorUnidade: [...producaoPorUnidade].map(([unidade, quantidade]) => ({ unidade, quantidade })),
    emAndamento: emAndamento.length,
    emExecucao: emAndamento.filter((ordem) => ordem.emExecucao).length,
    produtivoSegundos: dados.tempos.reduce((soma, t) => soma + t.produtivoSegundos, 0),
    pausaSegundos: dados.tempos.reduce((soma, t) => soma + t.pausaSegundos, 0),
    maiorMotivoDePausa: [...pausasPorMotivo].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}

/** Composição da última etapa de cada roteiro, por unidade. */
export function qualidadePorUnidade(dados: RespostaIndicadores): Qualidade[] {
  const porUnidade = new Map<string, Qualidade>();
  for (const item of dados.producao) {
    if (!item.ultimaEtapa) continue;
    const atual = porUnidade.get(item.unidade) ?? { unidade: item.unidade, boa: 0, retrabalho: 0, refugo: 0 };
    atual.boa += item.quantidadeBoa;
    atual.retrabalho += item.quantidadeRetrabalho;
    atual.refugo += item.quantidadeRefugo;
    porUnidade.set(item.unidade, atual);
  }
  return [...porUnidade.values()].filter((q) => q.boa + q.retrabalho + q.refugo > 0);
}

/** Peças boas sobre o total baixado, de 0 a 100; null sem baixa. */
export function percentualDePecasBoas(q: Qualidade): number | null {
  const total = q.boa + q.retrabalho + q.refugo;
  return total > 0 ? (q.boa / total) * 100 : null;
}

export function situacaoDaOrdem(ordem: PosicaoDaOrdem): string {
  if (ordem.etapaAtual === null) return 'Concluída';
  return `${ordem.emExecucao ? 'Em execução' : 'Aguardando'}: ${ordem.etapaAtual.ordem}. ${ordem.etapaAtual.operacaoNome}`;
}

/** Leitura do tempo por unidade comparado ao tempo padrão. */
export function leituraDoPadrao(item: { diferencaSegundos: number | null; tempoPadraoSegundos: number | null }): string {
  if (item.diferencaSegundos === null) return item.tempoPadraoSegundos === null ? 'Sem tempo padrão' : 'Sem peças boas';
  if (item.diferencaSegundos > 0) return 'Acima do padrão';
  return item.diferencaSegundos < 0 ? 'Abaixo do padrão' : 'Igual ao padrão';
}
