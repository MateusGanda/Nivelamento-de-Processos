import type { OperadorDaIlha } from '../domain/execucao.ts';
import { ErroApiIlha, identificarOperador } from './api-client.ts';

export type IdentificacaoEsperada = Pick<OperadorDaIlha, 'id' | 'matricula'>;

// 400 representa entrada rejeitada pela API. Nos demais casos a situação pode
// ter mudado, inclusive quando a gravação ocorreu mas a resposta se perdeu.
export function exigeAtualizacaoSituacao(falha: unknown): boolean {
  return !(falha instanceof ErroApiIlha && falha.status === 400);
}

export async function consultarSituacaoOperador(esperado: IdentificacaoEsperada, signal?: AbortSignal): Promise<OperadorDaIlha> {
  const resultado = await identificarOperador(esperado.matricula, signal);
  if (resultado.id !== esperado.id || resultado.matricula !== esperado.matricula) {
    throw new ErroApiIlha(500, 'Não foi possível confirmar a identificação. Identifique o operador novamente.');
  }
  return resultado;
}
