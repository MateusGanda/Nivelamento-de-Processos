import { centesimos, validarJanela } from '../../../shared/validation.ts';
import type { Janela } from '../../../shared/validation.ts';
import { calcularCargaPendente, distribuirCargaPorPosto } from '../domain/carga.ts';
import type { CargaDaEtapaNosPostos } from '../domain/carga.ts';
import { calcularPosicao, identificarBaixa, quantidadesDaExecucao, registraProducao, somarResultados } from '../domain/producao.ts';
import type { Resultado } from '../domain/producao.ts';
import { calcularTempoMedioPorUnidade, calcularTempos, compararComTempoPadrao, derivarIntervalos } from '../domain/tempos.ts';
import type { Intervalo } from '../domain/tempos.ts';
import { dataDoInstante, dividirEmDias } from '../domain/dias.ts';
import { avaliarPrazo } from '../domain/prazo.ts';
import type { EtapaRegistrada, ExecucaoRegistrada, IndicadoresRepository, OrdemRegistrada, RegistrosDeProducao } from './contracts.ts';

export type Pendencia =
  | { codigo: 'BAIXA_INCONSISTENTE'; ordemId: string; etapaRoteiroId: string }
  | { codigo: 'SEM_TEMPO_PADRAO'; produtoCodigo: string; etapaRoteiroId: string }
  | { codigo: 'ETAPA_SEM_POSTO'; etapaRoteiroId: string }
  | { codigo: 'EXECUCAO_ABERTA'; execucaoId: string; postoId: string }
  | { codigo: 'EVENTOS_INCONSISTENTES'; execucaoId: string };

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
  /** `quantidadeApontada`: soma dos encerramentos parciais (fim de turno) já feitos na etapa atual. */
  etapaAtual: { etapaRoteiroId: string; ordem: number; operacaoNome: string; quantidadeApontada: number } | null;
  emExecucao: boolean;
  ultimaBaixaEm: string | null;
  /** Data de fim do plano (AAAA-MM-DD); null quando o plano não tem fim. */
  prazo: string | null;
  /** Ordem com etapa sem baixa e prazo vencido (o último dia do plano ainda está no prazo). */
  atrasada: boolean;
  diasDeAtraso: number | null;
};

/** Etapa ainda sem baixa que já teve encerramento parcial: o trabalho ficou pendente para outro turno. */
export type EtapaParcial = {
  ordemId: string;
  numero: string;
  produtoCodigo: string;
  produtoNome: string;
  etapaRoteiroId: string;
  ordem: number;
  operacaoNome: string;
  quantidade: number;
  unidade: string;
  quantidadeBoa: number;
  quantidadeRetrabalho: number;
  quantidadeRefugo: number;
  /** boa + retrabalho + refugo já apontados. */
  quantidadeApontada: number;
  quantidadeQueFalta: number;
  /** quantidadeApontada ÷ quantidade × 100. */
  percentualApontado: number;
  encerramentosParciais: number;
  /** Início da primeira execução da etapa; a tela mostra há quantos dias a etapa está em aberto. */
  inicioEm: string | null;
  ultimoEncerramentoEm: string | null;
  /** Motivo do último encerramento parcial; null quando foi o fim do turno. */
  motivoUltimoEncerramento: string | null;
  emExecucao: boolean;
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

export type CargaDoPosto = {
  posto: { id: string; codigo: string; nome: string };
  cargaPendenteSegundos: number | null;
  percentualDaCarga: number | null;
};

export type SituacaoAtual = { ordens: PosicaoDaOrdem[]; etapasParciais: EtapaParcial[]; cargaPendente: CargaDaEtapa[]; cargaPorPosto: CargaDoPosto[]; pendencias: Pendencia[] };

export type ProducaoDaEtapa = {
  produtoCodigo: string;
  etapaRoteiroId: string;
  ordem: number;
  operacaoNome: string;
  ultimaEtapa: boolean;
  unidade: string;
  ordensBaixadas: number;
  /** Encerramentos parciais (fim de turno) do período; as quantidades deles entram nas somas. */
  encerramentosParciais: number;
  quantidadeBoa: number;
  quantidadeRetrabalho: number;
  quantidadeRefugo: number;
};

export type ProducaoFinal = { produtoCodigo: string; unidade: string; quantidadeBoa: number };

export type TemposDoPosto = {
  posto: { id: string; codigo: string; nome: string; setorNome: string };
  produtivoSegundos: number;
  pausaSegundos: number;
  totalSegundos: number;
  pausasPorMotivo: { motivoNome: string | null; segundos: number; ocorrencias: number }[];
  execucoesFinalizadas: number;
  execucoesAbertas: number;
};

export type TempoMedioDaEtapa = {
  produtoCodigo: string;
  etapaRoteiroId: string;
  operacaoNome: string;
  unidade: string;
  execucoesConsideradas: number;
  produtivoSegundos: number;
  quantidadeBoa: number;
  segundosPorUnidade: number | null;
  tempoPadraoSegundos: number | null;
  diferencaSegundos: number | null;
  percentualDoPadrao: number | null;
};

/** Um dia do período, no horário de Brasília. */
export type DiaDoPeriodo = {
  data: string;
  produtivoSegundos: number;
  pausaSegundos: number;
  baixas: number;
  encerramentosParciais: number;
  /** Tempo padrão do que foi apontado no dia: baixas e encerramentos parciais. */
  tempoPadraoDasBaixasSegundos: number | null;
};

export type BlocosDoPeriodo = {
  producao: ProducaoDaEtapa[];
  producaoFinal: ProducaoFinal[];
  tempos: TemposDoPosto[];
  tempoMedio: TempoMedioDaEtapa[];
  porDia: DiaDoPeriodo[];
  pendencias: Pendencia[];
};

export type Indicadores = Omit<SituacaoAtual & BlocosDoPeriodo, 'pendencias'> & { pendencias: Pendencia[] };

function agrupar<T>(itens: readonly T[], chave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const grupo = grupos.get(chave(item));
    if (grupo) grupo.push(item);
    else grupos.set(chave(item), [item]);
  }
  return grupos;
}

