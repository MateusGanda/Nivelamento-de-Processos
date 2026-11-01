'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { destinosPainel, gruposPainel, hrefDestinoPainel } from '../painel-navigation';
import { BrandGunp } from './brand-gunp';
import { LogoutButton } from './logout-button';
import { PainelIcon } from './painel-icon';

function MenuPainel({ pathname, recolhido = false, aoNavegar }: { pathname: string; recolhido?: boolean; aoNavegar?: () => void }) {
  return (
    <nav aria-label="Navegação administrativa" className="min-h-0 flex-1 overflow-y-auto px-2 py-5">
      {gruposPainel.map((grupo) => (
        <div key={grupo} className={grupo === 'Início' ? '' : 'mt-4 border-t border-white/10 pt-4'}>
          {grupo !== 'Início' && <p className={recolhido ? 'sr-only' : 'mb-2 px-4 text-xs tracking-wide text-muted'}>{grupo}</p>}
          <ul className="space-y-1">
            {destinosPainel.filter((destino) => destino.grupo === grupo).map((destino) => {
              const href = hrefDestinoPainel(destino);
              const ativo = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href} prefetch={false} onClick={aoNavegar}
                    aria-current={ativo ? 'page' : undefined}
                    title={recolhido ? destino.titulo : undefined}
                    className={`relative flex min-h-11 items-center gap-3 rounded-lg border-l-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${recolhido ? 'justify-center px-2' : 'px-4'} ${ativo ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-transparent text-[#c1c8cf] hover:bg-white/5 hover:text-foreground'}`}
                  >
                    <PainelIcon icone={destino.icone} className="shrink-0" />
                    <span className={recolhido ? 'sr-only' : ''}>{destino.titulo}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ usuario, children }: { usuario: { nome: string; matricula: string }; children: ReactNode }) {
  const pathname = usePathname();
  const [recolhido, setRecolhido] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const abrirMenuRef = useRef<HTMLButtonElement>(null);
  const usuarioRef = useRef<HTMLDetailsElement>(null);
  const conteudoRef = useRef<HTMLElement>(null);
  const partesNome = usuario.nome.trim().split(/\s+/);
  const iniciais = `${partesNome[0]?.[0] ?? ''}${partesNome.length > 1 ? partesNome.at(-1)?.[0] ?? '' : ''}`.toLocaleUpperCase('pt-BR');

  function fecharMenu() {
    drawerRef.current?.close();
  }

  useEffect(() => {
    // Fechar o drawer ao passar para o desktop evita manter a página inert
    // enquanto um dialog fica escondido por um breakpoint.
    const desktop = window.matchMedia('(min-width: 1024px)');
    const ajustarMenu = () => {
      if (desktop.matches && drawerRef.current?.open) drawerRef.current.close();
    };
    desktop.addEventListener('change', ajustarMenu);
    const fecharIdentificacao = (event: PointerEvent) => {
      if (event.target instanceof Node && !usuarioRef.current?.contains(event.target)) {
        usuarioRef.current?.removeAttribute('open');
      }
    };
    document.addEventListener('pointerdown', fecharIdentificacao);
    return () => {
      desktop.removeEventListener('change', ajustarMenu);
      document.removeEventListener('pointerdown', fecharIdentificacao);
    };
  }, []);

  useEffect(() => {
    drawerRef.current?.close();
    usuarioRef.current?.removeAttribute('open');
    conteudoRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="relative flex h-dvh min-h-0 min-w-0 flex-1 overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      <a href="#painel-conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:font-medium focus:text-[#171b1f]">Ir para o conteúdo</a>
      <aside aria-label="Menu lateral" className={`hidden h-full shrink-0 print:hidden! flex-col border-r border-white/10 bg-[#11171c] lg:flex ${recolhido ? 'w-20' : 'w-[260px]'}`}>
        <Link href="/painel" prefetch={false} aria-label="GUNP — Início" className="flex h-16 shrink-0 items-center justify-center border-b border-white/10 px-4 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent">
          <BrandGunp variante="painel" compacta={recolhido} />
        </Link>
        <div id="menu-desktop" className="flex min-h-0 flex-1 flex-col"><MenuPainel pathname={pathname} recolhido={recolhido} /></div>
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button" onClick={() => setRecolhido(!recolhido)}
            aria-expanded={!recolhido} aria-controls="menu-desktop"
            aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'} title={recolhido ? 'Expandir menu' : undefined}
            className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${recolhido ? 'justify-center' : 'px-3'}`}
          >
            {recolhido ? <PanelLeftOpen aria-hidden="true" size={20} strokeWidth={2} /> : <PanelLeftClose aria-hidden="true" size={20} strokeWidth={2} />}
            <span className={recolhido ? 'sr-only' : ''}>{recolhido ? 'Expandir menu' : 'Recolher menu'}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col print:block">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 print:hidden border-b border-white/10 bg-[#11171c]/80 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={abrirMenuRef} type="button" aria-label="Abrir menu" aria-haspopup="dialog" aria-controls="menu-mobile"
              onClick={() => { if (!drawerRef.current?.open) drawerRef.current?.showModal(); }}
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
            ><Menu aria-hidden="true" size={24} strokeWidth={2} /></button>
            <div className="lg:hidden"><BrandGunp variante="painel" /></div>
            <span className="hidden text-xs tracking-wide text-muted lg:block">Área administrativa</span>
          </div>

          <details
            ref={usuarioRef} className="relative shrink-0"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.currentTarget.removeAttribute('open');
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}
          >
            <summary
              aria-label={`Identificação de ${usuario.nome}`} aria-controls="identificacao-usuario"
              className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-2 text-sm hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"
            >
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3b454e] text-xs font-semibold">{iniciais}</span>
              <span title={usuario.nome} className="hidden max-w-56 truncate sm:block">{usuario.nome}</span>
              <ChevronDown aria-hidden="true" size={16} strokeWidth={2} className="shrink-0 text-muted" />
            </summary>
            <div id="identificacao-usuario" className="absolute top-full right-0 z-30 mt-2 max-h-[calc(100dvh-88px)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-5 shadow-xl">
              <p className="text-xs tracking-wide text-accent uppercase">Sua identificação</p>
              <p className="mt-3 text-sm font-semibold break-words">{usuario.nome}</p>
              <p className="mt-2 text-sm break-all text-muted">Matrícula: {usuario.matricula}</p>
              <p className="mt-1 text-sm text-muted">Administrador</p>
              <div className="mt-5 border-t border-white/10 pt-4"><LogoutButton /></div>
            </div>
          </details>
        </header>
        <main id="painel-conteudo" ref={conteudoRef} tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8 print:overflow-visible print:p-0">{children}</main>
      </div>

      <dialog
        id="menu-mobile" ref={drawerRef} aria-labelledby="menu-mobile-titulo"
        onClose={() => abrirMenuRef.current?.focus()}
        onClick={(event) => { if (event.target === event.currentTarget) fecharMenu(); }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(320px,calc(100vw-48px))] max-w-none border-0 border-r border-white/10 bg-[#11171c] p-0 text-foreground backdrop:bg-black/65"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-5">
            <span id="menu-mobile-titulo" className="sr-only">Menu administrativo GUNP</span>
            <BrandGunp variante="painel" />
            <button type="button" onClick={fecharMenu} aria-label="Fechar menu" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
          </div>
          <MenuPainel pathname={pathname} aoNavegar={fecharMenu} />
        </div>
      </dialog>
    </div>
  );
}
