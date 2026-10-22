import type { PlanosService } from '../application/planos.ts';
import { ErroDePlano, type AlteracaoPlano, type CadastroPlano } from '../domain/plano.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

export function respostaErroPlanos(erro: unknown): Response {
  if (erro instanceof ErroDePlano || erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo] });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

const CAMPOS = ['codigo', 'descricao', 'dataInicio', 'dataFim'] as const;

async function lerCorpo(request: Request): Promise<AlteracaoPlano> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDePlano('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroDePlano('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => !(CAMPOS as readonly string[]).includes(campo))) {
    throw new ErroDePlano('ENTRADA_INVALIDA', 'Informe somente código, descrição e datas de início e fim.');
  }
  if (dados.codigo !== undefined && typeof dados.codigo !== 'string') throw new ErroDePlano('ENTRADA_INVALIDA', 'Código deve ser texto.');
  for (const campo of ['descricao', 'dataInicio', 'dataFim'] as const) {
    if (dados[campo] !== undefined && dados[campo] !== null && typeof dados[campo] !== 'string') {
      throw new ErroDePlano('ENTRADA_INVALIDA', 'Descrição e datas devem ser texto ou nulas.');
    }
  }
  return dados as AlteracaoPlano;
}

export async function lerCadastroPlano(request: Request): Promise<CadastroPlano> {
  const dados = await lerCorpo(request);
  if (typeof dados.codigo !== 'string') throw new ErroDePlano('ENTRADA_INVALIDA', 'Código deve ser texto obrigatório.');
  return { codigo: dados.codigo, descricao: dados.descricao, dataInicio: dados.dataInicio, dataFim: dados.dataFim };
}

export const lerAlteracaoPlano = lerCorpo;

type Dependencias = { autorizar: () => Promise<unknown>; planos: Pick<PlanosService, 'listar' | 'criar' | 'alterar'> };

// A rota fornece a autorização real; testes substituem dependências sem usar o banco.
export function criarHandlersPlanos({ autorizar, planos }: Dependencias) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await planos.listar(), { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroPlanos(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await planos.criar(await lerCadastroPlano(request)), { status: 201 });
      } catch (erro) { return respostaErroPlanos(erro); }
    },
    async PATCH(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await planos.alterar(id, await lerAlteracaoPlano(request)));
      } catch (erro) { return respostaErroPlanos(erro); }
    },
  };
}
