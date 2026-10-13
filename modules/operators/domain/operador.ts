export type Operador = {
  id: string;
  nome: string;
  matricula: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CadastroOperador = { nome: string; matricula: string };

export class ErroDeOperador extends Error {
  readonly codigo: 'ENTRADA_INVALIDA' | 'CONFLITO';

  constructor(codigo: 'ENTRADA_INVALIDA' | 'CONFLITO', mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeOperador';
    this.codigo = codigo;
  }
}

export function validarCadastroOperador(input: CadastroOperador): CadastroOperador {
  if (typeof input.nome !== 'string' || !input.nome.trim()) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  }
  if (typeof input.matricula !== 'string' || !input.matricula.trim()) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Matrícula é obrigatória.');
  }
  return { nome: input.nome.trim(), matricula: input.matricula.trim() };
}
