import type { AlteracaoProduto, CadastroProduto, Produto } from '../domain/produto.ts';

export class ErroApiProdutos extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiProdutos';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiProdutos(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiProdutos(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

function ehProduto(valor: unknown): valor is Produto {
  if (!valor || typeof valor !== 'object') return false;
  const dados = valor as Record<string, unknown>;
  return typeof dados.id === 'string' && typeof dados.codigo === 'string' && typeof dados.nome === 'string' &&
    typeof dados.createdAt === 'string' && Number.isFinite(Date.parse(dados.createdAt)) &&
    typeof dados.updatedAt === 'string' && Number.isFinite(Date.parse(dados.updatedAt));
}

export async function listarProdutos(signal?: AbortSignal): Promise<Produto[]> {
  const produtos = await lerResposta(await fetch('/api/produtos', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(produtos) || !produtos.every(ehProduto)) throw new ErroApiProdutos(500, 'Resposta inválida. Tente novamente.');
  return produtos;
}

export async function cadastrarProduto(dados: CadastroProduto): Promise<Produto> {
  const produto = await lerResposta(await fetch('/api/produtos', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }));
  if (!ehProduto(produto)) throw new ErroApiProdutos(500, 'Não foi possível confirmar o cadastro. Verifique a lista antes de tentar novamente.');
  return produto;
}

export async function alterarProduto(id: string, dados: AlteracaoProduto): Promise<Produto> {
  const produto = await lerResposta(await fetch(`/api/produtos/${encodeURIComponent(id)}`, {
    method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }));
  if (!ehProduto(produto)) throw new ErroApiProdutos(500, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
  return produto;
}
