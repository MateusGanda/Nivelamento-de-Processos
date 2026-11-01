import type { RespostaIndicadores } from './api-client.ts';
import { formatarInstante } from './formatacao.ts';
import { descreverPendencias } from './pendencias.ts';
import { dataLocal } from './periodo.ts';
import { leituraDoPadrao, percentualDePecasBoas, qualidadePorUnidade, resumirIndicadores, situacaoDaOrdem } from './resumo.ts';

// Planilha CSV para o Excel em português: separador ";", vírgula decimal e marca UTF-8
// no início para os acentos. Tempos em minutos e números sem separador de milhar.

const BOM = '﻿';

/** Número com vírgula decimal; vazio quando indisponível (nunca zero presumido). */
function numero(valor: number | null, casas = 2): string {
  if (valor === null) return '';
  const fator = 10 ** casas;
  return String(Math.round(valor * fator) / fator).replace('.', ',');
}

const minutos = (segundos: number | null) => (segundos === null ? '' : numero(segundos / 60, 1));

/** Texto vindo dos cadastros: entre aspas quando preciso e sem virar fórmula no Excel. */
export function textoCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const linha = (...celulas: string[]) => celulas.join(';');

/** Primeiro e último dia do período (o fim da consulta é exclusivo). */
export function diasDoPeriodo(dados: RespostaIndicadores) {
  return { primeiro: dataLocal(Date.parse(dados.meta.filtros.inicio)), ultimo: dataLocal(Date.parse(dados.meta.filtros.fim) - 1) };
}

const dataBr = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;

export function nomeDoArquivo(dados: RespostaIndicadores): string {
  const { primeiro, ultimo } = diasDoPeriodo(dados);
  return `indicadores_${primeiro}_a_${ultimo}.csv`;
}

