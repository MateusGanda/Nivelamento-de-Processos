import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { DestinoPainel } from '../painel-navigation';
import { PainelIcon } from './painel-icon';

export function PainelPlaceholder({ modulo }: { modulo: DestinoPainel }) {
  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <h1 className="text-2xl font-semibold tracking-tight">{modulo.titulo}</h1>
      <section aria-labelledby="modulo-titulo" className="mt-7 max-w-3xl rounded-lg border border-[#2b353e] bg-[#192128]/65 p-6 sm:p-10">
        <div className="mb-6 flex size-14 items-center justify-center rounded-xl bg-accent/10 text-accent"><PainelIcon icone={modulo.icone} size={28} /></div>
        <h2 id="modulo-titulo" className="text-xl font-semibold">{modulo.titulo}</h2>
        <p className="mt-3 text-base leading-7 text-muted">{modulo.descricao}</p>
        <p className="mt-6 border-t border-white/10 pt-6 text-sm leading-7 text-muted">Esta funcionalidade será implementada em uma próxima etapa</p>
        <Link href="/painel" prefetch={false} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <ArrowLeft aria-hidden="true" size={20} strokeWidth={2} />Voltar ao início
        </Link>
      </section>
    </div>
  );
}
