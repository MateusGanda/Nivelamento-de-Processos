import type { OperadoresService } from '../application/operadores.ts';
import { ErroDeOperador, type AlteracaoOperador, type CadastroOperador } from '../domain/operador.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

export function respostaErroOperadores(erro: unknown): Response {
  if (erro instanceof ErroDeOperador || erro instanceof ErroDeAcesso) {
    const status = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 }[erro.codigo];
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

async function lerCorpo(request: Request): Promise<AlteracaoOperador> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeOperador('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => !['nome', 'setorPrincipalId', 'funcao'].includes(campo))) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Informe somente nome, setor principal e função.');
  }
  if ((dados.nome !== undefined && typeof dados.nome !== 'string') ||
      (dados.setorPrincipalId !== undefined && typeof dados.setorPrincipalId !== 'string') ||
      (dados.funcao !== undefined && dados.funcao !== null && typeof dados.funcao !== 'string')) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Nome e setor devem ser textos; função deve ser texto ou nula.');
  }
  return dados as AlteracaoOperador;
}

export async function lerCadastroOperador(request: Request): Promise<CadastroOperador> {
  const dados = await lerCorpo(request);
  if (typeof dados.nome !== 'string' || typeof dados.setorPrincipalId !== 'string') {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Nome e setor principal são obrigatórios.');
  }
  return { nome: dados.nome, setorPrincipalId: dados.setorPrincipalId, funcao: dados.funcao };
}

export async function lerStatusOperador(request: Request): Promise<boolean> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeOperador('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo) || Object.keys(corpo).some((campo) => campo !== 'ativo')) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Informe somente o campo ativo.');
  }
  const { ativo } = corpo as { ativo?: unknown };
  if (typeof ativo !== 'boolean') throw new ErroDeOperador('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
  return ativo;
}

export function criarHandlersOperadores({ autorizar, operadores }: {
  autorizar: () => Promise<unknown>;
  operadores: Pick<OperadoresService, 'listar' | 'criar' | 'alterar' | 'definirStatus'>;
}) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await operadores.listar(), { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroOperadores(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await operadores.criar(await lerCadastroOperador(request)), { status: 201 });
      } catch (erro) { return respostaErroOperadores(erro); }
    },
    async PATCH(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await operadores.alterar(id, await lerCorpo(request)));
      } catch (erro) { return respostaErroOperadores(erro); }
    },
    async PATCH_STATUS(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await operadores.definirStatus(id, await lerStatusOperador(request)));
      } catch (erro) { return respostaErroOperadores(erro); }
    },
  };
}
