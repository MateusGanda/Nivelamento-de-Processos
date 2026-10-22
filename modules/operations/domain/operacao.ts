export type Operacao = {
  id: string;
  nome: string;
  descricao: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CadastroOperacao = { nome: string; descricao?: string | null };
export type DadosOperacao = { nome: string; descricao: string | null };
export type AlteracaoOperacao = Partial<DadosOperacao>;

export class ErroDeOperacao extends Error {
  readonly codigo: 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

  constructor(codigo: ErroDeOperacao['codigo'], mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeOperacao';
    this.codigo = codigo;
  }
}

function validarNome(nome: unknown): string {
  if (typeof nome !== 'string' || !nome.trim()) {
    throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  }
  return nome.trim();
}

function validarDescricao(descricao: unknown): string | null {
  if (descricao === undefined || descricao === null) return null;
  if (typeof descricao !== 'string') throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  return descricao.trim() || null;
}

export function validarCadastroOperacao(input: CadastroOperacao): DadosOperacao {
  return { nome: validarNome(input.nome), descricao: validarDescricao(input.descricao) };
}

export function validarAlteracaoOperacao(input: AlteracaoOperacao): AlteracaoOperacao {
  const dados: AlteracaoOperacao = {};
  if (input.nome !== undefined) dados.nome = validarNome(input.nome);
  if (input.descricao !== undefined) dados.descricao = validarDescricao(input.descricao);
  if (Object.keys(dados).length === 0) {
    throw new ErroDeOperacao('ENTRADA_INVALIDA', 'Informe o nome ou a descrição para alterar.');
  }
  return dados;
}

export function ehIdentificadorValido(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
