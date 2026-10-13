export type Setor = {
  id: string;
  nome: string;
  descricao: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CadastroSetor = { nome: string; descricao?: string | null };
export type DadosSetor = { nome: string; descricao: string | null };

export class ErroDeSetor extends Error {
  readonly codigo: 'ENTRADA_INVALIDA' | 'CONFLITO';

  constructor(codigo: 'ENTRADA_INVALIDA' | 'CONFLITO', mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeSetor';
    this.codigo = codigo;
  }
}

export function validarCadastroSetor(input: CadastroSetor): DadosSetor {
  if (typeof input.nome !== 'string' || !input.nome.trim()) {
    throw new ErroDeSetor('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  }
  if (input.descricao !== undefined && input.descricao !== null && typeof input.descricao !== 'string') {
    throw new ErroDeSetor('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  }
  return { nome: input.nome.trim(), descricao: input.descricao?.trim() || null };
}
