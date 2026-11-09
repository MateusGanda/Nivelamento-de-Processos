import { createHash, randomBytes } from 'node:crypto';
import type { CodigosDeAcesso } from '../application/contracts.ts';
import { formatarCodigo, TAMANHO_CODIGO } from '../domain/dispositivo.ts';

// O código tem cerca de 50 bits aleatórios e não é escolhido por pessoas, então um SHA-256 basta como resumo:
// com o banco em mãos não dá para recuperar o código, e a busca pelo resumo continua direta.
export const codigosDeAcesso: CodigosDeAcesso = {
  gerar: () => formatarCodigo(randomBytes(TAMANHO_CODIGO)),
  resumo: (codigoNormalizado) => createHash('sha256').update(`gunp-tv-v1:${codigoNormalizado}`).digest('hex'),
};
