import { Cog } from 'lucide-react';

export function BrandGunp({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Cog aria-hidden="true" strokeWidth={2} className={compacta ? 'mb-2 size-9 text-accent' : 'mb-4 size-16 text-accent sm:size-20'} />
      <span className={compacta ? 'text-xl font-bold tracking-[0.12em]' : 'text-5xl font-bold tracking-[0.09em] sm:text-6xl'}>GUNP</span>
      {!compacta && (
        <p className="mt-4 max-w-72 text-xs leading-5 font-medium tracking-[0.13em] text-muted uppercase">
          Gerenciamento de Nivelamento<br />de Processos
        </p>
      )}
    </div>
  );
}