/** Instante do evento FINALIZACAO da execução; a baixa pertence a esse instante. */
function instanteDaFinalizacao(execucao: ExecucaoRegistrada): number | null {
  return execucao.eventos.find((e) => e.tipo === 'FINALIZACAO')?.instanteMs ?? null;
}

/** Instante do evento INICIO da execução. */
function instanteDoInicio(execucao: ExecucaoRegistrada): number | null {
  return execucao.eventos.find((e) => e.tipo === 'INICIO')?.instanteMs ?? null;
}

const noPeriodo = (ms: number, periodo: Janela) => ms >= periodo.inicioMs && ms < periodo.fimMs;
const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Janela que contém qualquer instante: mede a execução inteira, sem recorte. */
const SEM_RECORTE: Janela = { inicioMs: Number.MIN_SAFE_INTEGER, fimMs: Number.MAX_SAFE_INTEGER };

/** Blocos `ordens`, `etapasParciais`, `cargaPendente` e `cargaPorPosto`: situação no momento da consulta.
 * O período só decide quais ordens já concluídas ainda aparecem (as que tiveram
 * baixa dentro dele).
 */
function montarSituacaoAtual(dados: RegistrosDeProducao, periodo: Janela, hoje: string): SituacaoAtual {
  const etapasPorRoteiro = agrupar(dados.etapas, (e) => e.roteiroId);
  const execucoesPorOrdemEtapa = agrupar(dados.execucoes, (e) => `${e.ordemProducaoId}|${e.etapaRoteiroId}`);
  const pendencias: Pendencia[] = [];
  const ordens: PosicaoDaOrdem[] = [];
  const etapasParciais: EtapaParcial[] = [];
  const nomeDoMotivo = new Map(dados.motivosPausa.map((m) => [m.id, m.nome]));
  const pendentes = new Map<string, { produtoId: string; produtoCodigo: string; unidade: string; etapa: EtapaRegistrada; ordens: number; centesimos: number }>();

  for (const ordem of dados.ordens) {
    const etapas = etapasPorRoteiro.get(ordem.roteiroId) ?? [];
    const baixasMs: number[] = [];
    const apontadoPorEtapa = new Map<string, number>();
    const situacoes = etapas.map((etapa) => {
      const execucoes = execucoesPorOrdemEtapa.get(`${ordem.id}|${etapa.id}`) ?? [];
      const { situacao, apontado } = identificarBaixa(ordem.quantidade, execucoes);
      const apontadoCentesimos = apontado ? centesimos(somarResultados([apontado]).total, 'Quantidade apontada') : 0;
      apontadoPorEtapa.set(etapa.id, apontadoCentesimos / 100);
      if (situacao === 'BAIXADA') {
        const baixa = execucoes.find((e) => e.tipoFinalizacao === 'BAIXA');
        const instante = baixa ? instanteDaFinalizacao(baixa) : null;
        if (instante !== null) baixasMs.push(instante);
        return { ordem: etapa.ordem, situacao };
      }
      if (situacao === 'INCONSISTENTE') pendencias.push({ codigo: 'BAIXA_INCONSISTENTE', ordemId: ordem.id, etapaRoteiroId: etapa.id });
      const quantidadeCentesimos = centesimos(ordem.quantidade, 'Quantidade da ordem');
      if (situacao === 'SEM_BAIXA' && apontado) {
        const parciais = execucoes.filter((e) => e.tipoFinalizacao === 'ENCERRAMENTO_PARCIAL');
        const inicios = execucoes.map(instanteDoInicio).filter((ms): ms is number => ms !== null);
        const fins = parciais.map(instanteDaFinalizacao).filter((ms): ms is number => ms !== null);
        // O motivo fica no evento FINALIZACAO do encerramento parcial; sem motivo, foi o fim do turno.
        const ultimo = [...parciais].sort((a, b) => (instanteDaFinalizacao(b) ?? 0) - (instanteDaFinalizacao(a) ?? 0))[0];
        const motivoId = ultimo?.eventos.find((e) => e.tipo === 'FINALIZACAO')?.motivoPausaId ?? null;
        etapasParciais.push({
          ordemId: ordem.id, numero: ordem.numero, produtoCodigo: ordem.produtoCodigo, produtoNome: ordem.produtoNome,
          etapaRoteiroId: etapa.id, ordem: etapa.ordem, operacaoNome: etapa.operacaoNome, quantidade: ordem.quantidade, unidade: ordem.unidade,
          quantidadeBoa: apontado.quantidadeBoa, quantidadeRetrabalho: apontado.quantidadeRetrabalho, quantidadeRefugo: apontado.quantidadeRefugo,
          quantidadeApontada: apontadoCentesimos / 100,
          quantidadeQueFalta: (quantidadeCentesimos - apontadoCentesimos) / 100,
          percentualApontado: (apontadoCentesimos / quantidadeCentesimos) * 100,
          encerramentosParciais: parciais.length,
          inicioEm: inicios.length > 0 ? new Date(Math.min(...inicios)).toISOString() : null,
          ultimoEncerramentoEm: fins.length > 0 ? new Date(Math.max(...fins)).toISOString() : null,
          motivoUltimoEncerramento: motivoId === null ? null : nomeDoMotivo.get(motivoId) ?? null,
          emExecucao: execucoes.some((e) => e.tipoFinalizacao === null),
        });
      }
      // Unidades diferentes não são somadas: a unidade faz parte do agrupamento.
      // O que os encerramentos parciais já apontaram sai do pendente: falta só o restante.
      const chave = `${ordem.produtoId}|${etapa.id}|${ordem.unidade}`;
      const pendente = pendentes.get(chave) ?? { produtoId: ordem.produtoId, produtoCodigo: ordem.produtoCodigo, unidade: ordem.unidade, etapa, ordens: 0, centesimos: 0 };
      pendente.ordens += 1;
      pendente.centesimos += Math.max(0, quantidadeCentesimos - (situacao === 'SEM_BAIXA' ? apontadoCentesimos : 0));
      pendentes.set(chave, pendente);
      return { ordem: etapa.ordem, situacao };
    });

    const posicao = calcularPosicao(situacoes);
    const baixouNoPeriodo = baixasMs.some((ms) => noPeriodo(ms, periodo));
    if (posicao.etapasBaixadas === posicao.etapasTotal && !baixouNoPeriodo) continue;

    const atual = etapas.find((e) => e.ordem === posicao.etapaAtual) ?? null;
    const prazo = avaliarPrazo(ordem.prazo, atual === null, hoje);
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
      etapaAtual: atual && { etapaRoteiroId: atual.id, ordem: atual.ordem, operacaoNome: atual.operacaoNome, quantidadeApontada: apontadoPorEtapa.get(atual.id) ?? 0 },
      emExecucao: atual !== null && (execucoesPorOrdemEtapa.get(`${ordem.id}|${atual.id}`) ?? []).some((e) => e.tipoFinalizacao === null),
      ultimaBaixaEm: baixasMs.length > 0 ? new Date(Math.max(...baixasMs)).toISOString() : null,
      prazo: ordem.prazo,
      atrasada: prazo.atrasada,
      diasDeAtraso: prazo.diasDeAtraso,
    });
  }

  const temposPadrao = new Map(dados.temposPadrao.map((t) => [`${t.produtoId}|${t.etapaRoteiroId}`, t.tempoPadraoSegundos]));
  // Posto inativo não recebe carga nem conta como compatível.
  const postosAtivos = new Map(dados.postos.filter((p) => p.ativo).map((p) => [p.id, { id: p.id, codigo: p.codigo, nome: p.nome }]));
  const postosPorEtapa = agrupar(dados.postosDasEtapas.filter((v) => postosAtivos.has(v.postoId)), (v) => v.etapaRoteiroId);
  const cargasDasEtapas: CargaDaEtapaNosPostos[] = [];
  const semTempoPadrao = new Set<string>();
  const semPosto = new Set<string>();
  const cargaPendente: CargaDaEtapa[] = [];

  for (const { produtoId, produtoCodigo, unidade, etapa, ordens: ordensPendentes, centesimos: total } of pendentes.values()) {
    const chave = `${produtoId}|${etapa.id}`;
    const tempoPadraoSegundos = temposPadrao.get(chave) ?? null;
    if (tempoPadraoSegundos === null && !semTempoPadrao.has(chave)) {
      semTempoPadrao.add(chave);
      pendencias.push({ codigo: 'SEM_TEMPO_PADRAO', produtoCodigo, etapaRoteiroId: etapa.id });
    }
    const postosCompativeis = (postosPorEtapa.get(etapa.id) ?? [])
      .map((v) => postosAtivos.get(v.postoId)!)
      .sort((a, b) => comparar(a.codigo, b.codigo));
    if (postosCompativeis.length === 0 && !semPosto.has(etapa.id)) {
      semPosto.add(etapa.id);
      pendencias.push({ codigo: 'ETAPA_SEM_POSTO', etapaRoteiroId: etapa.id });
    }
    const quantidadePendente = total / 100;
    const cargaPendenteSegundos = calcularCargaPendente([{ quantidade: quantidadePendente, tempoPadraoSegundos }]).cargaSegundos;
    cargasDasEtapas.push({ cargaSegundos: cargaPendenteSegundos, postoIds: postosCompativeis.map((p) => p.id) });
    cargaPendente.push({
      produtoCodigo,
      etapaRoteiroId: etapa.id,
      ordem: etapa.ordem,
      operacaoNome: etapa.operacaoNome,
      unidade,
      ordensPendentes,
      quantidadePendente,
      tempoPadraoSegundos,
      cargaPendenteSegundos,
      postosCompativeis,
    });
  }

  // Uma linha por posto ativo ligado a alguma etapa.
  const ligados = [...new Set(dados.postosDasEtapas.map((v) => v.postoId))].filter((id) => postosAtivos.has(id));
  const cargaPorPosto: CargaDoPosto[] = distribuirCargaPorPosto(cargasDasEtapas, ligados)
    .map((c) => ({ posto: postosAtivos.get(c.postoId)!, cargaPendenteSegundos: c.cargaSegundos, percentualDaCarga: c.percentualDaCarga }))
    .sort((a, b) => comparar(a.posto.codigo, b.posto.codigo));

  ordens.sort((a, b) => comparar(a.numero, b.numero));
  etapasParciais.sort((a, b) => comparar(a.numero, b.numero) || a.ordem - b.ordem);
  cargaPendente.sort((a, b) => comparar(a.produtoCodigo, b.produtoCodigo) || a.ordem - b.ordem || comparar(a.unidade, b.unidade));
  return { ordens, etapasParciais, cargaPendente, cargaPorPosto, pendencias };
}

