import type { MotivosPausaService } from '../application/motivos-pausa.ts';
import { ErroDeMotivoPausa, type AlteracaoMotivoPausa, type CadastroMotivoPausa } from '../domain/motivoPausa.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

export function respostaErroMotivosPausa(erro: unknown): Response {
  if (erro instanceof ErroDeMotivoPausa || erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo] });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

async function lerCorpo(request: Request): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => campo !== 'nome' && campo !== 'descricao')) {
    throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Informe somente nome e descrição.');
  }
  if (dados.nome !== undefined && typeof dados.nome !== 'string') {
    throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Nome deve ser texto.');
  }
  if (dados.descricao !== undefined && dados.descricao !== null && typeof dados.descricao !== 'string') {
    throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  }
  return dados;
}

export async function lerCadastroMotivoPausa(request: Request): Promise<CadastroMotivoPausa> {
  const dados = await lerCorpo(request);
  if (typeof dados.nome !== 'string') throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Nome deve ser texto obrigatório.');
  return { nome: dados.nome, descricao: dados.descricao as string | null | undefined };
}

export async function lerAlteracaoMotivoPausa(request: Request): Promise<AlteracaoMotivoPausa> {
  const dados = await lerCorpo(request);
  const alteracao: AlteracaoMotivoPausa = {};
  if (dados.nome !== undefined) alteracao.nome = dados.nome as string;
  if (dados.descricao !== undefined) alteracao.descricao = dados.descricao as string | null;
  return alteracao;
}

export async function lerStatusMotivoPausa(request: Request): Promise<boolean> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo) || Object.keys(corpo).some((campo) => campo !== 'ativo')) {
    throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Informe somente o campo ativo.');
  }
  const { ativo } = corpo as { ativo?: unknown };
  if (typeof ativo !== 'boolean') throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
  return ativo;
}

// A rota fornece a autorização real; testes usam dependências em memória.
export function criarHandlersMotivosPausa({ autorizar, motivosPausa }: {
  autorizar: () => Promise<unknown>;
  motivosPausa: Pick<MotivosPausaService, 'listar' | 'criar' | 'alterar' | 'definirStatus'>;
}) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await motivosPausa.listar(), { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroMotivosPausa(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await motivosPausa.criar(await lerCadastroMotivoPausa(request)), { status: 201 });
      } catch (erro) { return respostaErroMotivosPausa(erro); }
    },
    async PATCH(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await motivosPausa.alterar(id, await lerAlteracaoMotivoPausa(request)));
      } catch (erro) { return respostaErroMotivosPausa(erro); }
    },
    async PATCH_STATUS(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await motivosPausa.definirStatus(id, await lerStatusMotivoPausa(request)));
      } catch (erro) { return respostaErroMotivosPausa(erro); }
    },
  };
}
