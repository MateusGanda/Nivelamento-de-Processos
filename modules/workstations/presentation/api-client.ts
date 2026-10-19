import type { CadastroPosto, Posto } from '../domain/posto.ts';

export class ErroApiPostos extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiPostos';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiPostos(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiPostos(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

function ehPosto(valor: unknown): valor is Posto {
  if (!valor || typeof valor !== 'object') return false;
  const dados = valor as Record<string, unknown>;
  const setor = dados.setor as Record<string, unknown> | null;
  return typeof dados.id === 'string' && typeof dados.codigo === 'string' && typeof dados.nome === 'string' &&
    typeof dados.ativo === 'boolean' && !!setor && typeof setor === 'object' && typeof setor.id === 'string' && typeof setor.nome === 'string' &&
    typeof dados.createdAt === 'string' && Number.isFinite(Date.parse(dados.createdAt)) &&
    typeof dados.updatedAt === 'string' && Number.isFinite(Date.parse(dados.updatedAt));
}

export async function listarPostos(signal?: AbortSignal): Promise<Posto[]> {
  const postos = await lerResposta(await fetch('/api/postos', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(postos) || !postos.every(ehPosto)) throw new ErroApiPostos(500, 'Resposta inválida. Tente novamente.');
  return postos;
}

export async function cadastrarPosto(dados: CadastroPosto): Promise<Posto> {
  const posto = await lerResposta(await fetch('/api/postos', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }));
  if (!ehPosto(posto)) throw new ErroApiPostos(500, 'Não foi possível confirmar o cadastro. Verifique a lista antes de tentar novamente.');
  return posto;
}
