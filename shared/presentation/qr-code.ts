// Geração técnica compartilhada por crachás e fichas; o conteúdo pertence a cada módulo.
const opcoesQr = {
  type: 'image/png', errorCorrectionLevel: 'Q', margin: 4, width: 1024,
  color: { dark: '#000000ff', light: '#ffffffff' },
} as const;

export async function gerarQrPng(conteudo: string): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(conteudo, opcoesQr);
}
