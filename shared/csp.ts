// Política de segurança de conteúdo (CSP) das páginas do GUNP.
// Cada página recebe um nonce novo: só os scripts do próprio Next.js, marcados com esse nonce, rodam.
// Um script injetado (por exemplo, por um texto malicioso num cadastro) não tem o nonce e é bloqueado.

export type OpcoesCsp = {
  nonce: string;
  // O modo de desenvolvimento do React usa eval e estilos sem nonce.
  desenvolvimento: boolean;
  // Em HTTPS (site publicado), pede ao navegador que nunca carregue nada por HTTP.
  https: boolean;
};

export function montarCsp({ nonce, desenvolvimento, https }: OpcoesCsp): string {
  const diretivas = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ''}`,
    // <style> só com o nonce. Os atributos style="" (largura das barras, por exemplo) não executam código
    // e são liberados à parte, sem afrouxar os scripts.
    `style-src 'self' ${desenvolvimento ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    // data: para os QR Codes gerados no navegador; blob: para a planilha baixada nos indicadores.
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ];
  return diretivas.join('; ');
}

/** Nonce aleatório e único por pedido (122 bits do UUID v4), em base64. */
export function gerarNonce(): string {
  return btoa(crypto.randomUUID());
}
