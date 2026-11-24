import { excedeLimite, LIMITES_TEXTO } from '../../../shared/validation.ts';

export type Posto = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  setor: { id: string; nome: string };
  createdAt: string;
  updatedAt: string;
};

export type CadastroPosto = { nome: string; setorId: string };
export type NovoPosto = CadastroPosto & { codigo: string };
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

export class ErroCodigoPostoReservado extends ErroDePosto {
  constructor() { super('CONFLITO', 'Não foi possível reservar o código. Tente novamente.'); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigirNome(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErroDePosto('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  if (excedeLimite(valor.trim(), LIMITES_TEXTO.nome)) throw new ErroDePosto('ENTRADA_INVALIDA', `Nome deve ter no máximo ${LIMITES_TEXTO.nome} caracteres.`);
  return valor.trim();
}

function exigirSetorId(valor: unknown): string {
  if (typeof valor !== 'string' || !UUID.test(valor.trim())) throw new ErroDePosto('ENTRADA_INVALIDA', 'Selecione um setor válido.');
  return valor.trim();
}

export function validarCadastroPosto(input: CadastroPosto): CadastroPosto {
  if ('codigo' in input) throw new ErroDePosto('ENTRADA_INVALIDA', 'O código é gerado automaticamente e permanente.');
  return { nome: exigirNome(input.nome), setorId: exigirSetorId(input.setorId) };
}

// Só os campos enviados são alterados; ao menos um precisa vir.
export function validarAlteracaoPosto(input: AlteracaoPosto): AlteracaoPosto {
  if ('codigo' in input) throw new ErroDePosto('ENTRADA_INVALIDA', 'O código é gerado automaticamente e permanente.');
  const dados: AlteracaoPosto = {};
  if (input.nome !== undefined) dados.nome = exigirNome(input.nome);
  if (input.setorId !== undefined) dados.setorId = exigirSetorId(input.setorId);
  if (Object.keys(dados).length === 0) throw new ErroDePosto('ENTRADA_INVALIDA', 'Informe o nome ou o setor para alterar.');
  return dados;
}

export function ehIdentificadorValido(id: string): boolean {
  return UUID.test(id);
}