/** Blocos `producao`, `producaoFinal`, `tempos` e `tempoMedio`: só o que aconteceu no período.
 * Baixa inconsistente fica fora de todos eles (a pendência sai na situação atual).
 */
function montarBlocosDoPeriodo(dados: RegistrosDeProducao, periodo: Janela): BlocosDoPeriodo {
  const pendencias: Pendencia[] = [];
  const etapasPorRoteiro = agrupar(dados.etapas, (e) => e.roteiroId);
  const execucoesPorOrdemEtapa = agrupar(dados.execucoes, (e) => `${e.ordemProducaoId}|${e.etapaRoteiroId}`);
  const temposPadrao = new Map(dados.temposPadrao.map((t) => [`${t.produtoId}|${t.etapaRoteiroId}`, t.tempoPadraoSegundos]));

  // Execução com sequência de eventos fora das transições do modelo fica fora dos
  // tempos e vira pendência, em vez de interromper a consulta inteira.
  const derivados = new Map<string, { intervalos: Intervalo[]; aberta: boolean } | null>();
  const intervalosDe = (execucao: ExecucaoRegistrada) => {
    if (!derivados.has(execucao.id)) {
      try {
        derivados.set(execucao.id, derivarIntervalos(execucao.eventos));
      } catch {
        derivados.set(execucao.id, null);
        pendencias.push({ codigo: 'EVENTOS_INCONSISTENTES', execucaoId: execucao.id });
      }
    }
    return derivados.get(execucao.id)!;
  };

  type Grupo = { ordem: OrdemRegistrada; etapa: EtapaRegistrada; ultimaEtapa: boolean };
  const producao = new Map<string, Grupo & { ordens: number; parciais: number; resultados: Resultado[] }>();
  const final = new Map<string, { produtoCodigo: string; unidade: string; resultados: Resultado[] }>();
  const medio = new Map<string, Grupo & { execucoes: { produtivoSegundos: number; quantidadeBoa: number }[]; resultados: Resultado[] }>();
  // Produção apontada por dia (baixas e encerramentos parciais): quantidade apontada vezes o tempo padrão
  // (null quando falta o tempo padrão).
  const baixasPorDia = new Map<string, { baixas: number; parciais: number; centesimosDeSegundo: number | null }>();

  for (const ordem of dados.ordens) {
    const etapas = etapasPorRoteiro.get(ordem.roteiroId) ?? [];
    const ultimaOrdem = Math.max(...etapas.map((e) => e.ordem));
    for (const etapa of etapas) {
      const execucoes = execucoesPorOrdemEtapa.get(`${ordem.id}|${etapa.id}`) ?? [];
      // Etapa inconsistente fica fora de todos os blocos do período (a pendência sai na situação atual).
      if (identificarBaixa(ordem.quantidade, execucoes).situacao === 'INCONSISTENTE') continue;
      const ultimaEtapa = etapa.ordem === ultimaOrdem;
      const chave = `${ordem.produtoId}|${etapa.id}|${ordem.unidade}`;
      const tempoPadrao = temposPadrao.get(`${ordem.produtoId}|${etapa.id}`);
      // Cada baixa ou encerramento parcial entra no período em que foi registrado, com as próprias quantidades:
      // o mesmo lote não é contado duas vezes, e a produção de um turno aparece no dia em que foi feita.
      for (const execucao of execucoes) {
        if (!registraProducao(execucao)) continue;
        const quantidades = quantidadesDaExecucao(execucao);
        const instante = instanteDaFinalizacao(execucao);
        if (!quantidades || instante === null || !noPeriodo(instante, periodo)) continue;
        const ehBaixa = execucao.tipoFinalizacao === 'BAIXA';

        const linha = producao.get(chave) ?? { ordem, etapa, ultimaEtapa, ordens: 0, parciais: 0, resultados: [] };
        if (ehBaixa) linha.ordens += 1;
        else linha.parciais += 1;
        linha.resultados.push(quantidades);
        producao.set(chave, linha);

        const dia = baixasPorDia.get(dataDoInstante(instante)) ?? { baixas: 0, parciais: 0, centesimosDeSegundo: 0 };
        if (ehBaixa) dia.baixas += 1;
        else dia.parciais += 1;
        dia.centesimosDeSegundo = tempoPadrao === undefined || dia.centesimosDeSegundo === null
          ? null
          : dia.centesimosDeSegundo + centesimos(somarResultados([quantidades]).total, 'Quantidade apontada') * tempoPadrao;
        baixasPorDia.set(dataDoInstante(instante), dia);

        if (ultimaEtapa) {
          const chaveFinal = `${ordem.produtoId}|${ordem.unidade}`;
          const total = final.get(chaveFinal) ?? { produtoCodigo: ordem.produtoCodigo, unidade: ordem.unidade, resultados: [] };
          total.resultados.push(quantidades);
          final.set(chaveFinal, total);
        }

        // Tempo médio: a execução inteira que registrou a produção, sem recorte do período.
        const derivado = intervalosDe(execucao);
        if (!derivado) continue;
        const media = medio.get(chave) ?? { ordem, etapa, ultimaEtapa, execucoes: [], resultados: [] };
        media.execucoes.push({ produtivoSegundos: calcularTempos(derivado.intervalos, SEM_RECORTE).produtivoSegundos, quantidadeBoa: quantidades.quantidadeBoa });
        media.resultados.push(quantidades);
        medio.set(chave, media);
      }
    }
  }

  const postos = new Map(dados.postos.map((p) => [p.id, p]));
  const motivos = new Map(dados.motivosPausa.map((m) => [m.id, m.nome]));
  const tempos: TemposDoPosto[] = [];
  // Intervalos fechados de todas as execuções; a série por dia recorta cada um ao seu dia.
  const todosOsIntervalos: Intervalo[] = [];
  for (const [postoId, execucoes] of agrupar(dados.execucoes, (e) => e.postoId)) {
    const posto = postos.get(postoId);
    if (!posto) throw new Error('Posto da execução não encontrado.');
    const intervalos: Intervalo[] = [];
    let finalizadas = 0;
    let abertas = 0;
    let noIntervalo = false;
    for (const execucao of execucoes) {
      const derivado = intervalosDe(execucao);
      const inicio = instanteDoInicio(execucao);
      if (!derivado || inicio === null) continue;
      const fim = instanteDaFinalizacao(execucao);
      // Execução do período: começou antes do fim dele e não terminou antes do início.
      if (inicio >= periodo.fimMs || (fim !== null && fim <= periodo.inicioMs)) continue;
      noIntervalo = true;
      intervalos.push(...derivado.intervalos);
      todosOsIntervalos.push(...derivado.intervalos);
      if (derivado.aberta) {
        abertas += 1;
        pendencias.push({ codigo: 'EXECUCAO_ABERTA', execucaoId: execucao.id, postoId });
      } else if (fim !== null && noPeriodo(fim, periodo)) {
        finalizadas += 1;
      }
    }
    if (!noIntervalo) continue;
    const t = calcularTempos(intervalos, periodo);
    tempos.push({
      posto: { id: posto.id, codigo: posto.codigo, nome: posto.nome, setorNome: posto.setorNome },
      produtivoSegundos: t.produtivoSegundos,
      pausaSegundos: t.pausaSegundos,
      totalSegundos: t.totalSegundos,
      pausasPorMotivo: t.pausasPorMotivo.map((m) => ({ motivoNome: m.motivoPausaId === null ? null : motivos.get(m.motivoPausaId) ?? null, segundos: m.segundos, ocorrencias: m.ocorrencias })),
      execucoesFinalizadas: finalizadas,
      execucoesAbertas: abertas,
    });
  }

  const porDia: DiaDoPeriodo[] = dividirEmDias(periodo).map((dia) => {
    const t = calcularTempos(todosOsIntervalos, dia);
    const baixas = baixasPorDia.get(dia.data) ?? { baixas: 0, parciais: 0, centesimosDeSegundo: 0 };
    return {
      data: dia.data,
      produtivoSegundos: t.produtivoSegundos,
      pausaSegundos: t.pausaSegundos,
      baixas: baixas.baixas,
      encerramentosParciais: baixas.parciais,
      tempoPadraoDasBaixasSegundos: baixas.centesimosDeSegundo === null ? null : baixas.centesimosDeSegundo / 100,
    };
  });

  const ordenarPorEtapa = (a: Grupo, b: Grupo) => comparar(a.ordem.produtoCodigo, b.ordem.produtoCodigo) || a.etapa.ordem - b.etapa.ordem || comparar(a.ordem.unidade, b.ordem.unidade);
  return {
    producao: [...producao.values()].sort(ordenarPorEtapa).map((l) => {
      const soma = somarResultados(l.resultados);
      return {
        produtoCodigo: l.ordem.produtoCodigo,
        etapaRoteiroId: l.etapa.id,
        ordem: l.etapa.ordem,
        operacaoNome: l.etapa.operacaoNome,
        ultimaEtapa: l.ultimaEtapa,
        unidade: l.ordem.unidade,
        ordensBaixadas: l.ordens,
        encerramentosParciais: l.parciais,
        quantidadeBoa: soma.quantidadeBoa,
        quantidadeRetrabalho: soma.quantidadeRetrabalho,
        quantidadeRefugo: soma.quantidadeRefugo,
      };
    }),
    producaoFinal: [...final.values()]
      .sort((a, b) => comparar(a.produtoCodigo, b.produtoCodigo) || comparar(a.unidade, b.unidade))
      .map((f) => ({ produtoCodigo: f.produtoCodigo, unidade: f.unidade, quantidadeBoa: somarResultados(f.resultados).quantidadeBoa })),
    tempos: tempos.sort((a, b) => comparar(a.posto.codigo, b.posto.codigo)),
    tempoMedio: [...medio.values()].sort(ordenarPorEtapa).map((m) => {
      const segundosPorUnidade = calcularTempoMedioPorUnidade(m.execucoes);
      const tempoPadraoSegundos = temposPadrao.get(`${m.ordem.produtoId}|${m.etapa.id}`) ?? null;
      const comparacao = compararComTempoPadrao(segundosPorUnidade, tempoPadraoSegundos);
      return {
        produtoCodigo: m.ordem.produtoCodigo,
        etapaRoteiroId: m.etapa.id,
        operacaoNome: m.etapa.operacaoNome,
        unidade: m.ordem.unidade,
        execucoesConsideradas: m.execucoes.length,
        produtivoSegundos: m.execucoes.reduce((soma, e) => soma + e.produtivoSegundos, 0),
        quantidadeBoa: somarResultados(m.resultados).quantidadeBoa,
        segundosPorUnidade,
        tempoPadraoSegundos,
        diferencaSegundos: comparacao?.diferencaSegundos ?? null,
        percentualDoPadrao: comparacao?.percentualDoPadrao ?? null,
      };
    }),
    porDia,
    pendencias,
  };
}

