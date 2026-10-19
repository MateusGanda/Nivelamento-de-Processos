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

export class ErroDePosto extends Error {
  readonly codigo: 'ENTRADA_INVALIDA' | 'CONFLITO';

  constructor(codigo: 'ENTRADA_INVALIDA' | 'CONFLITO', mensagem: string) {
    super(mensagem);
    this.name = 'ErroDePosto';
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarCadastroPosto(input: CadastroPosto): CadastroPosto {
  if (typeof input.codigo !== 'string' || !input.codigo.trim()) {
    throw new ErroDePosto('ENTRADA_INVALIDA', 'Código é obrigatório.');
  }
  if (typeof input.nome !== 'string' || !input.nome.trim()) {
    throw new ErroDePosto('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  }
  if (typeof input.setorId !== 'string' || !UUID.test(input.setorId.trim())) {
    throw new ErroDePosto('ENTRADA_INVALIDA', 'Selecione um setor válido.');
  }
  return { codigo: input.codigo.trim(), nome: input.nome.trim(), setorId: input.setorId.trim() };
}
