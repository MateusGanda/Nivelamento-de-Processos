import type { AlteracaoOrdem, CadastroOrdem, Ordem } from '../domain/ordem.ts';

export class ErroApiOrdens extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiOrdens';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiOrdens(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiOrdens(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

const objeto = (valor: unknown): valor is Record<string, unknown> => !!valor && typeof valor === 'object';
const texto = (valor: unknown) => typeof valor === 'string';

function ehOrdem(valor: unknown): valor is Ordem {
  if (!objeto(valor)) return false;
  const { plano, produto, roteiro } = valor;
  return texto(valor.id) && texto(valor.numero) && typeof valor.quantidade === 'number' && texto(valor.unidade) &&
    objeto(plano) && texto(plano.id) && texto(plano.codigo) &&
    objeto(produto) && texto(produto.id) && texto(produto.codigo) && texto(produto.nome) &&
    objeto(roteiro) && texto(roteiro.id) && texto(roteiro.nome) && Number.isInteger(roteiro.versao) &&
    Number.isInteger(valor.quantidadeExecucoes) &&
    texto(valor.createdAt) && Number.isFinite(Date.parse(valor.createdAt as string)) &&
    texto(valor.updatedAt) && Number.isFinite(Date.parse(valor.updatedAt as string));
}

export async function listarOrdens(signal?: AbortSignal): Promise<Ordem[]> {
  const ordens = await lerResposta(await fetch('/api/ordens-de-producao', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(ordens) || !ordens.every(ehOrdem)) throw new ErroApiOrdens(500, 'Resposta inválida. Tente novamente.');
  return ordens;
}

async function enviar(url: string, method: 'POST' | 'PATCH', dados: unknown, falha: string): Promise<Ordem> {
  const ordem = await lerResposta(await fetch(url, {
    method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }));
  if (!ehOrdem(ordem)) throw new ErroApiOrdens(500, falha);
  return ordem;
}

export const cadastrarOrdem = (dados: CadastroOrdem) =>
  enviar('/api/ordens-de-producao', 'POST', dados, 'Não foi possível confirmar o cadastro. Verifique a lista antes de tentar novamente.');

export const alterarOrdem = (id: string, dados: AlteracaoOrdem) =>
  enviar(`/api/ordens-de-producao/${encodeURIComponent(id)}`, 'PATCH', dados, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
