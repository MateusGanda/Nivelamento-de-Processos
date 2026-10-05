import { intersecao, naoNegativo, quantidade, segundos, semSobreposicao, validarJanela } from './validacao.ts';
import type { Janela } from './validacao.ts';

/** Mesmos valores da categoria do intervalo de apontamento no banco. */
export type Categoria = 'PRODUTIVO' | 'APOIO_PREPARACAO' | 'INTERRUPCAO' | 'PAUSA_PREVISTA';
export type Intervalo = Janela & { categoria: Categoria };

const categorias: Categoria[] = ['PRODUTIVO', 'APOIO_PREPARACAO', 'INTERRUPCAO', 'PAUSA_PREVISTA'];

/** Tempos apontados de UM operador, recortados ao período consultado. Somar
 * operadores diferentes produz horas-pessoa, não duração de funcionamento do posto.
 *
 * `periodo` é o filtro da consulta e sempre existe. `janelas` é a disponibilidade
 * prevista do operador, já sem as pausas programadas (ver descontarPausasProgramadas);
 * sem ela, só a cobertura fica indisponível (null), os tempos apontados continuam.
 * Aceita somente intervalos encerrados; não estima execução aberta.
 */
export function calcularTempos(intervalos: readonly Intervalo[], periodo: Janela, janelas: readonly Janela[] | null) {
  validarJanela(periodo);
  const registros = semSobreposicao(intervalos);
  for (const r of registros) if (!categorias.includes(r.categoria)) throw new Error('Categoria inválida.');

  const porCategoria: Record<Categoria, number> = {
    PRODUTIVO: 0, APOIO_PREPARACAO: 0, INTERRUPCAO: 0, PAUSA_PREVISTA: 0,
  };
  const recortados: Janela[] = [];
  for (const r of registros) {
    const parte = intersecao(r, periodo);
    if (!parte) continue;
    porCategoria[r.categoria] += segundos(parte);
    recortados.push(parte);
  }

  return {
    porCategoria,
    classificadoSegundos: recortados.reduce((s, j) => s + segundos(j), 0),
    naoProdutivoApontadoSegundos: porCategoria.APOIO_PREPARACAO + porCategoria.INTERRUPCAO + porCategoria.PAUSA_PREVISTA,
    cobertura: janelas === null ? null : calcularCobertura(recortados, periodo, janelas),
  };
}

/** Numerador e denominador usam o mesmo recorte: janela dentro do período.
 * Tempo sem informação não é ociosidade.
 */
function calcularCobertura(recortados: readonly Janela[], periodo: Janela, janelas: readonly Janela[]) {
  const disponiveis = semSobreposicao(janelas)
    .map(j => intersecao(j, periodo))
    .filter((j): j is Janela => j !== null);
  let classificadoSegundos = 0;
  for (const r of recortados) {
    for (const janela of disponiveis) {
      const parte = intersecao(r, janela);
      if (parte) classificadoSegundos += segundos(parte);
    }
  }
  const janelaSegundos = disponiveis.reduce((s, j) => s + segundos(j), 0);
  return {
    janelaSegundos,
    classificadoSegundos,
    semInformacaoSegundos: janelaSegundos - classificadoSegundos,
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
