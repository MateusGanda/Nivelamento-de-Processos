import type { RoteirosService } from '../application/roteiros.ts';
import { ErroDeRoteiro } from '../domain/roteiro.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

export function respostaErroRoteiros(erro: unknown): Response {
  if (erro instanceof ErroDeRoteiro || erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo] });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

// Lê um objeto JSON com exatamente o campo esperado.
async function lerCampo(request: Request, campo: string): Promise<unknown> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((chave) => chave !== campo)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', `Informe somente o campo ${campo}.`);
  return dados[campo];
}

type Dependencias = {
  autorizar: () => Promise<unknown>;
  roteiros: Pick<RoteirosService, 'listar' | 'buscar' | 'criar' | 'definirStatus' | 'salvarEtapas' | 'definirPostosDaEtapa' | 'criarVersao'>;
};

// A rota fornece a autorização real; testes substituem dependências sem usar o banco.
export function criarHandlersRoteiros({ autorizar, roteiros }: Dependencias) {
  async function responder(acao: () => Promise<unknown>, status = 200): Promise<Response> {
    try {
      await autorizar();
      return Response.json(await acao(), { status, headers: { 'Cache-Control': 'no-store' } });
    } catch (erro) { return respostaErroRoteiros(erro); }
  }

  return {
    GET: () => responder(() => roteiros.listar()),
    POST: (request: Request) => responder(async () => {
      const nome = await lerCampo(request, 'nome');
      if (typeof nome !== 'string') throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Nome é obrigatório.');
      return roteiros.criar({ nome });
    }, 201),
    GET_DETALHE: (id: string) => responder(() => roteiros.buscar(id)),
    PATCH_STATUS: (request: Request, id: string) => responder(async () => {
      const ativo = await lerCampo(request, 'ativo');
      if (typeof ativo !== 'boolean') throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
      return roteiros.definirStatus(id, ativo);
    }),
    PUT_ETAPAS: (request: Request, id: string) => responder(async () => roteiros.salvarEtapas(id, await lerCampo(request, 'etapas'))),
    PUT_POSTOS: (request: Request, id: string, etapaId: string) =>
      responder(async () => roteiros.definirPostosDaEtapa(id, etapaId, await lerCampo(request, 'postoIds'))),
    POST_VERSAO: (id: string) => responder(() => roteiros.criarVersao(id), 201),
  };
}
