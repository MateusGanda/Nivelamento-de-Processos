import type { AlteracaoMotivoPausa, CadastroMotivoPausa, MotivoPausa } from '../domain/motivoPausa.ts';

export class ErroApiMotivosPausa extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiMotivosPausa';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiMotivosPausa(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiMotivosPausa(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

function ehMotivoPausa(valor: unknown): valor is MotivoPausa {
  if (!valor || typeof valor !== 'object') return false;
  const dados = valor as Record<string, unknown>;
  return typeof dados.id === 'string' && typeof dados.nome === 'string' && typeof dados.ativo === 'boolean' &&
    (dados.descricao === null || typeof dados.descricao === 'string') &&
    typeof dados.createdAt === 'string' && Number.isFinite(Date.parse(dados.createdAt)) &&
    typeof dados.updatedAt === 'string' && Number.isFinite(Date.parse(dados.updatedAt));
}

export async function listarMotivosPausa(signal?: AbortSignal): Promise<MotivoPausa[]> {
  const motivosPausa = await lerResposta(await fetch('/api/motivos-de-pausa', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(motivosPausa) || !motivosPausa.every(ehMotivoPausa)) throw new ErroApiMotivosPausa(500, 'Resposta inválida. Tente novamente.');
  return motivosPausa;
}

export async function cadastrarMotivoPausa(dados: CadastroMotivoPausa): Promise<MotivoPausa> {
  const motivoPausa = await lerResposta(await fetch('/api/motivos-de-pausa', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: dados.nome, descricao: dados.descricao }),
  }));
  if (!ehMotivoPausa(motivoPausa)) throw new ErroApiMotivosPausa(500, 'Não foi possível confirmar o cadastro. Verifique a lista antes de tentar novamente.');
  return motivoPausa;
}

export async function alterarMotivoPausa(id: string, dados: AlteracaoMotivoPausa): Promise<MotivoPausa> {
  const motivoPausa = await lerResposta(await fetch(`/api/motivos-de-pausa/${encodeURIComponent(id)}`, {
    method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: dados.nome, descricao: dados.descricao }),
  }));
  if (!ehMotivoPausa(motivoPausa)) throw new ErroApiMotivosPausa(500, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
  return motivoPausa;
}

export async function definirStatusMotivoPausa(id: string, ativo: boolean): Promise<MotivoPausa> {
  const motivoPausa = await lerResposta(await fetch(`/api/motivos-de-pausa/${encodeURIComponent(id)}/status`, {
    method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo }),
  }));
  if (!ehMotivoPausa(motivoPausa)) throw new ErroApiMotivosPausa(500, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
  return motivoPausa;
}
