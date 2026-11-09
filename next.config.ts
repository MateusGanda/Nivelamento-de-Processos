import type { NextConfig } from "next";

// Cabeçalhos de segurança enviados em todas as respostas.
// A política de conteúdo (CSP) é aplicada no proxy.ts, porque usa um nonce novo a cada página.
const cabecalhosDeSeguranca = [
  // Impede que o GUNP seja aberto dentro de outro site (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // O navegador respeita o tipo informado pelo servidor e não tenta adivinhar o conteúdo.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Links externos recebem só a origem do site, sem o caminho das páginas do painel.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Impede o next dev de acrescentar um bloco ao AGENTS.md quando é iniciado por uma ferramenta de IA.
  agentRules: false,
  // Não anunciar a tecnologia do servidor (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca }];
  },
};

export default nextConfig;
