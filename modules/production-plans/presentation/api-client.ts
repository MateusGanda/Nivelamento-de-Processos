import type { AlteracaoPlano, CadastroPlano, Plano } from '../domain/plano.ts';

export class ErroApiPlanos extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiPlanos';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiPlanos(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiPlanos(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

const textoOuNulo = (valor: unknown) => valor === null || typeof valor === 'string';
const dataOuNula = (valor: unknown) => valor === null || (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor));

function ehPlano(valor: unknown): valor is Plano {
  if (!valor || typeof valor !== 'object') return false;
  const d = valor as Record<string, unknown>;
  return typeof d.id === 'string' && typeof d.codigo === 'string' && textoOuNulo(d.descricao) && dataOuNula(d.dataInicio) && dataOuNula(d.dataFim) &&
    Number.isInteger(d.quantidadeOrdens) &&
    typeof d.createdAt === 'string' && Number.isFinite(Date.parse(d.createdAt)) &&
    typeof d.updatedAt === 'string' && Number.isFinite(Date.parse(d.updatedAt));
}

export async function listarPlanos(signal?: AbortSignal): Promise<Plano[]> {
  const planos = await lerResposta(await fetch('/api/planos-de-producao', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(planos) || !planos.every(ehPlano)) throw new ErroApiPlanos(500, 'Resposta inválida. Tente novamente.');
  return planos;
}

async function enviar(url: string, method: 'POST' | 'PATCH', dados: unknown, falha: string): Promise<Plano> {
  const plano = await lerResposta(await fetch(url, {
    method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }));
  if (!ehPlano(plano)) throw new ErroApiPlanos(500, falha);
  return plano;
}

export const cadastrarPlano = (dados: CadastroPlano) =>
  enviar('/api/planos-de-producao', 'POST', dados, 'Não foi possível confirmar o cadastro. Verifique a lista antes de tentar novamente.');

export const alterarPlano = (id: string, dados: AlteracaoPlano) =>
  enviar(`/api/planos-de-producao/${encodeURIComponent(id)}`, 'PATCH', dados, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
