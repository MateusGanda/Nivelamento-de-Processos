import { centesimos } from '../../../shared/validation.ts';

/** Mesmos campos de resultado da execução no contrato do banco. */
export type Resultado = { quantidadeBoa: number; quantidadeRetrabalho: number; quantidadeRefugo: number };

/** Soma exata, em duas casas, dos resultados informados. */
export function somarResultados(resultados: readonly Resultado[]) {
  let boa = 0;
  let retrabalho = 0;
  let refugo = 0;
  for (const r of resultados) {
    boa += centesimos(r.quantidadeBoa, 'Quantidade boa');
    retrabalho += centesimos(r.quantidadeRetrabalho, 'Quantidade de retrabalho');
    refugo += centesimos(r.quantidadeRefugo, 'Quantidade de refugo');
  }
  if (!Number.isSafeInteger(boa + retrabalho + refugo)) throw new Error('Totais excederam o limite numérico.');
  return {
    quantidadeBoa: boa / 100,
    quantidadeRetrabalho: retrabalho / 100,
    quantidadeRefugo: refugo / 100,
    total: (boa + retrabalho + refugo) / 100,
  };
}

/** Confere a regra boa + retrabalho + refugo = quantidade da ordem. */
export function conferirResultado(quantidadeOrdem: number, resultado: Resultado) {
  const esperado = centesimos(quantidadeOrdem, 'Quantidade da ordem');
  const total = centesimos(somarResultados([resultado]).total, 'Total');
  return { total: total / 100, diferenca: (esperado - total) / 100, confere: esperado === total };
}

/** Mesmos valores de StatusExecucao no contrato do banco. */
export type StatusExecucao = 'EM_EXECUCAO' | 'PAUSADA' | 'FINALIZADA';
export type ExecucaoDaEtapa = Resultado & { status: StatusExecucao };
export type SituacaoBaixa = 'SEM_BAIXA' | 'BAIXADA' | 'INCONSISTENTE';

/** Baixa de UMA etapa de UMA ordem. Regra adotada nos cálculos: a baixa é a
 * execução FINALIZADA que informa quantidades. Execução finalizada por troca de
 * operação fica com as três quantidades em zero e não conta como baixa.
 * A baixa vale quando é única e soma a quantidade da ordem; qualquer outra
 * combinação com quantidade informada é inconsistência, não baixa.
 */
export function identificarBaixa(quantidadeOrdem: number, execucoes: readonly ExecucaoDaEtapa[]): { situacao: SituacaoBaixa; resultado: Resultado | null } {
  if (centesimos(quantidadeOrdem, 'Quantidade da ordem') === 0) throw new Error('Quantidade da ordem deve ser positiva.');
  const comQuantidade = execucoes.filter(e => somarResultados([e]).total > 0);
  if (comQuantidade.length === 0) return { situacao: 'SEM_BAIXA', resultado: null };
  const [unica] = comQuantidade;
  if (comQuantidade.length > 1 || unica.status !== 'FINALIZADA' || !conferirResultado(quantidadeOrdem, unica).confere) {
    return { situacao: 'INCONSISTENTE', resultado: null };
  }
  return {
    situacao: 'BAIXADA',
    resultado: { quantidadeBoa: unica.quantidadeBoa, quantidadeRetrabalho: unica.quantidadeRetrabalho, quantidadeRefugo: unica.quantidadeRefugo },
  };
}

/** Posição de UMA ordem no seu roteiro. A sequência das etapas é só nominal:
 * a etapa atual é a primeira sem baixa, mesmo que uma posterior já tenha baixa.
 */
export function calcularPosicao(etapas: readonly { ordem: number; situacao: SituacaoBaixa }[]) {
  const vistas = new Set<number>();
  let etapaAtual: number | null = null;
  let etapasBaixadas = 0;
  let etapasInconsistentes = 0;
  for (const e of etapas) {
    if (!Number.isSafeInteger(e.ordem)) throw new Error('Ordem da etapa: informe um inteiro.');
    if (vistas.has(e.ordem)) throw new Error('Ordem da etapa repetida no roteiro.');
    vistas.add(e.ordem);
    if (e.situacao === 'BAIXADA') {
      etapasBaixadas += 1;
      continue;
    }
    if (e.situacao === 'INCONSISTENTE') etapasInconsistentes += 1;
    if (etapaAtual === null || e.ordem < etapaAtual) etapaAtual = e.ordem;
  }
  return { etapasTotal: etapas.length, etapasBaixadas, etapasInconsistentes, etapaAtual };
}

/** Etapas de UMA ordem. A produção final é a quantidade boa da última etapa do
 * roteiro; o mesmo lote não é somado em etapas sucessivas. Sem etapas: indisponível.
 */
export function calcularProducaoFinal(etapas: readonly { ordem: number; quantidadeBoa: number }[]): number | null {
  let ultima: { ordem: number; quantidadeBoa: number } | null = null;
  const vistas = new Set<number>();
  for (const e of etapas) {
    centesimos(e.quantidadeBoa, 'Quantidade boa');
    if (!Number.isSafeInteger(e.ordem)) throw new Error('Ordem da etapa: informe um inteiro.');
    if (vistas.has(e.ordem)) throw new Error('Ordem da etapa repetida no roteiro.');
    vistas.add(e.ordem);
    if (ultima === null || e.ordem > ultima.ordem) ultima = e;
  }
  return ultima === null ? null : ultima.quantidadeBoa;
}
