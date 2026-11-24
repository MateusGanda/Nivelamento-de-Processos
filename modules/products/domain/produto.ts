import { excedeLimite, LIMITES_TEXTO } from '../../../shared/validation.ts';

export type Produto = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CadastroProduto = { nome: string };
export type NovoProduto = CadastroProduto & { codigo: string };
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

export class ErroCodigoProdutoReservado extends ErroDeProduto {
  constructor() { super('CONFLITO', 'Não foi possível reservar o código. Tente novamente.'); }
}

function exigirTexto(valor: unknown, campo: string, limite: number): string {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErroDeProduto('ENTRADA_INVALIDA', `${campo} é obrigatório.`);
  if (excedeLimite(valor.trim(), limite)) throw new ErroDeProduto('ENTRADA_INVALIDA', `${campo} deve ter no máximo ${limite} caracteres.`);
  return valor.trim();
}

export function validarCadastroProduto(input: CadastroProduto): CadastroProduto {
  if ('codigo' in input) throw new ErroDeProduto('ENTRADA_INVALIDA', 'O código é gerado automaticamente e permanente.');
  return {
    nome: exigirTexto(input.nome, 'Nome', LIMITES_TEXTO.nome),
  };
}

// Só os campos enviados são alterados; ao menos um precisa vir.
export function validarAlteracaoProduto(input: AlteracaoProduto): AlteracaoProduto {
  if ('codigo' in input) throw new ErroDeProduto('ENTRADA_INVALIDA', 'O código é gerado automaticamente e permanente.');
  const dados: AlteracaoProduto = {};
  if (input.nome !== undefined) dados.nome = exigirTexto(input.nome, 'Nome', LIMITES_TEXTO.nome);
  if (Object.keys(dados).length === 0) throw new ErroDeProduto('ENTRADA_INVALIDA', 'Informe o nome para alterar.');
  return dados;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehIdentificadorValido(id: string): boolean {
  return UUID.test(id);
}
