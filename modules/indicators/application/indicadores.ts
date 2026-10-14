import { centesimos, validarJanela } from '../../../shared/validation.ts';
import type { Janela } from '../../../shared/validation.ts';
import { calcularCargaPendente } from '../domain/carga.ts';
import { calcularPosicao, identificarBaixa } from '../domain/producao.ts';
import type { EtapaRegistrada, ExecucaoRegistrada, IndicadoresRepository } from './contracts.ts';

export type Pendencia =
  | { codigo: 'BAIXA_INCONSISTENTE'; ordemId: string; etapaRoteiroId: string }
  | { codigo: 'SEM_TEMPO_PADRAO'; produtoId: string; etapaRoteiroId: string }
  | { codigo: 'ETAPA_SEM_POSTO'; etapaRoteiroId: string };

export type PosicaoDaOrdem = {
  ordemId: string;
  numero: string;
  produtoCodigo: string;
  produtoNome: string;
  quantidade: number;
  unidade: string;
  planoCodigo: string;
  etapasTotal: number;
  etapasBaixadas: number;
  etapasInconsistentes: number;
  etapaAtual: { etapaRoteiroId: string; ordem: number; operacaoNome: string } | null;
  emExecucao: boolean;
  ultimaBaixaEm: string | null;
};

export type CargaDaEtapa = {
  produtoCodigo: string;
  etapaRoteiroId: string;
  ordem: number;
  operacaoNome: string;
  unidade: string;
  ordensPendentes: number;
  quantidadePendente: number;
  tempoPadraoSegundos: number | null;
  cargaPendenteSegundos: number | null;
  postosCompativeis: { id: string; codigo: string; nome: string }[];
};

export type SituacaoAtual = { ordens: PosicaoDaOrdem[]; cargaPendente: CargaDaEtapa[]; pendencias: Pendencia[] };

function agrupar<T>(itens: readonly T[], chave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const grupo = grupos.get(chave(item));
    if (grupo) grupo.push(item);
    else grupos.set(chave(item), [item]);
  }
  return grupos;
}

