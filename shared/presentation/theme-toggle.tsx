'use client';

import { Moon, Sun } from 'lucide-react';
import { COOKIE_TEMA, valorCookieTema, type Tema } from './tema';

const UM_ANO = 60 * 60 * 24 * 365;

// Troca o tema na hora e guarda a escolha. Os ícones e os rótulos seguem o tema atual pelo CSS,
// então o botão não depende de estado no cliente e não diverge do que o servidor montou.
export function ThemeToggle({ className = '' }: { className?: string }) {
  function alternar() {
    const raiz = document.documentElement;
    const proximo: Tema = raiz.dataset.theme === 'light' ? 'dark' : 'light';
    raiz.dataset.theme = proximo;
    document.cookie = `${COOKIE_TEMA}=${valorCookieTema(proximo)}; path=/; max-age=${UM_ANO}; samesite=lax`;
  }

  return (
    <button
      type="button" onClick={alternar}
      className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      <Sun aria-hidden="true" size={20} strokeWidth={2} className="hidden dark:block" />
      <Moon aria-hidden="true" size={20} strokeWidth={2} className="dark:hidden" />
      <span className="sr-only dark:hidden">Usar tema escuro</span>
      <span className="hidden dark:inline sr-only">Usar tema claro</span>
    </button>
  );
}
