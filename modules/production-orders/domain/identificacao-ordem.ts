import { ehIdentificadorValido, ErroDeOrdem } from './ordem.ts';

export function codigoQrDaOrdem(id: string): string {
  if (!ehIdentificadorValido(id)) throw new ErroDeOrdem('ENTRADA_INVALIDA', 'Identificador de ordem inválido para gerar o QR Code.');
  return `GUNP-OP-${id.toUpperCase()}`;
}

export function idDaOrdemNoQr(conteudo: string): string | null {
  const leitura = /^GUNP-OP-(.+)$/i.exec(conteudo.trim());
  return leitura && ehIdentificadorValido(leitura[1]) ? leitura[1].toLowerCase() : null;
}
