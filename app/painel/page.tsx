import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { BrandGunp } from '@/modules/access/presentation/components/brand-gunp';
import { LogoutButton } from '@/modules/access/presentation/components/logout-button';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Painel' };

export default async function PainelPage() {
  const usuario = await obterAdminParaPagina();
  if (!usuario) redirect('/login');

  return (
    <div className="min-h-svh flex-1 bg-background">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5 sm:px-10">
          <BrandGunp compacta />
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-20">
        <p className="mb-4 text-xs font-semibold tracking-[0.16em] text-accent uppercase">Acesso administrativo</p>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight break-words sm:text-4xl">Boas-vindas, {usuario.nome}.</h1>
        <p className="mt-4 text-base leading-7 text-muted">Você está conectado ao GUNP.</p>
        <section aria-labelledby="identificacao-titulo" className="mt-10 max-w-xl rounded-xl border border-white/10 bg-[#1b232a] p-6 sm:p-8">
          <h2 id="identificacao-titulo" className="flex items-center gap-3 text-lg font-medium">
            <ShieldCheck aria-hidden="true" size={24} strokeWidth={2} className="text-accent" />Sua identificação
          </h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">Nome</dt><dd className="break-all">{usuario.nome}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">Matrícula</dt><dd className="break-all">{usuario.matricula}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">Perfil</dt><dd>Administrador</dd></div>
          </dl>
        </section>
      </main>
    </div>
  );
}
