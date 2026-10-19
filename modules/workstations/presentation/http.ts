import type { PostosService } from '../application/postos.ts';
import { ErroDePosto, type AlteracaoPosto, type CadastroPosto } from '../domain/posto.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

export function respostaErroPostos(erro: unknown): Response {
  if (erro instanceof ErroDePosto || erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo] });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

async function lerCorpo(request: Request, campos: ReadonlySet<string>, mensagemCampos: string): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDePosto('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDePosto('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => !campos.has(campo))) throw new ErroDePosto('ENTRADA_INVALIDA', mensagemCampos);
  return dados;
}

const CAMPOS = new Set(['codigo', 'nome', 'setorId']);

export async function lerCadastroPosto(request: Request): Promise<CadastroPosto> {
  const dados = await lerCorpo(request, CAMPOS, 'Informe somente código, nome e setor.');
  if (typeof dados.codigo !== 'string' || typeof dados.nome !== 'string' || typeof dados.setorId !== 'string') {
    throw new ErroDePosto('ENTRADA_INVALIDA', 'Código, nome e setor devem ser textos obrigatórios.');
  }
  return { codigo: dados.codigo, nome: dados.nome, setorId: dados.setorId };
}

export async function lerAlteracaoPosto(request: Request): Promise<AlteracaoPosto> {
  const dados = await lerCorpo(request, CAMPOS, 'Informe somente código, nome e setor.');
  const alteracao: AlteracaoPosto = {};
  for (const campo of ['codigo', 'nome', 'setorId'] as const) {
    if (dados[campo] === undefined) continue;
    if (typeof dados[campo] !== 'string') throw new ErroDePosto('ENTRADA_INVALIDA', 'Código, nome e setor devem ser textos.');
    alteracao[campo] = dados[campo];
  }
  return alteracao;
}

export async function lerStatusPosto(request: Request): Promise<boolean> {
  const dados = await lerCorpo(request, new Set(['ativo']), 'Informe somente o campo ativo.');
  if (typeof dados.ativo !== 'boolean') throw new ErroDePosto('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
  return dados.ativo;
}

type Dependencias = {
  autorizar: () => Promise<unknown>;
  postos: Pick<PostosService, 'listar' | 'criar' | 'alterar' | 'definirStatus'>;
};

// A rota fornece a autorização real; testes substituem dependências sem usar o banco.
export function criarHandlersPostos({ autorizar, postos }: Dependencias) {
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
    async PATCH(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await postos.alterar(id, await lerAlteracaoPosto(request)));
      } catch (erro) { return respostaErroPostos(erro); }
    },
    async PATCH_STATUS(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await postos.definirStatus(id, await lerStatusPosto(request)));
      } catch (erro) { return respostaErroPostos(erro); }
    },
  };
}
