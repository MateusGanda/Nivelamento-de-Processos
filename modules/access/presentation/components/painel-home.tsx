import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { destinosPainel, hrefDestinoPainel, type GrupoPainel } from '../painel-navigation';
import { PainelIcon } from './painel-icon';

const grupos: readonly { grupo: GrupoPainel; descricao: string }[] = [
  { grupo: 'Cadastros', descricao: 'Base usada pelos roteiros e pela ilha.' },
  { grupo: 'Produção', descricao: 'Planejamento, execução e painéis de TV.' },
];

export function PainelHome({ nome }: { nome: string }) {
  const primeiroNome = nome.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="border-b border-line-soft pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <p className="mt-1 text-sm text-muted">Olá, {primeiroNome}. Escolha um módulo para continuar.</p>
      </header>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {grupos.map(({ grupo, descricao }) => (
          <section key={grupo} aria-labelledby={`grupo-${grupo}`} className="min-w-0 rounded-lg border border-line-soft bg-surface">
            <div className="flex items-baseline justify-between gap-4 border-b border-line-soft px-5 py-3">
              <h2 id={`grupo-${grupo}`} className="text-sm font-semibold">{grupo}</h2>
              <p className="truncate text-xs text-muted">{descricao}</p>
            </div>
            <ul className="divide-y divide-line-soft">
              {destinosPainel.filter((destino) => destino.grupo === grupo).map((modulo) => (
                <li key={modulo.slug}>
                  <Link
                    href={hrefDestinoPainel(modulo)} prefetch={false}
                    className="group flex min-h-14 items-center gap-4 px-5 py-3 transition-colors hover:bg-foreground/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                  >
                    <PainelIcon icone={modulo.icone} size={20} className="shrink-0 text-muted group-hover:text-accent-ink" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{modulo.titulo}</span>
                      <span className="block text-sm text-muted">{modulo.descricao}</span>
                    </span>
                    <ChevronRight aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-muted group-hover:text-accent-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
