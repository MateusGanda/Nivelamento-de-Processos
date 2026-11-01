import type { OrdensService } from '../application/ordens.ts';
import { ErroDeOrdem, type AlteracaoOrdem, type CadastroOrdem } from '../domain/ordem.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

export function respostaErroOrdens(erro: unknown): Response {
  if (erro instanceof ErroDeOrdem || erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo] });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

async function lerCorpo(request: Request, campos: readonly string[], mensagem: string): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => !campos.includes(campo))) throw new ErroDeOrdem('ENTRADA_INVALIDA', mensagem);
  return dados;
}

export async function lerCadastroOrdem(request: Request): Promise<CadastroOrdem> {
  const dados = await lerCorpo(request, ['numero', 'planoId', 'produtoId', 'roteiroId', 'quantidade', 'unidade'],
    'Informe somente número, plano, produto, roteiro, quantidade e unidade.');
  return dados as CadastroOrdem;
}

// Produto e roteiro não entram: a ordem mantém os escolhidos na criação.
export async function lerAlteracaoOrdem(request: Request): Promise<AlteracaoOrdem> {
  const dados = await lerCorpo(request, ['numero', 'planoId', 'quantidade', 'unidade'],
    'Só número, plano, quantidade e unidade podem ser alterados; produto e roteiro ficam fixos na ordem.');
  return dados as AlteracaoOrdem;
}

type Dependencias = { autorizar: () => Promise<unknown>; ordens: Pick<OrdensService, 'listar' | 'criar' | 'alterar'> };

// A rota fornece a autorização real; testes substituem dependências sem usar o banco.
export function criarHandlersOrdens({ autorizar, ordens }: Dependencias) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await ordens.listar(), { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroOrdens(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await ordens.criar(await lerCadastroOrdem(request)), { status: 201 });
      } catch (erro) { return respostaErroOrdens(erro); }
    },
    async PATCH(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await ordens.alterar(id, await lerAlteracaoOrdem(request)));
      } catch (erro) { return respostaErroOrdens(erro); }
    },
  };
}
