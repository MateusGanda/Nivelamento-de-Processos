'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, Tv } from 'lucide-react';
import { BrandGunp } from '../../../access/presentation/components/brand-gunp';
import { ErroApiDispositivos, liberarTv } from '../api-client';

// Primeira abertura da TV: alguém digita uma vez o código gerado no painel (TVs).
export function TvAcesso() {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function liberar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current || !codigo.trim()) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      await liberarTv(codigo);
      setCodigo('');
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof ErroApiDispositivos ? falha.message : 'Não foi possível liberar a TV. Verifique a conexão e tente novamente.');
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <section aria-labelledby="tv-acesso-titulo" className="w-full max-w-md rounded-xl border border-[#2b353e] bg-[#192128]/80 p-6 sm:p-8">
        <BrandGunp variante="painel" />
        <h1 id="tv-acesso-titulo" className="mt-6 text-2xl font-semibold">Painel de TV</h1>
        <form onSubmit={liberar} aria-busy={enviando} className="mt-4 space-y-5">
          <p className="text-sm leading-6 text-muted">Esta TV ainda não está liberada. Digite o código gerado no painel do administrador, em TVs. Depois disso, a tela se atualiza sozinha.</p>
          <div>
            <label htmlFor="tv-codigo" className="block text-sm font-medium">Código de acesso</label>
            <input id="tv-codigo" autoComplete="off" autoCapitalize="characters" spellCheck={false} required value={codigo} onChange={(event) => setCodigo(event.target.value)} disabled={enviando}
              placeholder="ABCDE-FGH23" maxLength={20}
              className="mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 font-mono text-lg tracking-widest uppercase outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60" aria-describedby={erro ? 'tv-codigo-erro' : undefined} />
          </div>
          {erro && <p id="tv-codigo-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
          <button type="submit" disabled={enviando || !codigo.trim()} className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-base font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60">
            {enviando ? <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" /> : <Tv aria-hidden="true" size={20} strokeWidth={2} />}Liberar TV
          </button>
        </form>
      </section>
    </main>
  );
}
