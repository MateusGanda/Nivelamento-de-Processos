import Link from 'next/link';
import { ChevronRight, Cog } from 'lucide-react';
import { destinosPainel, hrefDestinoPainel } from '../painel-navigation';
import { PainelIcon } from './painel-icon';

export function PainelHome({ nome }: { nome: string }) {
  const primeiroNome = nome.trim().split(/\s+/)[0];
  const modulos = destinosPainel.filter((destino) => destino.grupo === 'Cadastros' || destino.grupo === 'Produção');

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
      <section aria-labelledby="boas-vindas-titulo" className="relative isolate mt-7 overflow-hidden rounded-lg border border-[#2b353e] bg-[linear-gradient(120deg,#1a2229_0%,#151c22_100%)] px-6 py-8 sm:px-8 sm:py-9">
        <Cog aria-hidden="true" size={290} strokeWidth={0.6} className="pointer-events-none absolute -top-11 -right-16 -z-10 rotate-12 text-[#34414c]/50" />
        <div aria-hidden="true" className="absolute -right-10 bottom-0 -z-10 h-0.5 w-56 -rotate-45 bg-accent/60" />
        <div aria-hidden="true" className="mb-4 h-1 w-8 rounded-full bg-accent" />
        <h2 id="boas-vindas-titulo" className="text-2xl leading-tight font-semibold tracking-tight break-words sm:text-[28px]">Bem-vindo, {primeiroNome}</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted sm:text-base">
          Acesse os módulos do sistema para organizar cadastros e acompanhar o processo de produção.
        </p>
      </section>
      <section aria-labelledby="modulos-titulo" className="mt-8">
        <h2 id="modulos-titulo" className="text-xl font-semibold tracking-tight">Módulos</h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modulos.map((modulo) => (
            <li key={modulo.slug} className="min-w-0">
              <Link
                href={hrefDestinoPainel(modulo)} prefetch={false}
                className="group flex h-full min-h-28 items-start gap-4 rounded-lg border border-[#2b353e] bg-[#192128]/65 p-5 transition-colors hover:border-accent/50 hover:bg-[#1e272f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-6"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><PainelIcon icone={modulo.icone} size={24} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold sm:text-base">{modulo.titulo}</span>
                  <span className="mt-1.5 block text-sm leading-6 text-muted">{modulo.descricao}</span>
                </span>
                <ChevronRight aria-hidden="true" size={20} strokeWidth={2} className="mt-1 shrink-0 text-muted transition-colors group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
