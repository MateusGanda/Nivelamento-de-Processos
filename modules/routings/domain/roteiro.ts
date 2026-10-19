export type OperacaoDoRoteiro = { id: string; nome: string };
export type PostoDaEtapa = { id: string; codigo: string; nome: string; ativo: boolean; setorNome: string };

export type EtapaDoRoteiro = {
  id: string;
  ordem: number;
  operacao: OperacaoDoRoteiro;
  postos: PostoDaEtapa[];
};

export type RoteiroResumo = {
  id: string;
  nome: string;
  versao: number;
  ativo: boolean;
  quantidadeEtapas: number;
  quantidadeOrdens: number;
  createdAt: string;
  updatedAt: string;
};

export type VersaoDoRoteiro = { id: string; versao: number; ativo: boolean };

// Tempo padrão em segundos por unidade produzida, por etapa desta versão.
export type TempoDaEtapa = { etapaId: string; tempoPadrao: number };

export type ProdutoDoRoteiro = {
  id: string;
  codigo: string;
  nome: string;
  vigente: boolean;
  quantidadeOrdens: number;
  // Com ordens do produto nesta versão, os tempos padrão dele ficam travados.
  travado: boolean;
  tempos: TempoDaEtapa[];
};

export type RoteiroDetalhe = RoteiroResumo & {
  // Com ordens, as etapas ficam travadas para manter a versão usada por elas.
  travado: boolean;
  etapas: EtapaDoRoteiro[];
  versoes: VersaoDoRoteiro[];
  produtos: ProdutoDoRoteiro[];
};

// id ausente cria uma etapa; id presente mantém a etapa existente, com seus postos.
export type EtapaInformada = { id?: string; operacaoId: string };

// tempoPadrao nulo retira o tempo padrão da etapa.
export type TempoInformado = { etapaId: string; tempoPadrao: number | null };

export type CodigoErroRoteiro = 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

export class ErroDeRoteiro extends Error {
  readonly codigo: CodigoErroRoteiro;

  constructor(codigo: CodigoErroRoteiro, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeRoteiro';
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehIdentificadorValido(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

export function validarNomeRoteiro(nome: unknown): string {
  if (typeof nome !== 'string' || !nome.trim()) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Nome é obrigatório.');
  return nome.trim();
}

export function validarEtapasInformadas(etapas: unknown): EtapaInformada[] {
  if (!Array.isArray(etapas) || etapas.length === 0) {
    throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'O roteiro precisa de pelo menos uma etapa.');
  }
  const ids = new Set<string>();
  return etapas.map((etapa) => {
    if (!etapa || typeof etapa !== 'object' || Array.isArray(etapa)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Etapa inválida.');
    const { id, operacaoId, ...outros } = etapa as Record<string, unknown>;
    if (Object.keys(outros).length > 0) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Informe somente a etapa e a operação.');
    if (!ehIdentificadorValido(operacaoId)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Selecione uma operação válida para cada etapa.');
    if (id === undefined) return { operacaoId };
    if (!ehIdentificadorValido(id) || ids.has(id)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Etapa inválida ou repetida.');
    ids.add(id);
    return { id, operacaoId };
  });
}

export function validarPostosInformados(postoIds: unknown): string[] {
  if (!Array.isArray(postoIds) || !postoIds.every(ehIdentificadorValido)) {
    throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Selecione postos válidos.');
  }
  if (new Set(postoIds).size !== postoIds.length) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Posto repetido na etapa.');
  return [...postoIds];
}

// O banco guarda numeric(10,2): até 99.999.999,99 segundos, com duas casas.
const TEMPO_MAXIMO = 99_999_999.99;

export function validarTemposInformados(tempos: unknown): TempoInformado[] {
  if (!Array.isArray(tempos) || tempos.length === 0) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Informe os tempos padrão das etapas.');
  const etapas = new Set<string>();
  return tempos.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Tempo padrão inválido.');
    const { etapaId, tempoPadrao, ...outros } = item as Record<string, unknown>;
    if (Object.keys(outros).length > 0) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Informe somente a etapa e o tempo padrão.');
    if (!ehIdentificadorValido(etapaId) || etapas.has(etapaId)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Etapa inválida ou repetida.');
    etapas.add(etapaId);
    if (tempoPadrao === null) return { etapaId, tempoPadrao: null };
    if (typeof tempoPadrao !== 'number' || !Number.isFinite(tempoPadrao) || tempoPadrao <= 0 || tempoPadrao > TEMPO_MAXIMO) {
      throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'O tempo padrão deve ser maior que zero, em segundos por unidade.');
    }
    if (Math.abs(Math.round(tempoPadrao * 100) - tempoPadrao * 100) > 1e-6) {
      throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'O tempo padrão aceita no máximo duas casas decimais.');
    }
    return { etapaId, tempoPadrao };
  });
}
