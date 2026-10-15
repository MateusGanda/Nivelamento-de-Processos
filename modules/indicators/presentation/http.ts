import type { Janela } from '../../../shared/validation.ts';
import type { IndicadoresService } from '../application/indicadores.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

/** Erro de formato dos parâmetros da consulta de indicadores. */
export class ErroDeConsultaIndicadores extends Error {
  readonly codigo = 'ENTRADA_INVALIDA';

  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeConsultaIndicadores';
  }
}

export function respostaErroIndicadores(erro: unknown): Response {
  if (erro instanceof ErroDeConsultaIndicadores) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: 400 });
  }
  if (erro instanceof ErroDeAcesso) {
    const status = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 }[erro.codigo];
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

// ISO 8601 com data, hora e fuso explícito (Z ou ±hh:mm).
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const PARAMETROS = new Set(['inicio', 'fim', 'setorId', 'postoId']);

function lerInstante(parametros: URLSearchParams, nome: 'inicio' | 'fim'): number {
  const valor = parametros.get(nome);
  if (valor === null) throw new ErroDeConsultaIndicadores(`Informe ${nome}.`);
  const ms = Date.parse(valor);
  if (!INSTANTE.test(valor) || Number.isNaN(ms)) {
    throw new ErroDeConsultaIndicadores(`${nome} deve ser data e hora ISO 8601 com fuso, por exemplo 2026-10-06T08:00:00-03:00.`);
  }
  return ms;
}

/** Período da consulta: `inicio` inclusivo e `fim` exclusivo. */
export function lerPeriodo(url: URL): Janela {
  const parametros = url.searchParams;
  if ([...parametros.keys()].some((nome) => !PARAMETROS.has(nome))) {
    throw new ErroDeConsultaIndicadores('Parâmetros aceitos: inicio, fim, setorId e postoId.');
  }
  if (parametros.has('setorId') || parametros.has('postoId')) {
    throw new ErroDeConsultaIndicadores('Os filtros setorId e postoId ainda não estão disponíveis.');
  }
  const periodo = { inicioMs: lerInstante(parametros, 'inicio'), fimMs: lerInstante(parametros, 'fim') };
  if (periodo.fimMs <= periodo.inicioMs) throw new ErroDeConsultaIndicadores('fim deve ser posterior a inicio.');
  return periodo;
}

// Dependências explícitas permitem testar o handler sem autenticação real
// nem acesso ao banco. A rota de produção sempre fornece a autorização real.
export function criarHandlersIndicadores({ autorizar, indicadores, agora = () => new Date() }: {
  autorizar: () => Promise<unknown>;
  indicadores: Pick<IndicadoresService, 'consultar'>;
  agora?: () => Date;
}) {
  return {
    async GET(request: Request): Promise<Response> {
      try {
        await autorizar();
        const periodo = lerPeriodo(new URL(request.url));
        const { pendencias, ...blocos } = await indicadores.consultar(periodo);
        const meta = {
          consultadoEm: agora().toISOString(),
          fuso: 'America/Sao_Paulo',
          filtros: { inicio: new Date(periodo.inicioMs).toISOString(), fim: new Date(periodo.fimMs).toISOString(), setorId: null, postoId: null },
          pendencias,
        };
        return Response.json({ meta, ...blocos }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) {
        return respostaErroIndicadores(erro);
      }
    },
  };
}
