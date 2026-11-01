export type StatusExecucao = 'EM_EXECUCAO' | 'PAUSADA' | 'FINALIZADA';
export type TipoEvento = 'INICIO' | 'PAUSA' | 'RETOMADA' | 'FINALIZACAO';

export type EventoDaExecucao = { tipo: TipoEvento; dataHora: string; motivo: string | null };

// Execução aberta (em execução ou pausada) do operador identificado na ilha.
export type ExecucaoAberta = {
  id: string;
  status: Exclude<StatusExecucao, 'FINALIZADA'>;
  ordem: { id: string; numero: string; quantidade: number; unidade: string };
  produto: { codigo: string; nome: string };
  etapa: { id: string; ordem: number; operacao: string };
  posto: { id: string; codigo: string; nome: string };
  eventos: EventoDaExecucao[];
};

export type OperadorDaIlha = {
  id: string;
  matricula: string;
  nome: string;
  setor: string | null;
  execucaoAberta: ExecucaoAberta | null;
};

export type PostoDisponivel = { id: string; codigo: string; nome: string };
export type EtapaDisponivel = { id: string; ordem: number; operacao: string; baixada: boolean; postos: PostoDisponivel[] };
export type OrdemDisponivel = {
  id: string; numero: string; quantidade: number; unidade: string; plano: string;
  produto: { codigo: string; nome: string }; etapas: EtapaDisponivel[];
};

// Onde a execução acontece: a etapa de uma ordem, num posto compatível.
export type Destino = { ordemId: string; etapaId: string; postoId: string };
export type Baixa = { quantidadeBoa: number; quantidadeRetrabalho: number; quantidadeRefugo: number };

export type CodigoErroExecucao = 'ENTRADA_INVALIDA' | 'NAO_ENCONTRADO' | 'CONFLITO';

export class ErroDeExecucao extends Error {
  readonly codigo: CodigoErroExecucao;

  constructor(codigo: CodigoErroExecucao, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeExecucao';
    this.codigo = codigo;
  }
}

export const MENSAGEM_ESTADO_MUDOU = 'A execução mudou de estado enquanto a ação era enviada. Identifique o operador de novo para ver a situação atual.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehIdentificadorValido(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

export function validarMatricula(matricula: unknown): string {
  if (typeof matricula !== 'string' || !matricula.trim()) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Informe a matrícula do operador.');
  return matricula.trim();
}

export function validarDestino(destino: Partial<Record<keyof Destino, unknown>>): Destino {
  const { ordemId, etapaId, postoId } = destino;
  if (!ehIdentificadorValido(ordemId)) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Selecione uma ordem válida.');
  if (!ehIdentificadorValido(etapaId)) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Selecione uma etapa válida.');
  if (!ehIdentificadorValido(postoId)) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Selecione um posto válido.');
  return { ordemId, etapaId, postoId };
}

const centavos = (valor: number) => Math.round(valor * 100);

function validarQuantidade(valor: unknown, campo: string): number {
  // Quantidade negativa poderia fechar a soma e passar pela conferência (pendência 1).
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    throw new ErroDeExecucao('ENTRADA_INVALIDA', `${campo} deve ser zero ou maior.`);
  }
  if (Math.abs(centavos(valor) - valor * 100) > 1e-6) throw new ErroDeExecucao('ENTRADA_INVALIDA', `${campo} aceita no máximo duas casas decimais.`);
  return valor;
}

// Não existe baixa parcial: boa + retrabalho + refugo precisa ser a quantidade inteira da ordem.
export function validarBaixa(baixa: Partial<Record<keyof Baixa, unknown>>, quantidadeOrdem: number): Baixa {
  const dados = {
    quantidadeBoa: validarQuantidade(baixa.quantidadeBoa, 'Quantidade boa'),
    quantidadeRetrabalho: validarQuantidade(baixa.quantidadeRetrabalho, 'Retrabalho'),
    quantidadeRefugo: validarQuantidade(baixa.quantidadeRefugo, 'Refugo'),
  };
  const soma = centavos(dados.quantidadeBoa) + centavos(dados.quantidadeRetrabalho) + centavos(dados.quantidadeRefugo);
  if (soma !== centavos(quantidadeOrdem)) {
    throw new ErroDeExecucao('ENTRADA_INVALIDA', `A soma de boa, retrabalho e refugo (${soma / 100}) precisa ser igual à quantidade da ordem (${quantidadeOrdem}).`);
  }
  return dados;
}

// Transições permitidas pelo modelo: EM_EXECUCAO ↔ PAUSADA e EM_EXECUCAO → FINALIZADA.
export function exigirStatus(atual: StatusExecucao, esperado: StatusExecucao, acao: string): void {
  if (atual === esperado) return;
  const motivo = atual === 'FINALIZADA' ? 'a execução já foi finalizada' : atual === 'PAUSADA' ? 'a execução está pausada' : 'a execução está em andamento';
  throw new ErroDeExecucao('CONFLITO', `Não é possível ${acao}: ${motivo}.`);
}
