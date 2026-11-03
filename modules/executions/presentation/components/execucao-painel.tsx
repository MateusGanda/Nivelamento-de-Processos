import Link from 'next/link';
import { ExternalLink, Play } from 'lucide-react';

// Atalho do painel para a ilha. A ilha fica fora do painel e continua exigindo a chave do terminal.
export function ExecucaoPainel() {
  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <h1 className="text-2xl font-semibold tracking-tight">Execução</h1>
      <section aria-labelledby="execucao-ilha-titulo" className="mt-7 max-w-3xl rounded-lg border border-[#2b353e] bg-[#192128]/65 p-6 sm:p-10">
        <div className="mb-6 flex size-14 items-center justify-center rounded-xl bg-accent/10 text-accent"><Play aria-hidden="true" size={28} strokeWidth={2} /></div>
        <h2 id="execucao-ilha-titulo" className="text-xl font-semibold">Ilha de apontamento</h2>
        <p className="mt-3 text-base leading-7 text-muted">
          Na ilha, o operador se identifica pelo crachá ou pela matrícula e registra o início, as pausas, a retomada, a troca de operação e a baixa de cada etapa.
        </p>
        <p className="mt-3 text-base leading-7 text-muted">
          A ilha abre em uma nova aba, fora do painel. No primeiro acesso, o computador é liberado com a chave do terminal.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="/ilha" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] transition-colors hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <ExternalLink aria-hidden="true" size={20} strokeWidth={2} />Abrir a ilha de apontamento<span className="sr-only"> (abre em uma nova aba)</span>
          </a>
          <Link href="/painel/indicadores" prefetch={false} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-center text-sm font-medium transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            Ver a posição das ordens em Indicadores
          </Link>
        </div>
      </section>
    </div>
  );
}
