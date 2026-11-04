import { excedeLimite, LIMITES_TEXTO } from '../../../shared/validation.ts';

export type Setor = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CadastroSetor = { nome: string; descricao?: string | null };
export type DadosSetor = { nome: string; descricao: string | null };
export type NovoSetor = DadosSetor & { codigo: string };
// O código é permanente: a edição só muda nome e descrição.
export type AlteracaoSetor = Partial<DadosSetor>;

export type CodigoErroSetor = 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

export class ErroDeSetor extends Error {
  readonly codigo: CodigoErroSetor;

  constructor(codigo: CodigoErroSetor, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeSetor';
    this.codigo = codigo;
  }
}

export class ErroCodigoSetorReservado extends ErroDeSetor {
  constructor() { super('CONFLITO', 'Não foi possível reservar o código do setor. Tente novamente.'); }
}

function validarNome(nome: unknown): string {
  if (typeof nome !== 'string' || !nome.trim()) throw new ErroDeSetor('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  if (excedeLimite(nome.trim(), LIMITES_TEXTO.nome)) throw new ErroDeSetor('ENTRADA_INVALIDA', `Nome deve ter no máximo ${LIMITES_TEXTO.nome} caracteres.`);
  return nome.trim();
}

function validarDescricao(descricao: unknown): string | null {
  if (descricao === undefined || descricao === null) return null;
  if (typeof descricao !== 'string') throw new ErroDeSetor('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  if (excedeLimite(descricao.trim(), LIMITES_TEXTO.descricao)) throw new ErroDeSetor('ENTRADA_INVALIDA', `Descrição deve ter no máximo ${LIMITES_TEXTO.descricao} caracteres.`);
  return descricao.trim() || null;
}

export function validarCadastroSetor(input: CadastroSetor): DadosSetor {
  return { nome: validarNome(input.nome), descricao: validarDescricao(input.descricao) };
}

export function ehIdentificadorValido(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function validarAlteracaoSetor(input: AlteracaoSetor): AlteracaoSetor {
  const dados: AlteracaoSetor = {};
  if (input.nome !== undefined) dados.nome = validarNome(input.nome);
  if (input.descricao !== undefined) dados.descricao = validarDescricao(input.descricao);
  if (Object.keys(dados).length === 0) throw new ErroDeSetor('ENTRADA_INVALIDA', 'Informe o nome ou a descrição para alterar.');
  return dados;
}
