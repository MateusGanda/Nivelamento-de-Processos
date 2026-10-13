'use client';

import { useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { LoaderCircle, LogOut } from 'lucide-react';

export function LogoutButton() {
  const emEnvio = useRef(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState('');

  async function sair() {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setSaindo(true);
    setErro('');
    try {
      await signOut({ callbackUrl: '/login' });
    } catch {
      setErro('Não foi possível sair. Tente novamente.');
    } finally {
      emEnvio.current = false;
      setSaindo(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={sair} disabled={saindo} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">
        {saindo ? <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" /> : <LogOut aria-hidden="true" size={20} strokeWidth={2} />}
        {saindo ? 'Saindo…' : 'Sair'}
      </button>
      {erro && <p role="alert" className="max-w-64 text-sm text-[#ffb4a5]">{erro}</p>}
    </div>
  );
}
