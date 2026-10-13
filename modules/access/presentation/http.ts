import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth.ts';
import { usuariosService } from '../composition.ts';
import { ErroDeAcesso } from '../domain/usuario.ts';

export function respostaJson(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status });
}

export function respostaDeErro(erro: unknown): Response {
  if (erro instanceof ErroDeAcesso) {
    const status = {
      ENTRADA_INVALIDA: 400,
      NAO_AUTENTICADO: 401,
      SEM_AUTORIZACAO: 403,
      NAO_ENCONTRADO: 404,
      CONFLITO: 409,
    }[erro.codigo];
    return respostaJson({ erro: { codigo: erro.codigo, mensagem: erro.message } }, status);
  }
  return respostaJson({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, 500);
}

export async function exigirAdminDaSessao(): Promise<{ id: string }> {
  const sessao = await getServerSession(authOptions);
  const id = sessao?.user?.id;
  if (!id) throw new ErroDeAcesso('NAO_AUTENTICADO', 'Autenticação obrigatória.');
  await usuariosService.exigirAdminAtivo(id);
  return { id };
}

export async function lerObjetoJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const corpo = await request.json();
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
      throw new ErroDeAcesso('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
    }
    return corpo as Record<string, unknown>;
  } catch (erro) {
    if (erro instanceof ErroDeAcesso) throw erro;
    throw new ErroDeAcesso('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
}

export function exigirTexto(corpo: Record<string, unknown>, campo: string): string {
  const valor = corpo[campo];
  if (typeof valor !== 'string') throw new ErroDeAcesso('ENTRADA_INVALIDA', `${campo} é obrigatório.`);
  return valor;
}

export function textoOpcional(corpo: Record<string, unknown>, campo: string): string | undefined {
  const valor = corpo[campo];
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') throw new ErroDeAcesso('ENTRADA_INVALIDA', `${campo} deve ser texto.`);
  return valor;
}
