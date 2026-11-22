import { useLayoutEffect, useRef, type ReactNode } from 'react';

export function TabelaComRolagem({ legenda, chaveRolagem, className = '', children }: {
  legenda: string;
  chaveRolagem: string;
  className?: string;
  children: ReactNode;
}) {
  const area = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (area.current) area.current.scrollTop = 0;
  }, [chaveRolagem]);

  return (
    <div
      ref={area}
      role="region"
      aria-label={legenda}
      tabIndex={0}
      className={`tabela-com-rolagem max-w-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${className}`}
    >
      {children}
    </div>
  );
}
