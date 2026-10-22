export type Operador = {
  id: string;
  nome: string;
  matricula: string;
  ativo: boolean;
  funcao: string | null;
  setorPrincipal: SetorPrincipal | null;
  createdAt: string;
  updatedAt: string;
};

export type SetorPrincipal = { id: string; codigo: string; nome: string };
export type CadastroOperador = { nome: string; setorPrincipalId: string; funcao?: string | null };
export type DadosCadastroOperador = { nome: string; setorPrincipalId: string; funcao: string | null };
export type NovoOperador = DadosCadastroOperador & { matricula: string };
export type AlteracaoOperador = Partial<DadosCadastroOperador>;

export class ErroDeOperador extends Error {
  readonly codigo: 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

  constructor(codigo: ErroDeOperador['codigo'], mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeOperador';
    this.codigo = codigo;
  }
}

export class ErroMatriculaReservada extends ErroDeOperador {
  constructor() { super('CONFLITO', 'Não foi possível reservar a matrícula. Tente novamente.'); }
}

export function ehIdentificadorValido(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function validarNome(nome: unknown): string {
  if (typeof nome !== 'string' || !nome.trim()) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  }
  return nome.trim();
}

function validarSetor(id: unknown): string {
  if (typeof id !== 'string' || !ehIdentificadorValido(id.trim())) {
    throw new ErroDeOperador('ENTRADA_INVALIDA', 'Selecione um setor principal válido.');
  }
  return id.trim();
}

function validarFuncao(funcao: unknown): string | null {
  if (funcao === null || funcao === undefined) return null;
  if (typeof funcao !== 'string') throw new ErroDeOperador('ENTRADA_INVALIDA', 'Função deve ser texto ou nula.');
  return funcao.trim() || null;
}

export function validarCadastroOperador(input: CadastroOperador): DadosCadastroOperador {
  return { nome: validarNome(input.nome), setorPrincipalId: validarSetor(input.setorPrincipalId), funcao: validarFuncao(input.funcao) };
}

export function validarAlteracaoOperador(input: AlteracaoOperador): AlteracaoOperador {
  const dados: AlteracaoOperador = {};
  if (input.nome !== undefined) dados.nome = validarNome(input.nome);
  if (input.setorPrincipalId !== undefined) dados.setorPrincipalId = validarSetor(input.setorPrincipalId);
  if (input.funcao !== undefined) dados.funcao = validarFuncao(input.funcao);
  if (Object.keys(dados).length === 0) throw new ErroDeOperador('ENTRADA_INVALIDA', 'Informe ao menos um dado para alterar.');
  return dados;
}
