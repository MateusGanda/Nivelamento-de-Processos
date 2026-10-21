import type { AlteracaoOperacao, CadastroOperacao, Operacao } from '../domain/operacao.ts';

export class ErroApiOperacoes extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiOperacoes';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiOperacoes(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiOperacoes(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

function ehOperacao(valor: unknown): valor is Operacao {
  if (!valor || typeof valor !== 'object') return false;
  const dados = valor as Record<string, unknown>;
  return typeof dados.id === 'string' && typeof dados.nome === 'string' &&
    (dados.descricao === null || typeof dados.descricao === 'string') &&
    typeof dados.createdAt === 'string' && Number.isFinite(Date.parse(dados.createdAt)) &&
    typeof dados.updatedAt === 'string' && Number.isFinite(Date.parse(dados.updatedAt));
}

export async function listarOperacoes(signal?: AbortSignal): Promise<Operacao[]> {
  const operacoes = await lerResposta(await fetch('/api/operacoes', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(operacoes) || !operacoes.every(ehOperacao)) throw new ErroApiOperacoes(500, 'Resposta inválida. Tente novamente.');
  return operacoes;
}

export async function cadastrarOperacao(dados: CadastroOperacao): Promise<Operacao> {
  const operacao = await lerResposta(await fetch('/api/operacoes', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: dados.nome, descricao: dados.descricao }),
  }));
  if (!ehOperacao(operacao)) throw new ErroApiOperacoes(500, 'Não foi possível confirmar o cadastro. Verifique a lista antes de tentar novamente.');
  return operacao;
}

export async function alterarOperacao(id: string, dados: AlteracaoOperacao): Promise<Operacao> {
  const operacao = await lerResposta(await fetch(`/api/operacoes/${encodeURIComponent(id)}`, {
    method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: dados.nome, descricao: dados.descricao }),
  }));
  if (!ehOperacao(operacao)) throw new ErroApiOperacoes(500, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
  return operacao;
}
