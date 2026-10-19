import type { EtapaInformada, RoteiroDetalhe, RoteiroResumo } from '../domain/roteiro.ts';

export class ErroApiRoteiros extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiRoteiros';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiRoteiros(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiRoteiros(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

const texto = (valor: unknown) => typeof valor === 'string';
const data = (valor: unknown) => typeof valor === 'string' && Number.isFinite(Date.parse(valor));

function ehResumo(valor: unknown): valor is RoteiroResumo {
  if (!valor || typeof valor !== 'object') return false;
  const d = valor as Record<string, unknown>;
  return texto(d.id) && texto(d.nome) && Number.isInteger(d.versao) && typeof d.ativo === 'boolean' &&
    Number.isInteger(d.quantidadeEtapas) && Number.isInteger(d.quantidadeOrdens) && data(d.createdAt) && data(d.updatedAt);
}

function ehDetalhe(valor: unknown): valor is RoteiroDetalhe {
  if (!ehResumo(valor)) return false;
  const d = valor as unknown as Record<string, unknown>;
  return typeof d.travado === 'boolean' && Array.isArray(d.versoes) && Array.isArray(d.etapas) && d.etapas.every((etapa: unknown) => {
    const e = etapa as Record<string, unknown> | null;
    const operacao = e?.operacao as Record<string, unknown> | null | undefined;
    return !!e && texto(e.id) && Number.isInteger(e.ordem) && !!operacao && texto(operacao.id) && texto(operacao.nome) && Array.isArray(e.postos);
  });
}

async function enviar(url: string, method: 'POST' | 'PUT' | 'PATCH', corpo?: unknown): Promise<RoteiroDetalhe> {
  const roteiro = await lerResposta(await fetch(url, {
    method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }));
  if (!ehDetalhe(roteiro)) throw new ErroApiRoteiros(500, 'Não foi possível confirmar a gravação. Atualize a página antes de tentar novamente.');
  return roteiro;
}

const rota = (id: string) => `/api/roteiros/${encodeURIComponent(id)}`;

export async function listarRoteiros(signal?: AbortSignal): Promise<RoteiroResumo[]> {
  const roteiros = await lerResposta(await fetch('/api/roteiros', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(roteiros) || !roteiros.every(ehResumo)) throw new ErroApiRoteiros(500, 'Resposta inválida. Tente novamente.');
  return roteiros;
}

export async function buscarRoteiro(id: string, signal?: AbortSignal): Promise<RoteiroDetalhe> {
  const roteiro = await lerResposta(await fetch(rota(id), { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!ehDetalhe(roteiro)) throw new ErroApiRoteiros(500, 'Resposta inválida. Tente novamente.');
  return roteiro;
}

export const cadastrarRoteiro = (nome: string) => enviar('/api/roteiros', 'POST', { nome });
export const definirStatusRoteiro = (id: string, ativo: boolean) => enviar(`${rota(id)}/status`, 'PATCH', { ativo });
export const salvarEtapasRoteiro = (id: string, etapas: EtapaInformada[]) => enviar(`${rota(id)}/etapas`, 'PUT', { etapas });
export const definirPostosEtapa = (id: string, etapaId: string, postoIds: string[]) =>
  enviar(`${rota(id)}/etapas/${encodeURIComponent(etapaId)}/postos`, 'PUT', { postoIds });
export const criarVersaoRoteiro = (id: string) => enviar(`${rota(id)}/versoes`, 'POST');
