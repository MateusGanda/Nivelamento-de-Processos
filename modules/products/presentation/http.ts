import type { ProdutosService } from '../application/produtos.ts';
import { ErroDeProduto, type AlteracaoProduto, type CadastroProduto } from '../domain/produto.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;

export function respostaErroProdutos(erro: unknown): Response {
  if (erro instanceof ErroDeProduto || erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo] });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

const CAMPOS = new Set(['codigo', 'nome']);

async function lerCorpo(request: Request): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeProduto('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDeProduto('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => !CAMPOS.has(campo))) {
    throw new ErroDeProduto('ENTRADA_INVALIDA', 'Informe somente código e nome.');
  }
  return dados;
}

export async function lerCadastroProduto(request: Request): Promise<CadastroProduto> {
  const dados = await lerCorpo(request);
  if (typeof dados.codigo !== 'string' || typeof dados.nome !== 'string') {
    throw new ErroDeProduto('ENTRADA_INVALIDA', 'Código e nome devem ser textos obrigatórios.');
  }
  return { codigo: dados.codigo, nome: dados.nome };
}

export async function lerAlteracaoProduto(request: Request): Promise<AlteracaoProduto> {
  const dados = await lerCorpo(request);
  const alteracao: AlteracaoProduto = {};
  for (const campo of ['codigo', 'nome'] as const) {
    if (dados[campo] === undefined) continue;
    if (typeof dados[campo] !== 'string') throw new ErroDeProduto('ENTRADA_INVALIDA', 'Código e nome devem ser textos.');
    alteracao[campo] = dados[campo];
  }
  return alteracao;
}

export async function lerStatusProduto(request: Request): Promise<boolean> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeProduto('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo) || Object.keys(corpo).some((campo) => campo !== 'ativo')) {
    throw new ErroDeProduto('ENTRADA_INVALIDA', 'Informe somente o campo ativo.');
  }
  const { ativo } = corpo as { ativo?: unknown };
  if (typeof ativo !== 'boolean') throw new ErroDeProduto('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
  return ativo;
}

type Dependencias = { autorizar: () => Promise<unknown>; produtos: Pick<ProdutosService, 'listar' | 'criar' | 'alterar' | 'definirStatus'> };

// A rota fornece a autorização real; testes substituem dependências sem usar o banco.
export function criarHandlersProdutos({ autorizar, produtos }: Dependencias) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await produtos.listar(), { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroProdutos(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await produtos.criar(await lerCadastroProduto(request)), { status: 201 });
      } catch (erro) { return respostaErroProdutos(erro); }
    },
    async PATCH(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await produtos.alterar(id, await lerAlteracaoProduto(request)));
      } catch (erro) { return respostaErroProdutos(erro); }
    },
    async PATCH_STATUS(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await produtos.definirStatus(id, await lerStatusProduto(request)));
      } catch (erro) { return respostaErroProdutos(erro); }
    },
  };
}
