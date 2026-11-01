'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, LoaderCircle } from 'lucide-react';
import { BrandGunp } from '../../../access/presentation/components/brand-gunp';
import { ErroApiIlha, liberarTerminal } from '../api-client';

export function IlhaAcesso({ configurada }: { configurada: boolean }) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [chave, setChave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function liberar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current || !chave) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      await liberarTerminal(chave);
      setChave('');
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof ErroApiIlha ? falha.message : 'Não foi possível liberar o terminal. Verifique a conexão e tente novamente.');
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <section aria-labelledby="ilha-acesso-titulo" className="w-full max-w-md rounded-xl border border-[#2b353e] bg-[#192128]/80 p-6 sm:p-8">
        <BrandGunp variante="painel" />
        <h1 id="ilha-acesso-titulo" className="mt-6 text-2xl font-semibold">Ilha de apontamento</h1>
        {configurada ? (
          <form onSubmit={liberar} aria-busy={enviando} className="mt-4 space-y-5">
            <p className="text-sm leading-6 text-muted">Este terminal ainda não está liberado. Quem tiver a chave da ilha digita uma vez e o terminal fica liberado por 30 dias, só para apontamentos.</p>
            <div>
              <label htmlFor="ilha-chave" className="block text-sm font-medium">Chave da ilha</label>
              <input id="ilha-chave" type="password" autoComplete="off" required value={chave} onChange={(event) => setChave(event.target.value)} disabled={enviando}
                className="mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60" aria-describedby={erro ? 'ilha-chave-erro' : undefined} />
            </div>
            {erro && <p id="ilha-chave-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
            <button type="submit" disabled={enviando || !chave} className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-base font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60">
              {enviando ? <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" /> : <KeyRound aria-hidden="true" size={20} strokeWidth={2} />}Liberar terminal
            </button>
          </form>
        ) : (
          <p role="alert" className="mt-4 text-sm leading-6 text-[#ffcf99]">A ilha ainda não foi configurada no servidor. O responsável pelo sistema precisa definir a variável ILHA_CHAVE.</p>
        )}
      </section>
    </main>
  );
}
