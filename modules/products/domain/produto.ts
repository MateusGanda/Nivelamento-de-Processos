export type Produto = {
  id: string;
  codigo: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
};

export type CadastroProduto = { codigo: string; nome: string };
export type AlteracaoProduto = Partial<CadastroProduto>;

export type CodigoErroProduto = 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

export class ErroDeProduto extends Error {
  readonly codigo: CodigoErroProduto;

  constructor(codigo: CodigoErroProduto, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeProduto';
    this.codigo = codigo;
  }
}

function exigirTexto(valor: unknown, mensagem: string): string {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErroDeProduto('ENTRADA_INVALIDA', mensagem);
  return valor.trim();
}

export function validarCadastroProduto(input: CadastroProduto): CadastroProduto {
  return {
    codigo: exigirTexto(input.codigo, 'Código é obrigatório.'),
    nome: exigirTexto(input.nome, 'Nome é obrigatório.'),
  };
}

// Só os campos enviados são alterados; ao menos um precisa vir.
export function validarAlteracaoProduto(input: AlteracaoProduto): AlteracaoProduto {
  const dados: AlteracaoProduto = {};
  if (input.codigo !== undefined) dados.codigo = exigirTexto(input.codigo, 'Código é obrigatório.');
  if (input.nome !== undefined) dados.nome = exigirTexto(input.nome, 'Nome é obrigatório.');
  if (Object.keys(dados).length === 0) throw new ErroDeProduto('ENTRADA_INVALIDA', 'Informe o código ou o nome para alterar.');
  return dados;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehIdentificadorValido(id: string): boolean {
  return UUID.test(id);
}
