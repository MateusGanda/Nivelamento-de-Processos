'use client';

import { AlertCircle } from 'lucide-react';
import { BrandGunp } from './brand-gunp';

export default function AccessError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md text-center">
        <BrandGunp />
        <AlertCircle aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mt-10 text-accent" />
        <h1 className="mt-4 text-2xl font-semibold">Não foi possível carregar o acesso</h1>
        <p className="mt-3 text-base leading-7 text-muted">O serviço está indisponível no momento. Tente novamente em instantes.</p>
        <button type="button" onClick={reset} className="mt-8 min-h-12 cursor-pointer rounded-lg bg-accent px-6 py-3 font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Tentar novamente</button>
      </div>
    </main>
  );
}
