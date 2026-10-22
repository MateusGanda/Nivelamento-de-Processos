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

export function validarCadastroSetor(input: CadastroSetor): DadosSetor {
  if (typeof input.nome !== 'string' || !input.nome.trim()) {
    throw new ErroDeSetor('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  }
  if (input.descricao !== undefined && input.descricao !== null && typeof input.descricao !== 'string') {
    throw new ErroDeSetor('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  }
  return { nome: input.nome.trim(), descricao: input.descricao?.trim() || null };
}

export function ehIdentificadorValido(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
