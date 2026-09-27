/** Funções puras: segundos para durações, milissegundos Unix para instantes.
 * Cada consulta de tempos pertence a UM operador. Não somar operadores como
 * se fossem um único relógio de posto. Dados recebidos devem estar auditados.
 */
export type Categoria = 'PRODUTIVO' | 'APOIO_PREPARACAO' | 'INTERRUPCAO' | 'PAUSA_PREVISTA';
export type Janela = { inicioMs: number; fimMs: number };
export type Intervalo = Janela & { categoria: Categoria };
const categorias: Categoria[] = ['PRODUTIVO', 'APOIO_PREPARACAO', 'INTERRUPCAO', 'PAUSA_PREVISTA'];

function naoNegativo(valor: number, campo: string): void {
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`${campo}: informe um número finito não negativo.`);
}
function quantidade(valor: number): void {
  naoNegativo(valor, 'Quantidade');
  if (!Number.isSafeInteger(valor)) throw new Error('Quantidade: informe pares inteiros seguros.');
}
function validarJanela(j: Janela): void {
  if (!Number.isSafeInteger(j.inicioMs) || !Number.isSafeInteger(j.fimMs) || j.fimMs <= j.inicioMs) {
    throw new Error('Janela inválida: fim deve ser posterior ao início, em milissegundos Unix inteiros.');
  }
}
function semSobreposicao<T extends Janela>(itens: readonly T[]): T[] {
  const ordenados = [...itens].sort((a, b) => a.inicioMs - b.inicioMs);
  ordenados.forEach((item, i) => {
    validarJanela(item);
    if (i > 0 && item.inicioMs < ordenados[i - 1].fimMs) throw new Error('Intervalos sobrepostos.');
  });
  return ordenados;
}
function intersecao(a: Janela, b: Janela): Janela | null {
  const inicioMs = Math.max(a.inicioMs, b.inicioMs);
  const fimMs = Math.min(a.fimMs, b.fimMs);
  return fimMs > inicioMs ? { inicioMs, fimMs } : null;
}
function segundos(j: Janela): number { return (j.fimMs - j.inicioMs) / 1000; }

/** Janelas de disponibilidade devem estar sem sobreposição. Exclusões planejadas
 * são subtraídas previamente; intervalos apontados são recortados às mesmas janelas.
 * Sem janela informada: indisponível (null), não zero ou ociosidade presumida.
 * Versão inicial aceita somente intervalos encerrados; não estima execução aberta.
 */
export function calcularTempos(intervalos: readonly Intervalo[], janelas: readonly Janela[] | null) {
  const registros = semSobreposicao(intervalos);
  for (const r of registros) if (!categorias.includes(r.categoria)) throw new Error('Categoria inválida.');
  if (janelas === null) return null;
  const disponiveis = semSobreposicao(janelas);
  const porCategoria: Record<Categoria, number> = {
    PRODUTIVO: 0, APOIO_PREPARACAO: 0, INTERRUPCAO: 0, PAUSA_PREVISTA: 0,
  };
  for (const r of registros) {
    for (const janela of disponiveis) {
      const parte = intersecao(r, janela);
      if (parte) porCategoria[r.categoria] += segundos(parte);
    }
  }
  const janelaSegundos = disponiveis.reduce((s, j) => s + segundos(j), 0);
  const classificadoSegundos = Object.values(porCategoria).reduce((s, v) => s + v, 0);
  return {
    porCategoria,
    janelaSegundos,
    classificadoSegundos,
    naoProdutivoApontadoSegundos: porCategoria.APOIO_PREPARACAO + porCategoria.INTERRUPCAO + porCategoria.PAUSA_PREVISTA,
    semInformacaoSegundos: Math.max(0, janelaSegundos - classificadoSegundos),
    coberturaPercentual: janelaSegundos > 0 ? classificadoSegundos / janelaSegundos * 100 : null,
  };
}

/** Use antes de calcularTempos para retirar pausas programadas do denominador
 * E do numerador. Retorna também o total excluído para apresentação separada.
 */
