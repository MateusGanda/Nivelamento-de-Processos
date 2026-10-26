import type { Baixa, Destino, OperadorDaIlha, OrdemDisponivel } from '../domain/execucao.ts';

export class ErroApiIlha extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiIlha';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = resposta.status === 204 ? {} : await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiIlha(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiIlha(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

const objeto = (valor: unknown): valor is Record<string, unknown> => !!valor && typeof valor === 'object' && !Array.isArray(valor);

function ehOperador(valor: unknown): valor is OperadorDaIlha {
  if (!objeto(valor) || typeof valor.id !== 'string' || typeof valor.matricula !== 'string' || typeof valor.nome !== 'string') return false;
  const aberta = valor.execucaoAberta;
  return aberta === null || (objeto(aberta) && typeof aberta.id === 'string' && (aberta.status === 'EM_EXECUCAO' || aberta.status === 'PAUSADA') && Array.isArray(aberta.eventos));
}

const get = (url: string, signal?: AbortSignal) => fetch(url, { cache: 'no-store', credentials: 'same-origin', signal });
const post = (url: string, corpo: unknown) => fetch(url, {
  method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
});

async function operador(resposta: Promise<Response>): Promise<OperadorDaIlha> {
  const dados = await lerResposta(await resposta);
  if (!ehOperador(dados)) throw new ErroApiIlha(500, 'Resposta inválida. Identifique o operador de novo para ver a situação atual.');
  return dados;
}

const rotaExecucao = (id: string, acao: string) => `/api/ilha/execucoes/${encodeURIComponent(id)}/${acao}`;

export const identificarOperador = (matricula: string) => operador(get(`/api/ilha/operadores/${encodeURIComponent(matricula.trim())}`));
export const iniciarExecucao = (matricula: string, destino: Destino) => operador(post('/api/ilha/execucoes', { matricula, ...destino }));
export const pausarExecucao = (matricula: string, id: string, motivoId: string) => operador(post(rotaExecucao(id, 'pausa'), { matricula, motivoId }));
export const retomarExecucao = (matricula: string, id: string) => operador(post(rotaExecucao(id, 'retomada'), { matricula }));
export const trocarOperacao = (matricula: string, id: string, destino: Destino) => operador(post(rotaExecucao(id, 'troca'), { matricula, ...destino }));
export const darBaixa = (matricula: string, id: string, baixa: Baixa) => operador(post(rotaExecucao(id, 'baixa'), { matricula, ...baixa }));

export async function listarOrdensDisponiveis(signal?: AbortSignal): Promise<OrdemDisponivel[]> {
  const ordens = await lerResposta(await get('/api/ilha/ordens', signal));
  if (!Array.isArray(ordens)) throw new ErroApiIlha(500, 'Resposta inválida. Tente novamente.');
  return ordens as OrdemDisponivel[];
}

export async function listarMotivosPausa(signal?: AbortSignal): Promise<{ id: string; nome: string }[]> {
  const motivos = await lerResposta(await get('/api/ilha/motivos', signal));
  if (!Array.isArray(motivos)) throw new ErroApiIlha(500, 'Resposta inválida. Tente novamente.');
  return motivos as { id: string; nome: string }[];
}

export async function liberarTerminal(chave: string): Promise<void> {
  await lerResposta(await post('/api/ilha/acesso', { chave }));
}

export async function bloquearTerminal(): Promise<void> {
  await lerResposta(await fetch('/api/ilha/acesso', { method: 'DELETE', credentials: 'same-origin' }));
}