export class IndicadoresService {
  private readonly registros: IndicadoresRepository;
  private readonly agora: () => Date;

  constructor(registros: IndicadoresRepository, agora: () => Date = () => new Date()) {
    this.registros = registros;
    this.agora = agora;
  }

  /** Dia de hoje no horário de Brasília, para o atraso das ordens. */
  private hoje(): string {
    return dataDoInstante(this.agora().getTime());
  }

  /** Todos os blocos do contrato de indicadores, com uma única leitura dos registros. */
  async consultar(periodo: Janela): Promise<Indicadores> {
    validarJanela(periodo);
    const dados = await this.registros.carregarRegistrosDeProducao();
    const situacao = montarSituacaoAtual(dados, periodo, this.hoje());
    const doPeriodo = montarBlocosDoPeriodo(dados, periodo);
    return {
      ordens: situacao.ordens,
      etapasParciais: situacao.etapasParciais,
      producao: doPeriodo.producao,
      producaoFinal: doPeriodo.producaoFinal,
      tempos: doPeriodo.tempos,
      tempoMedio: doPeriodo.tempoMedio,
      porDia: doPeriodo.porDia,
      cargaPendente: situacao.cargaPendente,
      cargaPorPosto: situacao.cargaPorPosto,
      pendencias: [...situacao.pendencias, ...doPeriodo.pendencias],
    };
  }

  /** Só os blocos da situação atual (`ordens`, `cargaPendente` e `cargaPorPosto`). */
  async consultarSituacaoAtual(periodo: Janela): Promise<SituacaoAtual> {
    validarJanela(periodo);
    return montarSituacaoAtual(await this.registros.carregarRegistrosDeProducao(), periodo, this.hoje());
  }
}
