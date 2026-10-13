import type { OperadoresService } from '../application/operadores.ts';
import { ErroDeOperador, type CadastroOperador } from '../domain/operador.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

export function respostaErroOperadores(erro: unknown): Response {
  if (erro instanceof ErroDeOperador) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: erro.codigo === 'CONFLITO' ? 409 : 400 });
  }
  if (erro instanceof ErroDeAcesso) {
    const status = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 }[erro.codigo];
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

export async function lerCadastroOperador(request: Request): Promise<CadastroOperador> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeOperador('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => campo !== 'nome' && campo !== 'matricula')) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Informe somente nome e matrícula.');
  }
  if (typeof dados.nome !== 'string' || typeof dados.matricula !== 'string') {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Nome e matrícula devem ser textos obrigatórios.');
  }
  return { nome: dados.nome, matricula: dados.matricula };
}

// Dependências explícitas permitem testar os handlers sem autenticação real
// nem acesso ao banco. A rota de produção sempre fornece a autorização real.
export function criarHandlersOperadores({ autorizar, operadores }: {
  autorizar: () => Promise<unknown>;
  operadores: Pick<OperadoresService, 'listar' | 'criar'>;
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
  };
}
