import { Cog } from 'lucide-react';

export function BrandGunp({ compacta = false, variante = 'padrao' }: { compacta?: boolean; variante?: 'padrao' | 'login' }) {
  const tamanhoIcone = compacta
    ? 'mb-2 size-9 text-accent'
    : variante === 'login'
      ? 'mb-2 size-14 text-accent sm:size-16'
      : 'mb-4 size-16 text-accent sm:size-20';
  const tamanhoNome = compacta
    ? 'text-xl font-bold tracking-[0.12em]'
    : variante === 'login'
      ? 'text-[40px] leading-none font-bold tracking-[0.09em] sm:text-5xl'
      : 'text-5xl font-bold tracking-[0.09em] sm:text-6xl';

  return (
    <div className="flex flex-col items-center text-center">
      <Cog aria-hidden="true" strokeWidth={2} className={tamanhoIcone} />
      <span className={tamanhoNome}>GUNP</span>
      {!compacta && (
        <p className={`${variante === 'login' ? 'mt-2 leading-4' : 'mt-4 leading-5'} max-w-72 text-xs font-medium tracking-[0.13em] text-muted uppercase`}>
          Gerenciamento de Nivelamento<br />de Processos
        </p>
      )}
    </div>
  );
}
