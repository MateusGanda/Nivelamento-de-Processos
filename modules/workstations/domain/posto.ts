export type Posto = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  setor: { id: string; nome: string };
  createdAt: string;
  updatedAt: string;
};

export type CadastroPosto = { codigo: string; nome: string; setorId: string };
export type AlteracaoPosto = Partial<CadastroPosto>;

export type CodigoErroPosto = 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

export class ErroDePosto extends Error {
  readonly codigo: CodigoErroPosto;

  constructor(codigo: CodigoErroPosto, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDePosto';
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigirCodigo(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErroDePosto('ENTRADA_INVALIDA', 'Código é obrigatório.');
  return valor.trim();
}

function exigirNome(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErroDePosto('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  return valor.trim();
}

function exigirSetorId(valor: unknown): string {
  if (typeof valor !== 'string' || !UUID.test(valor.trim())) throw new ErroDePosto('ENTRADA_INVALIDA', 'Selecione um setor válido.');
  return valor.trim();
}

export function validarCadastroPosto(input: CadastroPosto): CadastroPosto {
  return { codigo: exigirCodigo(input.codigo), nome: exigirNome(input.nome), setorId: exigirSetorId(input.setorId) };
}

// Só os campos enviados são alterados; ao menos um precisa vir.
export function validarAlteracaoPosto(input: AlteracaoPosto): AlteracaoPosto {
  const dados: AlteracaoPosto = {};
  if (input.codigo !== undefined) dados.codigo = exigirCodigo(input.codigo);
  if (input.nome !== undefined) dados.nome = exigirNome(input.nome);
  if (input.setorId !== undefined) dados.setorId = exigirSetorId(input.setorId);
  if (Object.keys(dados).length === 0) throw new ErroDePosto('ENTRADA_INVALIDA', 'Informe o código, o nome ou o setor para alterar.');
  return dados;
}

export function ehIdentificadorValido(id: string): boolean {
  return UUID.test(id);
}
