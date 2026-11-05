import type { ExecucoesService } from '../application/execucoes.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

const STATUS_ACESSO = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;
const SEM_CACHE = { 'Cache-Control': 'no-store' };

function respostaErro(erro: unknown): Response {
  if (erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS_ACESSO[erro.codigo], headers: SEM_CACHE });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500, headers: SEM_CACHE });
}

// GET /api/execucoes: acompanhamento das execuções abertas no painel, só para o administrador.
// Só leitura; não recebe parâmetros. `consultadoEm` permite à tela contar o tempo pelo relógio do servidor.
// Dependências explícitas permitem testar sem autenticação real nem banco.
export function criarHandlersAcompanhamento({ autorizar, execucoes, agora = () => new Date() }: {
  autorizar: () => Promise<unknown>;
  execucoes: Pick<ExecucoesService, 'listarAbertas'>;
  agora?: () => Date;
}) {
  return {
    async GET(request: Request): Promise<Response> {
      try {
        await autorizar();
        if (new URL(request.url).searchParams.size > 0) {
          return Response.json({ erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'Esta consulta não aceita parâmetros.' } }, { status: 400, headers: SEM_CACHE });
        }
        const lista = await execucoes.listarAbertas();
        return Response.json({ meta: { consultadoEm: agora().toISOString() }, execucoes: lista }, { headers: SEM_CACHE });
      } catch (erro) {
        return respostaErro(erro);
      }
    },
  };
}
