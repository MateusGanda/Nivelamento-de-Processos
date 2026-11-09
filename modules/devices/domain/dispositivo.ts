import { excedeLimite, LIMITES_TEXTO } from '../../../shared/validation.ts';

// Dispositivo conectado do chão de fábrica: hoje, as TVs do painel de gestão à vista (decisão de 09/11/2026).
// A TV só exibe dados; o código de acesso é guardado apenas como hash.

/**
 * A TV busca os dados e informa a conexão neste intervalo (decisão de 09/11/2026: era 15 s).
 * O relógio e os cronômetros da tela andam a cada segundo sozinhos; a busca só traz as mudanças.
 */
export const INTERVALO_ATUALIZACAO_MS = 5_000;
/**
 * Sem sinal por mais que isto, a TV aparece como offline. Com a gravação a cada 10 s no máximo,
 * a última conexão de uma TV ligada tem até uns 15 s; os 20 s deixam folga para um pedido lento.
 */
export const LIMITE_ONLINE_MS = 20_000;
/** A última conexão é gravada no máximo uma vez neste intervalo, para não escrever no banco a cada pedido. */
export const INTERVALO_MINIMO_REGISTRO_MS = 10_000;

export type SituacaoConexao = 'ONLINE' | 'OFFLINE' | 'NUNCA_CONECTOU';

export type Dispositivo = {
  id: string;
  nome: string;
  local: string | null;
  setor: { id: string; nome: string } | null;
  ativo: boolean;
  ultimaConexaoEm: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DispositivoListado = Dispositivo & { conexao: SituacaoConexao };

export type CadastroDispositivo = { nome: string; local?: string | null; setorId?: string | null };
export type DadosDispositivo = { nome: string; local: string | null; setorId: string | null };
export type AlteracaoDispositivo = Partial<DadosDispositivo>;

export class ErroDeDispositivo extends Error {
  readonly codigo: 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO' | 'NAO_AUTENTICADO';

  constructor(codigo: ErroDeDispositivo['codigo'], mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeDispositivo';
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehIdentificadorValido = (id: string): boolean => UUID.test(id);

function validarNome(nome: unknown): string {
  if (typeof nome !== 'string' || !nome.trim()) throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  if (excedeLimite(nome.trim(), LIMITES_TEXTO.nome)) throw new ErroDeDispositivo('ENTRADA_INVALIDA', `Nome deve ter no máximo ${LIMITES_TEXTO.nome} caracteres.`);
  return nome.trim();
}

function validarLocal(local: unknown): string | null {
  if (local === undefined || local === null) return null;
  if (typeof local !== 'string') throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'Local deve ser texto ou nulo.');
  if (excedeLimite(local.trim(), LIMITES_TEXTO.nome)) throw new ErroDeDispositivo('ENTRADA_INVALIDA', `Local deve ter no máximo ${LIMITES_TEXTO.nome} caracteres.`);
  return local.trim() || null;
}

// Sem setor, a TV mostra todos os setores.
function validarSetor(setorId: unknown): string | null {
  if (setorId === undefined || setorId === null || setorId === '') return null;
  if (typeof setorId !== 'string' || !ehIdentificadorValido(setorId)) throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'Setor inválido.');
  return setorId;
}

export function validarCadastroDispositivo(input: CadastroDispositivo): DadosDispositivo {
  return { nome: validarNome(input.nome), local: validarLocal(input.local), setorId: validarSetor(input.setorId) };
}

export function validarAlteracaoDispositivo(input: AlteracaoDispositivo): AlteracaoDispositivo {
  const dados: AlteracaoDispositivo = {};
  if (input.nome !== undefined) dados.nome = validarNome(input.nome);
  if (input.local !== undefined) dados.local = validarLocal(input.local);
  if (input.setorId !== undefined) dados.setorId = validarSetor(input.setorId);
  if (Object.keys(dados).length === 0) throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'Informe o nome, o local ou o setor para alterar.');
  return dados;
}

// ---------- código de acesso ----------
// 10 caracteres de um alfabeto sem letras e números parecidos (sem I, O, 0 e 1): cerca de 50 bits.
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TAMANHO_CODIGO = 10;

/** Monta o código a partir de bytes aleatórios e o exibe em dois blocos, como "ABCDE-FGH23". */
export function formatarCodigo(bytes: Uint8Array): string {
  if (bytes.length < TAMANHO_CODIGO) throw new Error('Bytes insuficientes para o código.');
  const letras = Array.from(bytes.slice(0, TAMANHO_CODIGO), (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
  return `${letras.slice(0, 5)}-${letras.slice(5)}`;
}

/** Aceita o código com ou sem hífen, espaços e letras minúsculas; devolve null se não tiver o formato. */
export function normalizarCodigo(informado: unknown): string | null {
  if (typeof informado !== 'string') return null;
  const limpo = informado.toUpperCase().replace(/[\s-]/g, '');
  if (limpo.length !== TAMANHO_CODIGO || [...limpo].some((c) => !ALFABETO_CODIGO.includes(c))) return null;
  return limpo;
}

// ---------- conexão ----------
export function situacaoConexao(ultimaConexaoEm: string | null, agoraMs: number): SituacaoConexao {
  if (!ultimaConexaoEm) return 'NUNCA_CONECTOU';
  return agoraMs - Date.parse(ultimaConexaoEm) <= LIMITE_ONLINE_MS ? 'ONLINE' : 'OFFLINE';
}
