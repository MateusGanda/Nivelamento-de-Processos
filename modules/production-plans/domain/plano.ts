export type Plano = {
  id: string;
  codigo: string;
  descricao: string | null;
  // Datas no formato AAAA-MM-DD, sem horário nem fuso.
  dataInicio: string | null;
  dataFim: string | null;
  quantidadeOrdens: number;
  createdAt: string;
  updatedAt: string;
};

export type DadosPlano = { codigo: string; descricao: string | null; dataInicio: string | null; dataFim: string | null };
export type CadastroPlano = { codigo: string; descricao?: string | null; dataInicio?: string | null; dataFim?: string | null };
export type AlteracaoPlano = Partial<DadosPlano>;

export type CodigoErroPlano = 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

export class ErroDePlano extends Error {
  readonly codigo: CodigoErroPlano;

  constructor(codigo: CodigoErroPlano, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDePlano';
    this.codigo = codigo;
  }
}

function validarCodigo(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErroDePlano('ENTRADA_INVALIDA', 'Código é obrigatório.');
  return valor.trim();
}

function validarDescricao(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw new ErroDePlano('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  return valor.trim() || null;
}

// Aceita só datas de calendário reais (2026-02-30 é recusada).
function validarData(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new ErroDePlano('ENTRADA_INVALIDA', `${campo} deve estar no formato AAAA-MM-DD.`);
  }
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    throw new ErroDePlano('ENTRADA_INVALIDA', `${campo} não é uma data válida.`);
  }
  return valor;
}

export function validarPeriodo(dataInicio: string | null, dataFim: string | null): void {
  // O formato AAAA-MM-DD permite comparar as datas como texto.
  if (dataInicio && dataFim && dataFim < dataInicio) {
    throw new ErroDePlano('ENTRADA_INVALIDA', 'A data de fim não pode ser anterior à data de início.');
  }
}

export function validarCadastroPlano(input: CadastroPlano): DadosPlano {
  const dados = {
    codigo: validarCodigo(input.codigo),
    descricao: validarDescricao(input.descricao),
    dataInicio: validarData(input.dataInicio, 'Data de início'),
    dataFim: validarData(input.dataFim, 'Data de fim'),
  };
  validarPeriodo(dados.dataInicio, dados.dataFim);
  return dados;
}

// Só os campos enviados são alterados; o período é conferido no serviço junto com os valores atuais.
export function validarAlteracaoPlano(input: AlteracaoPlano): AlteracaoPlano {
  const dados: AlteracaoPlano = {};
  if (input.codigo !== undefined) dados.codigo = validarCodigo(input.codigo);
  if (input.descricao !== undefined) dados.descricao = validarDescricao(input.descricao);
  if (input.dataInicio !== undefined) dados.dataInicio = validarData(input.dataInicio, 'Data de início');
  if (input.dataFim !== undefined) dados.dataFim = validarData(input.dataFim, 'Data de fim');
  if (Object.keys(dados).length === 0) throw new ErroDePlano('ENTRADA_INVALIDA', 'Informe ao menos um campo para alterar.');
  return dados;
}

export function ehIdentificadorValido(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
