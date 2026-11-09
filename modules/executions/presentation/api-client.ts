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

function ehPosto(valor: unknown): boolean {
  return objeto(valor) && typeof valor.id === 'string' && typeof valor.codigo === 'string' && typeof valor.nome === 'string';
}

function ehEtapa(valor: unknown): boolean {
  return objeto(valor) && typeof valor.id === 'string' && typeof valor.ordem === 'number' && Number.isFinite(valor.ordem) &&
    typeof valor.operacao === 'string' && typeof valor.baixada === 'boolean' && Array.isArray(valor.postos) && valor.postos.every(ehPosto);
}

function ehOrdem(valor: unknown): valor is OrdemDisponivel {
  return objeto(valor) && typeof valor.id === 'string' && typeof valor.numero === 'string' &&
    typeof valor.quantidade === 'number' && Number.isFinite(valor.quantidade) && typeof valor.unidade === 'string' &&
    typeof valor.plano === 'string' && objeto(valor.produto) && typeof valor.produto.codigo === 'string' &&
    typeof valor.produto.nome === 'string' && Array.isArray(valor.etapas) && valor.etapas.every(ehEtapa);
}

function ehMotivo(valor: unknown): valor is { id: string; nome: string } {
  return objeto(valor) && typeof valor.id === 'string' && typeof valor.nome === 'string';
}

function ehOperador(valor: unknown): valor is OperadorDaIlha {
  if (!objeto(valor) || typeof valor.id !== 'string' || typeof valor.matricula !== 'string' || typeof valor.nome !== 'string' ||
    (valor.setor !== null && typeof valor.setor !== 'string')) return false;
  const aberta = valor.execucaoAberta;
  if (aberta === null) return true;
  return objeto(aberta) && typeof aberta.id === 'string' && (aberta.status === 'EM_EXECUCAO' || aberta.status === 'PAUSADA') &&
    objeto(aberta.ordem) && typeof aberta.ordem.id === 'string' && typeof aberta.ordem.numero === 'string' &&
    typeof aberta.ordem.quantidade === 'number' && Number.isFinite(aberta.ordem.quantidade) && typeof aberta.ordem.unidade === 'string' &&
    objeto(aberta.produto) && typeof aberta.produto.codigo === 'string' && typeof aberta.produto.nome === 'string' &&
    objeto(aberta.etapa) && typeof aberta.etapa.id === 'string' && typeof aberta.etapa.ordem === 'number' &&
    Number.isFinite(aberta.etapa.ordem) && typeof aberta.etapa.operacao === 'string' && ehPosto(aberta.posto) &&
    Array.isArray(aberta.eventos) && aberta.eventos.every((evento: unknown) => objeto(evento) &&
      typeof evento.tipo === 'string' && ['INICIO', 'PAUSA', 'RETOMADA', 'FINALIZACAO'].includes(evento.tipo) &&
      typeof evento.dataHora === 'string' && Number.isFinite(Date.parse(evento.dataHora)) &&
      (evento.motivo === null || typeof evento.motivo === 'string'));
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

export const identificarOperador = (matricula: string, signal?: AbortSignal) => operador(get(`/api/ilha/operadores/${encodeURIComponent(matricula.trim())}`, signal));
export const iniciarExecucao = (matricula: string, destino: Destino) => operador(post('/api/ilha/execucoes', { matricula, ...destino }));
export const pausarExecucao = (matricula: string, id: string, motivoId: string) => operador(post(rotaExecucao(id, 'pausa'), { matricula, motivoId }));
export const retomarExecucao = (matricula: string, id: string) => operador(post(rotaExecucao(id, 'retomada'), { matricula }));
export const trocarOperacao = (matricula: string, id: string, destino: Destino) => operador(post(rotaExecucao(id, 'troca'), { matricula, ...destino }));
export const darBaixa = (matricula: string, id: string, baixa: Baixa) => operador(post(rotaExecucao(id, 'baixa'), { matricula, ...baixa }));

export async function listarOrdensDisponiveis(signal?: AbortSignal): Promise<OrdemDisponivel[]> {
  const ordens = await lerResposta(await get('/api/ilha/ordens', signal));
  if (!Array.isArray(ordens) || !ordens.every(ehOrdem)) throw new ErroApiIlha(500, 'Resposta inválida ao carregar as ordens. Tente novamente.');
  return ordens;
}

export async function listarMotivosPausa(signal?: AbortSignal): Promise<{ id: string; nome: string }[]> {
  const motivos = await lerResposta(await get('/api/ilha/motivos', signal));
  if (!Array.isArray(motivos) || !motivos.every(ehMotivo)) throw new ErroApiIlha(500, 'Resposta inválida ao carregar os motivos. Tente novamente.');
  return motivos;
}

export async function liberarTerminal(chave: string): Promise<void> {
  await lerResposta(await post('/api/ilha/acesso', { chave }));
}

export async function bloquearTerminal(): Promise<void> {
  await lerResposta(await fetch('/api/ilha/acesso', { method: 'DELETE', credentials: 'same-origin' }));
}

// ---------- chave da ilha, no painel do administrador ----------
export type SituacaoChaveIlha = { origem: 'PAINEL' | 'AMBIENTE' | 'NENHUMA'; trocadaEm: string | null; trocadaPor: string | null };

function ehSituacaoChave(valor: unknown): valor is SituacaoChaveIlha {
  return objeto(valor) && typeof valor.origem === 'string' && ['PAINEL', 'AMBIENTE', 'NENHUMA'].includes(valor.origem) &&
    (valor.trocadaEm === null || (typeof valor.trocadaEm === 'string' && Number.isFinite(Date.parse(valor.trocadaEm)))) &&
    (valor.trocadaPor === null || typeof valor.trocadaPor === 'string');
}

export async function consultarChaveIlha(signal?: AbortSignal): Promise<SituacaoChaveIlha> {
  const situacao = await lerResposta(await get('/api/execucoes/chave-ilha', signal));
  if (!ehSituacaoChave(situacao)) throw new ErroApiIlha(500, 'Resposta inválida ao consultar a chave. Tente novamente.');
  return situacao;
}

export async function gerarChaveIlha(): Promise<{ chave: string; situacao: SituacaoChaveIlha }> {
  const corpo = await lerResposta(await post('/api/execucoes/chave-ilha', {}));
  if (!objeto(corpo) || typeof corpo.chave !== 'string' || !ehSituacaoChave(corpo.situacao)) throw new ErroApiIlha(500, 'Resposta inválida ao gerar a chave. Tente novamente.');
  return { chave: corpo.chave, situacao: corpo.situacao };
}
