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
  /** Soma dos encerramentos parciais já feitos nesta etapa da ordem, por qualquer operador. */
  apontado: Baixa;
};

// Execução aberta vista pelo administrador no acompanhamento: inclui quem executa, o setor do posto e
// o tempo padrão da etapa para o produto (segundos por unidade; null se não cadastrado).
export type ExecucaoAcompanhada = ExecucaoAberta & {
  operador: { matricula: string; nome: string };
  setor: string;
  tempoPadraoSegundos: number | null;
};

export type OperadorDaIlha = {
  id: string;
  matricula: string;
  nome: string;
  setor: string | null;
  execucaoAberta: ExecucaoAberta | null;
};

export type PostoDisponivel = { id: string; codigo: string; nome: string };
/** `apontado`: total (boa + retrabalho + refugo) dos encerramentos parciais da etapa; zero quando não houve. */
export type EtapaDisponivel = { id: string; ordem: number; operacao: string; baixada: boolean; apontado: number; postos: PostoDisponivel[] };
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

function validarQuantidades(informado: Partial<Record<keyof Baixa, unknown>>): Baixa {
  return {
    quantidadeBoa: validarQuantidade(informado.quantidadeBoa, 'Quantidade boa'),
    quantidadeRetrabalho: validarQuantidade(informado.quantidadeRetrabalho, 'Retrabalho'),
    quantidadeRefugo: validarQuantidade(informado.quantidadeRefugo, 'Refugo'),
  };
}

const totalEmCentavos = (q: Baixa) => centavos(q.quantidadeBoa) + centavos(q.quantidadeRetrabalho) + centavos(q.quantidadeRefugo);

export const NADA_APONTADO: Baixa = { quantidadeBoa: 0, quantidadeRetrabalho: 0, quantidadeRefugo: 0 };

/** Soma exata, em duas casas, dos encerramentos parciais de uma etapa. */
export function somarApontamentos(apontamentos: readonly Baixa[]): Baixa {
  let boa = 0;
  let retrabalho = 0;
  let refugo = 0;
  for (const a of apontamentos) {
    boa += centavos(a.quantidadeBoa);
    retrabalho += centavos(a.quantidadeRetrabalho);
    refugo += centavos(a.quantidadeRefugo);
  }
  return { quantidadeBoa: boa / 100, quantidadeRetrabalho: retrabalho / 100, quantidadeRefugo: refugo / 100 };
}

/** Total já apontado (boa + retrabalho + refugo). */
export const totalApontado = (apontado: Baixa) => totalEmCentavos(apontado) / 100;

// A baixa conclui a etapa: o que já foi apontado nos encerramentos parciais mais boa + retrabalho + refugo
// da baixa precisa ser a quantidade inteira da ordem. Sem encerramento parcial, a baixa traz a quantidade toda.
export function validarBaixa(baixa: Partial<Record<keyof Baixa, unknown>>, quantidadeOrdem: number, jaApontado: Baixa = NADA_APONTADO): Baixa {
  const dados = validarQuantidades(baixa);
  const soma = totalEmCentavos(dados);
  const anterior = totalEmCentavos(jaApontado);
  const falta = centavos(quantidadeOrdem) - anterior;
  if (soma === falta) return dados;
  if (anterior === 0) {
    throw new ErroDeExecucao('ENTRADA_INVALIDA', `A soma de boa, retrabalho e refugo (${soma / 100}) precisa ser igual à quantidade da ordem (${quantidadeOrdem}).`);
  }
  throw new ErroDeExecucao('ENTRADA_INVALIDA', `Já foram apontados ${anterior / 100} em turnos anteriores. A soma de boa, retrabalho e refugo (${soma / 100}) precisa ser igual ao que falta (${falta / 100}).`);
}

// Encerramento parcial (fim do turno): registra o que foi feito e deixa a etapa pendente. Somado ao que já foi
// apontado, precisa ficar abaixo da quantidade da ordem; quando completa a quantidade, o certo é a baixa.
export function validarEncerramentoParcial(informado: Partial<Record<keyof Baixa, unknown>>, quantidadeOrdem: number, jaApontado: Baixa = NADA_APONTADO): Baixa {
  const dados = validarQuantidades(informado);
  const total = totalEmCentavos(jaApontado) + totalEmCentavos(dados);
  const falta = (centavos(quantidadeOrdem) - totalEmCentavos(jaApontado)) / 100;
  if (total === centavos(quantidadeOrdem)) {
    throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Com essas quantidades a etapa fica completa. Use "Finalizar e dar baixa".');
  }
  if (total > centavos(quantidadeOrdem)) {
    throw new ErroDeExecucao('ENTRADA_INVALIDA', `A soma de boa, retrabalho e refugo (${totalEmCentavos(dados) / 100}) passa do que falta na etapa (${falta}).`);
  }
  return dados;
}

// Transições permitidas pelo modelo: EM_EXECUCAO ↔ PAUSADA e EM_EXECUCAO → FINALIZADA.
export function exigirStatus(atual: StatusExecucao, esperado: StatusExecucao, acao: string): void {
  if (atual === esperado) return;
  const motivo = atual === 'FINALIZADA' ? 'a execução já foi finalizada' : atual === 'PAUSADA' ? 'a execução está pausada' : 'a execução está em andamento';
  throw new ErroDeExecucao('CONFLITO', `Não é possível ${acao}: ${motivo}.`);
}
