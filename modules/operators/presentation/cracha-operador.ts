import type { Operador } from '../domain/operador.ts';
import { listarOperadores } from './api-client.ts';

export type CrachaOperador = { operador: Operador; qrPng: string; nomeArquivo: string };

export class ErroCrachaOperador extends Error {}

const opcoesQr = {
  type: 'image/png', errorCorrectionLevel: 'Q', margin: 4, width: 1024,
  color: { dark: '#000000ff', light: '#ffffffff' },
} as const;

export async function gerarQrOperador(matricula: string): Promise<string> {
  // Carregado apenas ao solicitar um crachá. O bundler usa a implementação para navegador.
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(matricula, opcoesQr);
}

export async function prepararCrachaOperador(
  id: string,
  signal: AbortSignal,
  gerarQr: (matricula: string) => Promise<string> = gerarQrOperador,
): Promise<CrachaOperador> {
  signal.throwIfAborted();
  const operadores = await listarOperadores(signal);
  signal.throwIfAborted();
  const operador = operadores.find((item) => item.id === id);
  if (!operador) throw new ErroCrachaOperador('O operador não está mais disponível. Atualize a listagem.');
  if (!operador.ativo) throw new ErroCrachaOperador('Este operador está inativo. Reative-o antes de emitir o crachá.');
  if (!operador.matricula.trim()) throw new ErroCrachaOperador('O operador não possui uma matrícula válida para gerar o QR Code.');

  // Codificar a matrícula armazenada inteira: sem trim, caixa nova, prefixo ou URL.
  let qrPng: string;
  try { qrPng = await gerarQr(operador.matricula); }
  catch {
    signal.throwIfAborted();
    throw new ErroCrachaOperador('Não foi possível gerar o QR Code. Tente novamente.');
  }
  signal.throwIfAborted();
  return { operador, qrPng, nomeArquivo: `qr-operador-${operador.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.png` };
}
