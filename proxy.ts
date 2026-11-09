import { NextResponse, type NextRequest } from 'next/server';
import { gerarNonce, montarCsp } from './shared/csp';

// Aplica a política de segurança de conteúdo (CSP) com um nonce novo a cada página.
// O Next.js lê o nonce do cabeçalho do pedido e o coloca nos próprios scripts; por isso as páginas
// são renderizadas a cada pedido (todas já usam dynamic = 'force-dynamic').
export function proxy(request: NextRequest) {
  const csp = montarCsp({
    nonce: gerarNonce(),
    desenvolvimento: process.env.NODE_ENV === 'development',
    https: request.nextUrl.protocol === 'https:',
  });

  const cabecalhosDoPedido = new Headers(request.headers);
  cabecalhosDoPedido.set('Content-Security-Policy', csp);

  const resposta = NextResponse.next({ request: { headers: cabecalhosDoPedido } });
  resposta.headers.set('Content-Security-Policy', csp);
  return resposta;
}

export const config = {
  matcher: [
    // Só páginas: a API devolve JSON, e os arquivos estáticos não executam scripts.
    // Pré-carregamentos de links (prefetch) também ficam de fora, como recomenda a documentação do Next.js.
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|images/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
