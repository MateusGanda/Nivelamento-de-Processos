import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandGunp } from '@/modules/access/presentation/components/brand-gunp';

export const metadata: Metadata = { title: 'Página não encontrada' };

// Página própria de "não encontrada": a padrão do Next.js usa um <style> embutido, bloqueado pela política de conteúdo.
export default function NaoEncontrada() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <section aria-labelledby="nao-encontrada-titulo" className="w-full max-w-md rounded-xl border border-[#2b353e] bg-[#192128]/80 p-6 sm:p-8">
        <BrandGunp variante="painel" />
        <p className="mt-6 font-mono text-sm text-muted">Erro 404</p>
        <h1 id="nao-encontrada-titulo" className="mt-1 text-2xl font-semibold">Página não encontrada</h1>
        <p className="mt-3 text-sm leading-6 text-muted">O endereço pode ter sido digitado errado ou a página não existe mais.</p>
        <Link href="/painel" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          Ir para o painel
        </Link>
      </section>
    </main>
  );
}
