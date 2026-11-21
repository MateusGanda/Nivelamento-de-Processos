import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { COOKIE_TEMA, temaDoCookie } from "@/shared/presentation/tema";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A política de conteúdo (proxy.ts) usa um nonce por pedido: toda página, inclusive a de "não encontrada",
// precisa ser montada a cada pedido para os scripts do Next.js receberem esse nonce.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: "GUNP", template: "%s | GUNP" },
  description: "Gerenciamento de Nivelamento de Processos: cadastros, execuções e acompanhamento da produção.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // O tema vem do cookie para a página já chegar com as cores certas, sem piscar e sem script na página.
  const tema = temaDoCookie((await cookies()).get(COOKIE_TEMA)?.value);
  return (
    <html
      lang="pt-BR"
      data-theme={tema}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