/** A baixa pertence ao instante do evento FINALIZACAO da execução que a registrou. */
function instanteDaBaixa(execucoes: readonly ExecucaoRegistrada[]): number | null {
  const baixa = execucoes.find((e) => e.tipoFinalizacao === 'BAIXA');
  return baixa?.eventos.find((e) => e.tipo === 'FINALIZACAO')?.instanteMs ?? null;
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export class IndicadoresService {
  private readonly registros: IndicadoresRepository;

  constructor(registros: IndicadoresRepository) {
    this.registros = registros;
  }

  /** Blocos `ordens` e `cargaPendente` do contrato de indicadores: mostram a
   * situação no momento da consulta. O período só decide quais ordens já
   * concluídas ainda aparecem (as que tiveram baixa dentro dele).
   */
  async consultarSituacaoAtual(periodo: Janela): Promise<SituacaoAtual> {
    validarJanela(periodo);
    const dados = await this.registros.carregarRegistrosDeProducao();
    const etapasPorRoteiro = agrupar(dados.etapas, (e) => e.roteiroId);
    const execucoesPorOrdemEtapa = agrupar(dados.execucoes, (e) => `${e.ordemProducaoId}|${e.etapaRoteiroId}`);
    const pendencias: Pendencia[] = [];
    const ordens: PosicaoDaOrdem[] = [];
    const pendentes = new Map<string, { produtoId: string; produtoCodigo: string; unidade: string; etapa: EtapaRegistrada; ordens: number; centesimos: number }>();

    for (const ordem of dados.ordens) {
      const etapas = etapasPorRoteiro.get(ordem.roteiroId) ?? [];
      const baixasMs: number[] = [];
      const situacoes = etapas.map((etapa) => {
        const execucoes = execucoesPorOrdemEtapa.get(`${ordem.id}|${etapa.id}`) ?? [];
        const { situacao } = identificarBaixa(ordem.quantidade, execucoes);
        if (situacao === 'BAIXADA') {
          const instante = instanteDaBaixa(execucoes);
          if (instante !== null) baixasMs.push(instante);
          return { ordem: etapa.ordem, situacao };
        }
        if (situacao === 'INCONSISTENTE') pendencias.push({ codigo: 'BAIXA_INCONSISTENTE', ordemId: ordem.id, etapaRoteiroId: etapa.id });
        // Unidades diferentes não são somadas: a unidade faz parte do agrupamento.
        const chave = `${ordem.produtoId}|${etapa.id}|${ordem.unidade}`;
        const pendente = pendentes.get(chave) ?? { produtoId: ordem.produtoId, produtoCodigo: ordem.produtoCodigo, unidade: ordem.unidade, etapa, ordens: 0, centesimos: 0 };
        pendente.ordens += 1;
        pendente.centesimos += centesimos(ordem.quantidade, 'Quantidade da ordem');
        pendentes.set(chave, pendente);
        return { ordem: etapa.ordem, situacao };
      });

      const posicao = calcularPosicao(situacoes);
      const baixouNoPeriodo = baixasMs.some((ms) => ms >= periodo.inicioMs && ms < periodo.fimMs);
      if (posicao.etapasBaixadas === posicao.etapasTotal && !baixouNoPeriodo) continue;

      const atual = etapas.find((e) => e.ordem === posicao.etapaAtual) ?? null;
      ordens.push({
        ordemId: ordem.id,
        numero: ordem.numero,
        produtoCodigo: ordem.produtoCodigo,
        produtoNome: ordem.produtoNome,
        quantidade: ordem.quantidade,
        unidade: ordem.unidade,
        planoCodigo: ordem.planoCodigo,
        etapasTotal: posicao.etapasTotal,
        etapasBaixadas: posicao.etapasBaixadas,
        etapasInconsistentes: posicao.etapasInconsistentes,
        etapaAtual: atual && { etapaRoteiroId: atual.id, ordem: atual.ordem, operacaoNome: atual.operacaoNome },
        emExecucao: atual !== null && (execucoesPorOrdemEtapa.get(`${ordem.id}|${atual.id}`) ?? []).some((e) => e.tipoFinalizacao === null),
        ultimaBaixaEm: baixasMs.length > 0 ? new Date(Math.max(...baixasMs)).toISOString() : null,
      });
    }

    const temposPadrao = new Map(dados.temposPadrao.map((t) => [`${t.produtoId}|${t.etapaRoteiroId}`, t.tempoPadraoSegundos]));
    const postosPorEtapa = agrupar(dados.postosDasEtapas, (p) => p.etapaRoteiroId);
    const semTempoPadrao = new Set<string>();
    const semPosto = new Set<string>();
    const cargaPendente: CargaDaEtapa[] = [];

    for (const { produtoId, produtoCodigo, unidade, etapa, ordens: ordensPendentes, centesimos: total } of pendentes.values()) {
      const chave = `${produtoId}|${etapa.id}`;
      const tempoPadraoSegundos = temposPadrao.get(chave) ?? null;
      if (tempoPadraoSegundos === null && !semTempoPadrao.has(chave)) {
        semTempoPadrao.add(chave);
        pendencias.push({ codigo: 'SEM_TEMPO_PADRAO', produtoId, etapaRoteiroId: etapa.id });
      }
      const postosCompativeis = (postosPorEtapa.get(etapa.id) ?? [])
        .map((p) => ({ id: p.postoId, codigo: p.codigo, nome: p.nome }))
        .sort((a, b) => comparar(a.codigo, b.codigo));
      if (postosCompativeis.length === 0 && !semPosto.has(etapa.id)) {
        semPosto.add(etapa.id);
        pendencias.push({ codigo: 'ETAPA_SEM_POSTO', etapaRoteiroId: etapa.id });
      }
      const quantidadePendente = total / 100;
      cargaPendente.push({
        produtoCodigo,
        etapaRoteiroId: etapa.id,
        ordem: etapa.ordem,
        operacaoNome: etapa.operacaoNome,
        unidade,
        ordensPendentes,
        quantidadePendente,
        tempoPadraoSegundos,
        cargaPendenteSegundos: calcularCargaPendente([{ quantidade: quantidadePendente, tempoPadraoSegundos }]).cargaSegundos,
        postosCompativeis,
      });
    }

    ordens.sort((a, b) => comparar(a.numero, b.numero));
    cargaPendente.sort((a, b) => comparar(a.produtoCodigo, b.produtoCodigo) || a.ordem - b.ordem || comparar(a.unidade, b.unidade));
    return { ordens, cargaPendente, pendencias };
  }
}
