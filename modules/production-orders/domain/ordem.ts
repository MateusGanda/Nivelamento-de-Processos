import { excedeLimite, LIMITES_TEXTO } from '../../../shared/validation.ts';

export type Ordem = {
  id: string;
  numero: string;
  quantidade: number;
  unidade: string;
  plano: { id: string; codigo: string };
  produto: { id: string; codigo: string; nome: string };
  // Versão do roteiro gravada na criação; não muda depois.
  roteiro: { id: string; nome: string; versao: number };
  quantidadeExecucoes: number;
  createdAt: string;
  updatedAt: string;
};

export type CadastroOrdem = { planoId: string; produtoId: string; roteiroId: string; quantidade: number; unidade: string };
export type NovaOrdem = CadastroOrdem & { numero: string };
export type AlteracaoOrdem = Partial<Pick<CadastroOrdem, 'planoId' | 'quantidade' | 'unidade'>>;

// Opções do formulário: produtos ativos com as versões de roteiro ligadas a eles.
export type RoteiroDoProduto = { id: string; nome: string; versao: number; vigente: boolean; ativo: boolean; quantidadeEtapas: number };
export type ProdutoParaOrdem = { id: string; codigo: string; nome: string; roteiros: RoteiroDoProduto[] };
export type OpcoesOrdem = { produtos: ProdutoParaOrdem[]; planos: { id: string; codigo: string }[] };

export const MENSAGEM_ORDEM_COM_EXECUCOES = 'A ordem já tem execuções, por isso a quantidade e a unidade não podem mudar.';

export type CodigoErroOrdem = 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

export class ErroDeOrdem extends Error {
  readonly codigo: CodigoErroOrdem;

  constructor(codigo: CodigoErroOrdem, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeOrdem';
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehIdentificadorValido(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

// O banco guarda numeric(12,2): até 9.999.999.999,99, com duas casas.
const QUANTIDADE_MAXIMA = 9_999_999_999.99;

function validarQuantidade(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > QUANTIDADE_MAXIMA) {
    throw new ErroDeOrdem('ENTRADA_INVALIDA', 'A quantidade deve ser maior que zero.');
  }
  if (Math.abs(Math.round(valor * 100) - valor * 100) > 1e-6) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'A quantidade aceita no máximo duas casas decimais.');
  return valor;
}

function validarUnidade(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Unidade é obrigatória.');
  if (excedeLimite(valor.trim(), LIMITES_TEXTO.unidade)) throw new ErroDeOrdem('ENTRADA_INVALIDA', `Unidade deve ter no máximo ${LIMITES_TEXTO.unidade} caracteres.`);
  return valor.trim();
}

function validarId(valor: unknown, mensagem: string): string {
  if (!ehIdentificadorValido(valor)) throw new ErroDeOrdem('ENTRADA_INVALIDA', mensagem);
  return valor;
}

export function validarCadastroOrdem(input: CadastroOrdem): CadastroOrdem {
  if ('numero' in input) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'O número é gerado automaticamente e permanente.');
  return {
    planoId: validarId(input.planoId, 'Selecione um plano de produção válido.'),
    produtoId: validarId(input.produtoId, 'Selecione um produto válido.'),
    roteiroId: validarId(input.roteiroId, 'Selecione uma versão de roteiro válida.'),
    quantidade: validarQuantidade(input.quantidade),
    unidade: validarUnidade(input.unidade),
  };
}

// Só os campos enviados são alterados; produto e roteiro ficam fora porque a ordem congela a versão.
export function validarAlteracaoOrdem(input: AlteracaoOrdem): AlteracaoOrdem {
  const dados: AlteracaoOrdem = {};
  if ('numero' in input) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'O número é gerado automaticamente e permanente.');
  if (input.planoId !== undefined) dados.planoId = validarId(input.planoId, 'Selecione um plano de produção válido.');
  if (input.quantidade !== undefined) dados.quantidade = validarQuantidade(input.quantidade);
  if (input.unidade !== undefined) dados.unidade = validarUnidade(input.unidade);
  if (Object.keys(dados).length === 0) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Informe ao menos um campo para alterar.');
  return dados;
}

export class ErroNumeroOrdemReservado extends ErroDeOrdem {
  constructor() { super('CONFLITO', 'Não foi possível reservar um número para a ordem. Tente novamente.'); }
}
