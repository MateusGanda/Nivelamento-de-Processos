import type { CadastroSetor, Setor } from '../domain/setor.ts';

export class ErroApiSetores extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiSetores';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiSetores(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiSetores(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

function ehSetor(valor: unknown): valor is Setor {
  if (!valor || typeof valor !== 'object') return false;
  const dados = valor as Record<string, unknown>;
  return typeof dados.id === 'string' && typeof dados.nome === 'string' &&
    (dados.descricao === null || typeof dados.descricao === 'string') &&
    typeof dados.createdAt === 'string' && Number.isFinite(Date.parse(dados.createdAt)) &&
    typeof dados.updatedAt === 'string' && Number.isFinite(Date.parse(dados.updatedAt));
}

export async function listarSetores(signal?: AbortSignal): Promise<Setor[]> {
  const setores = await lerResposta(await fetch('/api/setores', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(setores) || !setores.every(ehSetor)) throw new ErroApiSetores(500, 'Resposta inválida. Tente novamente.');
  return setores;
}

export async function cadastrarSetor(dados: CadastroSetor): Promise<Setor> {
  const setor = await lerResposta(await fetch('/api/setores', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: dados.nome, descricao: dados.descricao }),
  }));
  if (!ehSetor(setor)) throw new ErroApiSetores(500, 'Não foi possível confirmar o cadastro. Verifique a lista antes de tentar novamente.');
  return setor;
}
