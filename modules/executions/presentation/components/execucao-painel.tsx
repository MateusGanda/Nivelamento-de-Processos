import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { ChaveIlhaPainel } from './chave-ilha-painel';
import { ExecucoesAcompanhamento } from './execucoes-acompanhamento';

// Página Execuções do painel: acompanhamento das execuções abertas (só leitura) e atalho para a ilha.
// A ilha fica fora do painel e continua exigindo a chave do terminal.
export function ExecucaoPainel() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
          <p className="mt-2 text-base leading-7 text-muted">
            Acompanhe quem está executando cada etapa agora. Os registros são feitos pelos operadores na ilha de apontamento, que abre em uma nova aba e é liberada com a chave do terminal.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a href="/ilha" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] transition-colors hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <ExternalLink aria-hidden="true" size={18} strokeWidth={2} />Abrir a ilha de apontamento<span className="sr-only"> (abre em uma nova aba)</span>
          </a>
          <Link href="/painel/indicadores" prefetch={false} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-center text-sm font-medium transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            Ver os indicadores
          </Link>
        </div>
      </div>
      <ExecucoesAcompanhamento />
      <ChaveIlhaPainel />
    </div>
  );
}
