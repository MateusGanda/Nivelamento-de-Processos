import type { PainelTv } from '../application/painel-tv.ts';
import type { CadastroDispositivo, Dispositivo, DispositivoListado } from '../domain/dispositivo.ts';

export class ErroApiDispositivos extends Error {
  readonly status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApiDispositivos';
    this.status = status;
  }
}

type Registro = Record<string, unknown>;
const objeto = (valor: unknown): valor is Registro => !!valor && typeof valor === 'object' && !Array.isArray(valor);
const texto = (valor: unknown): valor is string => typeof valor === 'string';
const textoOuNulo = (valor: unknown) => valor === null || texto(valor);
const instante = (valor: unknown) => texto(valor) && Number.isFinite(Date.parse(valor));
const numero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isFinite(valor);

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = resposta.status === 204 ? {} : await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = objeto(corpo) && objeto(corpo.erro) ? corpo.erro : null;
    throw new ErroApiDispositivos(resposta.status, erro && texto(erro.mensagem) ? erro.mensagem : 'Não foi possível concluir a solicitação. Tente novamente.');
  }
  if (corpo === null) throw new ErroApiDispositivos(500, 'Resposta inválida. Tente novamente.');
  return corpo;
}

function ehDispositivo(valor: unknown): valor is Dispositivo {
  return objeto(valor) && texto(valor.id) && texto(valor.nome) && textoOuNulo(valor.local) && typeof valor.ativo === 'boolean' &&
    (valor.setor === null || (objeto(valor.setor) && texto(valor.setor.id) && texto(valor.setor.nome))) &&
    (valor.ultimaConexaoEm === null || instante(valor.ultimaConexaoEm)) && instante(valor.createdAt) && instante(valor.updatedAt);
}

const ehListado = (valor: unknown): valor is DispositivoListado =>
  ehDispositivo(valor) && ['ONLINE', 'OFFLINE', 'NUNCA_CONECTOU'].includes((valor as Registro).conexao as string);

function comCodigo(valor: unknown): { dispositivo: Dispositivo; codigo: string } {
  if (!objeto(valor) || !ehDispositivo(valor.dispositivo) || !texto(valor.codigo)) {
    throw new ErroApiDispositivos(500, 'Não foi possível confirmar a operação. Verifique a lista antes de tentar novamente.');
  }
  return { dispositivo: valor.dispositivo, codigo: valor.codigo };
}

const json = (method: string, dados?: unknown): RequestInit => ({
  method, credentials: 'same-origin', ...(dados === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }),
});

// ---------- painel do administrador ----------
export async function listarDispositivos(signal?: AbortSignal): Promise<DispositivoListado[]> {
  const lista = await lerResposta(await fetch('/api/dispositivos', { cache: 'no-store', credentials: 'same-origin', signal }));
  if (!Array.isArray(lista) || !lista.every(ehListado)) throw new ErroApiDispositivos(500, 'Resposta inválida. Tente novamente.');
  return lista;
}

export async function cadastrarDispositivo(dados: CadastroDispositivo) {
  return comCodigo(await lerResposta(await fetch('/api/dispositivos', json('POST', dados))));
}

export async function alterarDispositivo(id: string, dados: CadastroDispositivo): Promise<Dispositivo> {
  const alterado = await lerResposta(await fetch(`/api/dispositivos/${encodeURIComponent(id)}`, json('PATCH', dados)));
  if (!ehDispositivo(alterado)) throw new ErroApiDispositivos(500, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
  return alterado;
}

export async function definirStatusDispositivo(id: string, ativo: boolean): Promise<Dispositivo> {
  const alterado = await lerResposta(await fetch(`/api/dispositivos/${encodeURIComponent(id)}/status`, json('PATCH', { ativo })));
  if (!ehDispositivo(alterado)) throw new ErroApiDispositivos(500, 'Não foi possível confirmar a alteração. Verifique a lista antes de tentar novamente.');
  return alterado;
}

export async function gerarNovoCodigoDispositivo(id: string) {
  return comCodigo(await lerResposta(await fetch(`/api/dispositivos/${encodeURIComponent(id)}/codigo`, json('POST'))));
}

// ---------- a TV ----------
export async function liberarTv(codigo: string): Promise<void> {
  await lerResposta(await fetch('/api/tv/acesso', json('POST', { codigo })));
}

const ehEvento = (e: unknown) => objeto(e) && texto(e.tipo) && ['INICIO', 'PAUSA', 'RETOMADA', 'FINALIZACAO'].includes(e.tipo) && instante(e.dataHora) && textoOuNulo(e.motivo);
const ehExecucaoTv = (e: unknown) => objeto(e) && texto(e.id) && (e.status === 'EM_EXECUCAO' || e.status === 'PAUSADA') &&
  objeto(e.ordem) && texto(e.ordem.numero) && numero(e.ordem.quantidade) && texto(e.ordem.unidade) &&
  objeto(e.produto) && texto(e.produto.codigo) && texto(e.produto.nome) && objeto(e.etapa) && Number.isInteger(e.etapa.ordem) && texto(e.etapa.operacao) &&
  (e.tempoPadraoSegundos === null || numero(e.tempoPadraoSegundos)) && Array.isArray(e.eventos) && e.eventos.length > 0 && e.eventos.every(ehEvento);

/** Confere o formato antes de mostrar; resposta malformada vira erro e a TV mantém os dados anteriores. */
export function lerPainelTv(corpo: unknown): PainelTv {
  const valido = objeto(corpo) && objeto(corpo.meta) && instante(corpo.meta.consultadoEm) && numero(corpo.meta.intervaloSegundos) &&
    objeto(corpo.dispositivo) && texto(corpo.dispositivo.nome) && textoOuNulo(corpo.dispositivo.local) && textoOuNulo(corpo.dispositivo.setor) &&
    Array.isArray(corpo.postos) && corpo.postos.every((p: unknown) => objeto(p) && texto(p.codigo) && texto(p.nome) && texto(p.setor) &&
      ['LIVRE', 'EM_EXECUCAO', 'PAUSADA'].includes(p.situacao as string) && Array.isArray(p.execucoes) && p.execucoes.every(ehExecucaoTv)) &&
    objeto(corpo.producaoHoje) && numero(corpo.producaoHoje.baixas) && Array.isArray(corpo.producaoHoje.pecasBoas) &&
    corpo.producaoHoje.pecasBoas.every((p: unknown) => objeto(p) && texto(p.produtoCodigo) && texto(p.unidade) && numero(p.quantidadeBoa)) &&
    Array.isArray(corpo.cargaPorPosto) && corpo.cargaPorPosto.every((c: unknown) => objeto(c) && texto(c.codigo) && texto(c.nome) && numero(c.segundos) && (c.percentual === null || numero(c.percentual)));
  if (!valido) throw new ErroApiDispositivos(500, 'Resposta inválida.');
  return corpo as PainelTv;
}

export async function buscarPainelTv(signal?: AbortSignal): Promise<PainelTv> {
  return lerPainelTv(await lerResposta(await fetch('/api/tv/painel', { cache: 'no-store', credentials: 'same-origin', signal })));
}
