import type { AlteracaoOperador, CadastroOperador, Operador } from '../domain/operador.ts';

export class ErroApiOperadores extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiOperadores';
    this.status = status;
  }
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo && typeof corpo === 'object' && 'erro' in corpo ? corpo.erro : null;
    const mensagem = erro && typeof erro === 'object' && 'mensagem' in erro && typeof erro.mensagem === 'string' ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.';
    throw new ErroApiOperadores(resposta.status, mensagem);
  }
  if (corpo === null) throw new ErroApiOperadores(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

function ehOperador(valor: unknown): valor is Operador {
  if (!valor || typeof valor !== 'object') return false;
  const dados = valor as Record<string, unknown>;
  const setor = dados.setorPrincipal as Record<string, unknown> | null | undefined;
  if (!(setor === null || (setor && typeof setor.id === 'string' && typeof setor.codigo === 'string' && typeof setor.nome === 'string'))) return false;
  if (!(dados.funcao === null || typeof dados.funcao === 'string')) return false;
  return typeof dados.id === 'string' && typeof dados.nome === 'string' && typeof dados.matricula === 'string' &&
    typeof dados.ativo === 'boolean' && typeof dados.createdAt === 'string' && Number.isFinite(Date.parse(dados.createdAt)) &&
    typeof dados.updatedAt === 'string' && Number.isFinite(Date.parse(dados.updatedAt));
}

export async function listarOperadores(signal?: AbortSignal): Promise<Operador[]> {
  const operadores = await lerResposta(await fetch('/api/operadores', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(operadores) || !operadores.every(ehOperador)) throw new ErroApiOperadores(500, 'Resposta inválida. Tente novamente.');
  return operadores;
}

export async function cadastrarOperador(dados: CadastroOperador): Promise<Operador> {
  const operador = await lerResposta(await fetch('/api/operadores', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }));
  if (!ehOperador(operador)) throw new ErroApiOperadores(500, 'Não foi possível confirmar o cadastro. Verifique a lista antes de tentar novamente.');
  return operador;
}

export async function alterarOperador(id: string, dados: AlteracaoOperador): Promise<Operador> {
  const operador = await lerResposta(await fetch(`/api/operadores/${encodeURIComponent(id)}`, {
    method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }));
  if (!ehOperador(operador)) throw new ErroApiOperadores(500, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
  return operador;
}

export async function definirStatusOperador(id: string, ativo: boolean): Promise<Operador> {
  const operador = await lerResposta(await fetch(`/api/operadores/${encodeURIComponent(id)}/status`, {
    method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo }),
  }));
  if (!ehOperador(operador)) throw new ErroApiOperadores(500, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
  return operador;
}