export function gerarCsvIndicadores(dados: RespostaIndicadores): string {
  const { primeiro, ultimo } = diasDoPeriodo(dados);
  const resumo = resumirIndicadores(dados);
  const linhas: string[] = [];
  const bloco = (titulo: string, cabecalho: string[], corpo: string[][]) => {
    linhas.push('', textoCsv(titulo), linha(...cabecalho));
    if (corpo.length === 0) linhas.push('Sem registros');
    for (const celulas of corpo) linhas.push(linha(...celulas));
  };

  linhas.push('Relatório de indicadores - GUNP');
  linhas.push(linha('Período', `${dataBr(primeiro)} a ${dataBr(ultimo)}`));
  linhas.push(linha('Consultado em', formatarInstante(dados.meta.consultadoEm)));
  linhas.push('Tempos em minutos. O tempo é da execução da etapa e não mede o desempenho de uma pessoa.');

  bloco('Resumo', ['Indicador', 'Valor', 'Unidade'], [
    ...resumo.producaoPorUnidade.map((p) => ['Peças boas na última etapa', numero(p.quantidade), textoCsv(p.unidade)]),
    ['Ordens em andamento', String(resumo.emAndamento), 'ordens'],
    ['Ordens em execução agora', String(resumo.emExecucao), 'ordens'],
    ['Tempo produtivo', minutos(resumo.produtivoSegundos), 'min'],
    ['Tempo em pausa', minutos(resumo.pausaSegundos), 'min'],
  ]);
  bloco('Atenção aos dados', ['Aviso'], descreverPendencias(dados).map((aviso) => [textoCsv(aviso)]));
  bloco('Posição das ordens', ['Ordem', 'Produto', 'Nome do produto', 'Plano', 'Quantidade', 'Unidade', 'Etapas com baixa', 'Etapas do roteiro', 'Situação', 'Última baixa'],
    dados.ordens.map((o) => [textoCsv(o.numero), textoCsv(o.produtoCodigo), textoCsv(o.produtoNome), textoCsv(o.planoCodigo), numero(o.quantidade), textoCsv(o.unidade),
      String(o.etapasBaixadas), String(o.etapasTotal), textoCsv(situacaoDaOrdem(o)), o.ultimaBaixaEm === null ? '' : formatarInstante(o.ultimaBaixaEm)]));
  bloco('Tempo por dia', ['Dia', 'Produtivo (min)', 'Pausa (min)', 'Baixas', 'Tempo padrão das baixas (min)'],
    dados.porDia.map((d) => [dataBr(d.data), minutos(d.produtivoSegundos), minutos(d.pausaSegundos), String(d.baixas), minutos(d.tempoPadraoDasBaixasSegundos)]));
  bloco('Qualidade na última etapa', ['Unidade', 'Boa', 'Retrabalho', 'Refugo', 'Peças boas (%)'],
    qualidadePorUnidade(dados).map((q) => [textoCsv(q.unidade), numero(q.boa), numero(q.retrabalho), numero(q.refugo), numero(percentualDePecasBoas(q), 1)]));
  bloco('Produção no período', ['Produto', 'Etapa', 'Última etapa', 'Ordens', 'Boa', 'Retrabalho', 'Refugo', 'Unidade'],
    dados.producao.map((p) => [textoCsv(p.produtoCodigo), textoCsv(`${p.ordem}. ${p.operacaoNome}`), p.ultimaEtapa ? 'Sim' : 'Não', String(p.ordensBaixadas),
      numero(p.quantidadeBoa), numero(p.quantidadeRetrabalho), numero(p.quantidadeRefugo), textoCsv(p.unidade)]));
  bloco('Tempos por posto', ['Posto', 'Nome', 'Setor', 'Produtivo (min)', 'Pausa (min)', 'Total (min)', 'Finalizadas', 'Em aberto'],
    dados.tempos.map((t) => [textoCsv(t.posto.codigo), textoCsv(t.posto.nome), textoCsv(t.posto.setorNome), minutos(t.produtivoSegundos), minutos(t.pausaSegundos),
      minutos(t.totalSegundos), String(t.execucoesFinalizadas), String(t.execucoesAbertas)]));
  bloco('Pausas por motivo', ['Posto', 'Motivo', 'Tempo (min)', 'Ocorrências'],
    dados.tempos.flatMap((t) => t.pausasPorMotivo.map((m) => [textoCsv(t.posto.codigo), textoCsv(m.motivoNome ?? 'Sem motivo'), minutos(m.segundos), String(m.ocorrencias)])));
  bloco('Tempo por unidade e tempo padrão', ['Produto', 'Etapa', 'Execuções', 'Tempo por unidade (s)', 'Tempo padrão (s)', 'Percentual do padrão', 'Leitura', 'Unidade'],
    dados.tempoMedio.map((t) => [textoCsv(t.produtoCodigo), textoCsv(t.operacaoNome), String(t.execucoesConsideradas), numero(t.segundosPorUnidade), numero(t.tempoPadraoSegundos),
      numero(t.percentualDoPadrao, 1), leituraDoPadrao(t), textoCsv(t.unidade)]));
  bloco('Carga pendente por posto (estimativa)', ['Posto', 'Nome', 'Carga pendente (min)', 'Percentual da carga'],
    dados.cargaPorPosto.map((c) => [textoCsv(c.posto.codigo), textoCsv(c.posto.nome), minutos(c.cargaPendenteSegundos), numero(c.percentualDaCarga, 1)]));
  bloco('Carga pendente por etapa', ['Produto', 'Etapa', 'Ordens', 'Quantidade', 'Unidade', 'Tempo padrão (s por unidade)', 'Carga pendente (min)', 'Postos'],
    dados.cargaPendente.map((c) => [textoCsv(c.produtoCodigo), textoCsv(`${c.ordem}. ${c.operacaoNome}`), String(c.ordensPendentes), numero(c.quantidadePendente), textoCsv(c.unidade),
      numero(c.tempoPadraoSegundos), minutos(c.cargaPendenteSegundos), textoCsv(c.postosCompativeis.map((p) => p.codigo).join(', '))]));

  return BOM + linhas.join('\r\n') + '\r\n';
}
