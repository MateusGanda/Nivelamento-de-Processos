import type { PostosService } from '../application/postos.ts';
import { ErroDePosto, type CadastroPosto } from '../domain/posto.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

export function respostaErroPostos(erro: unknown): Response {
  if (erro instanceof ErroDePosto) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: erro.codigo === 'CONFLITO' ? 409 : 400 });
  }
  if (erro instanceof ErroDeAcesso) {
    const status = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 }[erro.codigo];
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

const CAMPOS = new Set(['codigo', 'nome', 'setorId']);

export async function lerCadastroPosto(request: Request): Promise<CadastroPosto> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDePosto('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDePosto('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => !CAMPOS.has(campo))) {
    throw new ErroDePosto('ENTRADA_INVALIDA', 'Informe somente código, nome e setor.');
  }
  if (typeof dados.codigo !== 'string' || typeof dados.nome !== 'string' || typeof dados.setorId !== 'string') {
    throw new ErroDePosto('ENTRADA_INVALIDA', 'Código, nome e setor devem ser textos obrigatórios.');
  }
  return { codigo: dados.codigo, nome: dados.nome, setorId: dados.setorId };
}

// A rota fornece a autorização real; testes substituem dependências sem usar o banco.
export function criarHandlersPostos({ autorizar, postos }: {
  autorizar: () => Promise<unknown>;
  postos: Pick<PostosService, 'listar' | 'criar'>;
}) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await postos.listar(), { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroPostos(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await postos.criar(await lerCadastroPosto(request)), { status: 201 });
      } catch (erro) { return respostaErroPostos(erro); }
    },
  };
}
