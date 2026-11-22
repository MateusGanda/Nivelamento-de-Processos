'use client';

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Ellipsis, type LucideIcon } from 'lucide-react';

type AcaoRegistro = {
  rotulo: string;
  icone: LucideIcon;
  indisponivel?: boolean;
  motivo?: string;
} & ({ executar: (botao: HTMLButtonElement) => void; href?: never } | { href: string; executar?: never });

export function MenuAcoesRegistro({ registro, acoes }: { registro: string; acoes: readonly AcaoRegistro[] }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const abrirNoFim = useRef(false);
  const id = useId();

  function fechar() {
    setAberto(false);
    botao.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!aberto || !botao.current || !menu.current) return;
    const gatilho = botao.current;
    const painel = menu.current;
    const origem = gatilho.getBoundingClientRect();
    const largura = painel.offsetWidth;
    const altura = painel.offsetHeight;
    const margem = 8;
    painel.style.left = `${Math.max(margem, Math.min(origem.left, window.innerWidth - largura - margem))}px`;
    const acima = origem.top - altura - margem;
    const abaixo = origem.bottom + margem;
    const topo = abaixo + altura <= window.innerHeight - margem ? abaixo : acima;
    painel.style.top = `${Math.max(margem, Math.min(topo, window.innerHeight - altura - margem))}px`;
    const opcoes = painel.querySelectorAll<HTMLElement>('[role="menuitem"]');
    opcoes[abrirNoFim.current ? opcoes.length - 1 : 0]?.focus();

    function aoSair(evento: Event) {
      const alvo = evento.target as Node | null;
      if (alvo && (painel.contains(alvo) || gatilho.contains(alvo))) return;
      setAberto(false);
    }
    function aoMover(evento: Event) {
      if (evento.target instanceof Node && painel.contains(evento.target)) return;
      setAberto(false);
      if (painel.contains(document.activeElement)) gatilho.focus({ preventScroll: true });
    }
    document.addEventListener('pointerdown', aoSair);
    document.addEventListener('focusin', aoSair);
    document.addEventListener('scroll', aoMover, true);
    window.addEventListener('resize', aoMover);
    return () => {
      document.removeEventListener('pointerdown', aoSair);
      document.removeEventListener('focusin', aoSair);
      document.removeEventListener('scroll', aoMover, true);
      window.removeEventListener('resize', aoMover);
      if (painel.contains(document.activeElement)) {
        if (gatilho.isConnected) gatilho.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>('#painel-conteudo')?.focus({ preventScroll: true });
      }
    };
  }, [aberto]);

  function navegar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      fechar();
      return;
    }
    if (evento.key === 'Tab') {
      fechar();
      return;
    }
    if (evento.key === ' ') {
      evento.preventDefault();
      (document.activeElement as HTMLElement)?.click();
      return;
    }
    const opcoes = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const atual = opcoes.indexOf(document.activeElement as HTMLElement);
    const destinos: Record<string, number> = {
      ArrowDown: (atual + 1) % opcoes.length,
      ArrowUp: (atual - 1 + opcoes.length) % opcoes.length,
      Home: 0,
      End: opcoes.length - 1,
    };
    if (evento.key in destinos) {
      evento.preventDefault();
      opcoes[destinos[evento.key]]?.focus();
    }
  }

  const classeItem = 'flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm outline-none hover:bg-foreground/5 focus-visible:bg-accent/15 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent aria-disabled:cursor-not-allowed aria-disabled:text-muted';

  return (
    <>
      <button
        ref={botao} type="button" aria-label={`Ações de ${registro}`} aria-haspopup="menu"
        aria-expanded={aberto} aria-controls={aberto ? id : undefined}
        onClick={() => { abrirNoFim.current = false; setAberto((atual) => !atual); }}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
            evento.preventDefault();
            abrirNoFim.current = evento.key === 'ArrowUp';
            setAberto(true);
          }
        }}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-line hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      ><Ellipsis aria-hidden="true" size={20} /></button>
      {aberto && createPortal(
        <div ref={menu} id={id} role="menu" aria-label={`Ações de ${registro}`} onKeyDown={navegar}
          className="fixed z-50 max-h-[calc(100dvh-16px)] w-60 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-line-raised bg-raised p-1 text-foreground shadow-lg">
          {acoes.map((acao) => {
            const Icone = acao.icone;
            const conteudo = (
              <>
                <Icone aria-hidden="true" size={16} className="shrink-0" />
                <span>
                  {acao.rotulo}
                  {acao.indisponivel && acao.motivo && <span className="mt-1 block text-xs">{acao.motivo}</span>}
                </span>
              </>
            );
            if (acao.href && !acao.indisponivel) return (
              <Link key={acao.rotulo} href={acao.href} role="menuitem" tabIndex={-1} className={classeItem}
                onClick={() => setAberto(false)}>{conteudo}</Link>
            );
            return (
              <button key={acao.rotulo} type="button" role="menuitem" tabIndex={-1} aria-disabled={acao.indisponivel || undefined}
                className={classeItem} onClick={() => {
                  if (acao.indisponivel || !botao.current) return;
                  fechar();
                  acao.executar?.(botao.current);
                }}>{conteudo}</button>
            );
          })}
        </div>, document.body,
      )}
    </>
  );
}
