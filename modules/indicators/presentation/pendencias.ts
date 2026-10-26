import type { RespostaIndicadores } from './api-client.ts';

// Explica em texto as pendências da consulta, usando os nomes que vieram nos próprios blocos.
export function descreverPendencias(resposta: RespostaIndicadores): string[] {
  const etapas = new Map<string, string>();
  for (const item of [...resposta.cargaPendente, ...resposta.producao]) etapas.set(item.etapaRoteiroId, `${item.ordem}. ${item.operacaoNome}`);
  for (const item of resposta.tempoMedio) if (!etapas.has(item.etapaRoteiroId)) etapas.set(item.etapaRoteiroId, item.operacaoNome);
  for (const ordem of resposta.ordens) if (ordem.etapaAtual) etapas.set(ordem.etapaAtual.etapaRoteiroId, `${ordem.etapaAtual.ordem}. ${ordem.etapaAtual.operacaoNome}`);
  const postos = new Map<string, string>();
  for (const item of [...resposta.cargaPorPosto, ...resposta.tempos]) postos.set(item.posto.id, item.posto.codigo);
  const ordens = new Map(resposta.ordens.map((ordem) => [ordem.ordemId, ordem.numero]));
  const etapa = (id: string) => etapas.get(id) ?? 'etapa sem nome';

  const mensagens = new Set<string>();
  const abertasPorPosto = new Map<string, number>();
  let eventosInconsistentes = 0;
  for (const pendencia of resposta.meta.pendencias) {
    switch (pendencia.codigo) {
      case 'SEM_TEMPO_PADRAO':
        mensagens.add(`Produto ${pendencia.produtoCodigo}, etapa ${etapa(pendencia.etapaRoteiroId)}: sem tempo padrão. A carga dessa etapa fica indisponível.`);
        break;
      case 'ETAPA_SEM_POSTO':
        mensagens.add(`Etapa ${etapa(pendencia.etapaRoteiroId)} sem posto ativo: a carga dela não entra em nenhum posto.`);
        break;
      case 'BAIXA_INCONSISTENTE':
        mensagens.add(`Ordem ${ordens.get(pendencia.ordemId) ?? 'sem número'}, etapa ${etapa(pendencia.etapaRoteiroId)}: a baixa não fecha com a quantidade da ordem e não foi contada.`);
        break;
      case 'EXECUCAO_ABERTA': {
        const codigo = postos.get(pendencia.postoId) ?? 'sem código';
        abertasPorPosto.set(codigo, (abertasPorPosto.get(codigo) ?? 0) + 1);
        break;
      }
      case 'EVENTOS_INCONSISTENTES':
        eventosInconsistentes++;
        break;
    }
  }
  for (const [codigo, quantidade] of abertasPorPosto) {
    mensagens.add(`Posto ${codigo}: ${quantidade === 1 ? '1 execução em aberto' : `${quantidade} execuções em aberto`}. O tempo só entra nos totais depois da finalização.`);
  }
  if (eventosInconsistentes > 0) {
    mensagens.add(eventosInconsistentes === 1
      ? '1 execução tem eventos fora da sequência esperada e ficou fora dos tempos.'
      : `${eventosInconsistentes} execuções têm eventos fora da sequência esperada e ficaram fora dos tempos.`);
  }
  return [...mensagens];
}
