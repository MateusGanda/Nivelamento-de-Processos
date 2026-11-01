import type { Indicadores, Pendencia } from '../application/indicadores.ts';
import type { Periodo } from './periodo.ts';

// Formato de GET /api/indicadores: as pendências vêm dentro de `meta`.
export type RespostaIndicadores = Omit<Indicadores, 'pendencias'> & {
  meta: { consultadoEm: string; fuso: string; filtros: { inicio: string; fim: string }; pendencias: Pendencia[] };
};

export class ErroApiIndicadores extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiIndicadores';
    this.status = status;
  }
}

type Registro = Record<string, unknown>;
const objeto = (valor: unknown): valor is Registro => !!valor && typeof valor === 'object' && !Array.isArray(valor);
const texto = (valor: unknown) => typeof valor === 'string';
const numero = (valor: unknown) => typeof valor === 'number' && Number.isFinite(valor);
const numeroOuNulo = (valor: unknown) => valor === null || numero(valor);
const instante = (valor: unknown) => texto(valor) && Number.isFinite(Date.parse(valor as string));
const lista = (valor: unknown, item: (v: Registro) => boolean) => Array.isArray(valor) && valor.every((v) => objeto(v) && item(v));
const posto = (valor: unknown) => objeto(valor) && texto(valor.id) && texto(valor.codigo) && texto(valor.nome);

const ordem = (o: Registro) => texto(o.ordemId) && texto(o.numero) && texto(o.produtoCodigo) && texto(o.produtoNome) &&
  numero(o.quantidade) && texto(o.unidade) && texto(o.planoCodigo) && Number.isInteger(o.etapasTotal) && Number.isInteger(o.etapasBaixadas) &&
  Number.isInteger(o.etapasInconsistentes) && typeof o.emExecucao === 'boolean' && (o.ultimaBaixaEm === null || instante(o.ultimaBaixaEm)) &&
  (o.etapaAtual === null || (objeto(o.etapaAtual) && texto(o.etapaAtual.etapaRoteiroId) && Number.isInteger(o.etapaAtual.ordem) && texto(o.etapaAtual.operacaoNome)));
const producao = (p: Registro) => texto(p.produtoCodigo) && texto(p.etapaRoteiroId) && Number.isInteger(p.ordem) && texto(p.operacaoNome) &&
  typeof p.ultimaEtapa === 'boolean' && texto(p.unidade) && Number.isInteger(p.ordensBaixadas) &&
  numero(p.quantidadeBoa) && numero(p.quantidadeRetrabalho) && numero(p.quantidadeRefugo);
const producaoFinal = (p: Registro) => texto(p.produtoCodigo) && texto(p.unidade) && numero(p.quantidadeBoa);
const tempos = (t: Registro) => posto(t.posto) && texto((t.posto as Registro).setorNome) && numero(t.produtivoSegundos) && numero(t.pausaSegundos) &&
  numero(t.totalSegundos) && Number.isInteger(t.execucoesFinalizadas) && Number.isInteger(t.execucoesAbertas) &&
  lista(t.pausasPorMotivo, (m) => (m.motivoNome === null || texto(m.motivoNome)) && numero(m.segundos) && Number.isInteger(m.ocorrencias));
const tempoMedio = (t: Registro) => texto(t.produtoCodigo) && texto(t.etapaRoteiroId) && texto(t.operacaoNome) && texto(t.unidade) &&
  Number.isInteger(t.execucoesConsideradas) && numero(t.produtivoSegundos) && numero(t.quantidadeBoa) &&
  numeroOuNulo(t.segundosPorUnidade) && numeroOuNulo(t.tempoPadraoSegundos) && numeroOuNulo(t.diferencaSegundos) && numeroOuNulo(t.percentualDoPadrao);
const cargaPendente = (c: Registro) => texto(c.produtoCodigo) && texto(c.etapaRoteiroId) && Number.isInteger(c.ordem) && texto(c.operacaoNome) &&
  texto(c.unidade) && Number.isInteger(c.ordensPendentes) && numero(c.quantidadePendente) && numeroOuNulo(c.tempoPadraoSegundos) &&
  numeroOuNulo(c.cargaPendenteSegundos) && lista(c.postosCompativeis, posto);
const porDia = (d: Registro) => texto(d.data) && /^\d{4}-\d{2}-\d{2}$/.test(d.data as string) && numero(d.produtivoSegundos) && numero(d.pausaSegundos) &&
  Number.isInteger(d.baixas) && numeroOuNulo(d.tempoPadraoDasBaixasSegundos);
const cargaPorPosto = (c: Registro) => posto(c.posto) && numeroOuNulo(c.cargaPendenteSegundos) && numeroOuNulo(c.percentualDaCarga);

function ehResposta(valor: unknown): valor is RespostaIndicadores {
  if (!objeto(valor) || !objeto(valor.meta)) return false;
  const meta = valor.meta;
  return instante(meta.consultadoEm) && texto(meta.fuso) && objeto(meta.filtros) && instante(meta.filtros.inicio) && instante(meta.filtros.fim) &&
    lista(meta.pendencias, (p) => texto(p.codigo)) &&
    lista(valor.ordens, ordem) && lista(valor.producao, producao) && lista(valor.producaoFinal, producaoFinal) &&
    lista(valor.tempos, tempos) && lista(valor.tempoMedio, tempoMedio) && lista(valor.porDia, porDia) && lista(valor.cargaPendente, cargaPendente) &&
    lista(valor.cargaPorPosto, cargaPorPosto);
}

export async function consultarIndicadores(periodo: Periodo, signal?: AbortSignal): Promise<RespostaIndicadores> {
  const parametros = new URLSearchParams({ inicio: periodo.inicio, fim: periodo.fim });
  const resposta = await fetch(`/api/indicadores?${parametros}`, { cache: 'no-store', credentials: 'same-origin', signal });
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = objeto(corpo) && objeto(corpo.erro) ? corpo.erro : null;
    throw new ErroApiIndicadores(resposta.status, erro && texto(erro.mensagem) ? erro.mensagem as string : 'Não foi possível carregar os indicadores. Tente novamente.');
  }
  if (!ehResposta(corpo)) throw new ErroApiIndicadores(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}
