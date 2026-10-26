export type MotivoPausa = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CadastroMotivoPausa = { nome: string; descricao?: string | null };
export type DadosMotivoPausa = { nome: string; descricao: string | null };
export type AlteracaoMotivoPausa = Partial<DadosMotivoPausa>;

export class ErroDeMotivoPausa extends Error {
  readonly codigo: 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

  constructor(codigo: ErroDeMotivoPausa['codigo'], mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeMotivoPausa';
    this.codigo = codigo;
  }
}

function validarNome(nome: unknown): string {
  if (typeof nome !== 'string' || !nome.trim()) {
    throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  }
  return nome.trim();
}

function validarDescricao(descricao: unknown): string | null {
  if (descricao === undefined || descricao === null) return null;
  if (typeof descricao !== 'string') throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  return descricao.trim() || null;
}

export function validarCadastroMotivoPausa(input: CadastroMotivoPausa): DadosMotivoPausa {
  return { nome: validarNome(input.nome), descricao: validarDescricao(input.descricao) };
}

export function validarAlteracaoMotivoPausa(input: AlteracaoMotivoPausa): AlteracaoMotivoPausa {
  const dados: AlteracaoMotivoPausa = {};
  if (input.nome !== undefined) dados.nome = validarNome(input.nome);
  if (input.descricao !== undefined) dados.descricao = validarDescricao(input.descricao);
  if (Object.keys(dados).length === 0) {
    throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'Informe o nome ou a descrição para alterar.');
  }
  return dados;
}

export function ehIdentificadorValido(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