export function descontarPausasProgramadas(janelas: readonly Janela[], pausas: readonly Janela[]) {
  const originais = semSobreposicao(janelas);
  const exclusoes = semSobreposicao(pausas);
  let liquidas: Janela[] = originais;
  for (const pausa of exclusoes) {
    liquidas = liquidas.flatMap(j => {
      const parte = intersecao(j, pausa);
      if (!parte) return [j];
      const restos: Janela[] = [];
      if (j.inicioMs < parte.inicioMs) restos.push({ inicioMs: j.inicioMs, fimMs: parte.inicioMs });
      if (parte.fimMs < j.fimMs) restos.push({ inicioMs: parte.fimMs, fimMs: j.fimMs });
      return restos;
    });
  }
  return {
    janelas: liquidas,
    excluidoSegundos: originais.reduce((s, j) => s + segundos(j), 0) - liquidas.reduce((s, j) => s + segundos(j), 0),
  };
}

export type ItemCarga = { quantidadePlanejada: number; tempoReferenciaSegundosPorPar: number | null };
/** Um único posto/recurso e período; tempo de referência ausente não vale zero. */
export function calcularCarga(itens: readonly ItemCarga[], disponibilidadeSegundos: number | null) {
  if (disponibilidadeSegundos !== null) naoNegativo(disponibilidadeSegundos, 'Disponibilidade');
  for (const i of itens) {
    quantidade(i.quantidadePlanejada);
    if (i.tempoReferenciaSegundosPorPar !== null) {
      naoNegativo(i.tempoReferenciaSegundosPorPar, 'Tempo de referência');
      if (i.tempoReferenciaSegundosPorPar === 0) throw new Error('Tempo de referência deve ser positivo.');
    }
  }
  const referenciasPendentes = itens.filter(i => i.quantidadePlanejada > 0 && i.tempoReferenciaSegundosPorPar === null).length;
  const cargaSegundos = referenciasPendentes > 0 ? null : itens.reduce((s, i) => s + i.quantidadePlanejada * (i.tempoReferenciaSegundosPorPar ?? 0), 0);
  if (cargaSegundos !== null && !Number.isFinite(cargaSegundos)) throw new Error('Carga excedeu o limite numérico.');
  return {
    cargaSegundos,
    referenciasPendentes,
    disponibilidadeSegundos,
    ocupacaoPlanejadaPercentual: cargaSegundos !== null && disponibilidadeSegundos !== null && disponibilidadeSegundos > 0
      ? cargaSegundos / disponibilidadeSegundos * 100 : null,
  };
}

/** Mesmo produto/operação; execuções completas encerradas, sem recortar só o
 * numerador. Não é ciclo da linha nem média simples de médias individuais.
 */
export function calcularTempoMedioPorPar(execucoes: readonly { produtivoSegundos: number; paresBons: number }[]): number | null {
  let tempo = 0;
  let pares = 0;
  for (const e of execucoes) {
    naoNegativo(e.produtivoSegundos, 'Tempo produtivo');
    quantidade(e.paresBons);
    tempo += e.produtivoSegundos;
    pares += e.paresBons;
  }
  if (!Number.isFinite(tempo) || !Number.isSafeInteger(pares)) throw new Error('Totais excederam o limite numérico.');
  return pares > 0 ? tempo / pares : null;
}

/** Agregados já reconciliados pela API: não somar etapas como produção final.
 * Previsto e realizado precisam ter o mesmo produto/etapa/período.
 * Saldo negativo é mantido para revelar inconsistência; servidor deve impedir excesso.
 */
export function calcularProducao(previsto: number | null, realizadoBom: number) {
  quantidade(realizadoBom);
  if (previsto !== null) quantidade(previsto);
  return {
    previsto, realizadoBom,
    saldo: previsto === null ? null : previsto - realizadoBom,
    cumprimentoPercentual: previsto !== null && previsto > 0 ? realizadoBom / previsto * 100 : null,
    excedePrevisto: previsto !== null && realizadoBom > previsto,
  };
}
