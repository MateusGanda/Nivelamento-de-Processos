import type { OperacoesService } from '../application/operacoes.ts';
import { ErroDeOperacao, type AlteracaoOperacao, type CadastroOperacao } from '../domain/operacao.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

export function respostaErroOperacoes(erro: unknown): Response {
  if (erro instanceof ErroDeOperacao || erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo] });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

async function lerCorpo(request: Request): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => campo !== 'nome' && campo !== 'descricao')) {
    throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Informe somente nome e descrição.');
  }
  if (dados.nome !== undefined && typeof dados.nome !== 'string') {
    throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Nome deve ser texto.');
  }
  if (dados.descricao !== undefined && dados.descricao !== null && typeof dados.descricao !== 'string') {
    throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  }
  return dados;
}

export async function lerCadastroOperacao(request: Request): Promise<CadastroOperacao> {
  const dados = await lerCorpo(request);
  if (typeof dados.nome !== 'string') throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Nome deve ser texto obrigatório.');
  return { nome: dados.nome, descricao: dados.descricao as string | null | undefined };
}

export async function lerAlteracaoOperacao(request: Request): Promise<AlteracaoOperacao> {
  const dados = await lerCorpo(request);
  const alteracao: AlteracaoOperacao = {};
  if (dados.nome !== undefined) alteracao.nome = dados.nome as string;
  if (dados.descricao !== undefined) alteracao.descricao = dados.descricao as string | null;
  return alteracao;
}

// A rota fornece a autorização real; testes usam dependências em memória.
export function criarHandlersOperacoes({ autorizar, operacoes }: {
  autorizar: () => Promise<unknown>;
  operacoes: Pick<OperacoesService, 'listar' | 'criar' | 'alterar'>;
}) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await operacoes.listar(), { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroOperacoes(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await operacoes.criar(await lerCadastroOperacao(request)), { status: 201 });
      } catch (erro) { return respostaErroOperacoes(erro); }
    },
    async PATCH(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await operacoes.alterar(id, await lerAlteracaoOperacao(request)));
      } catch (erro) { return respostaErroOperacoes(erro); }
    },
  };
}
