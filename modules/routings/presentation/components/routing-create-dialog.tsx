'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { cadastrarRoteiro, ErroApiRoteiros } from '../api-client';

export function RoutingCreateDialog({ dialogRef, botaoRef }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  botaoRef: RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    if (!nome.trim()) {
      setErro('Informe o nome do roteiro.');
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      const roteiro = await cadastrarRoteiro(nome);
      // O roteiro nasce sem etapas; a tela do roteiro é onde elas são montadas.
      router.push(`/painel/roteiros/${roteiro.id}`);
    } catch (falha) {
      emEnvio.current = false;
      setEnviando(false);
      if (falha instanceof ErroApiRoteiros && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiRoteiros ? falha.message : 'Não foi possível confirmar o cadastro. Verifique sua conexão e tente novamente.');
      }
    }
  }

  const campo = 'mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

  return (
    <dialog
      id="cadastro-roteiro" ref={dialogRef} aria-labelledby="cadastro-roteiro-titulo" aria-describedby="cadastro-roteiro-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setNome(''); setErro(''); botaoRef.current?.focus(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="cadastro-roteiro-titulo" className="text-xl font-semibold">Adicionar roteiro</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label="Fechar cadastro" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={cadastrar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="cadastro-roteiro-descricao" className="text-sm leading-6 text-muted">O roteiro é criado na versão 1, ativo e sem etapas. Depois do cadastro, a tela do roteiro abre para você adicionar as etapas.</p>
        <div>
          <label htmlFor="roteiro-nome" className="block text-sm font-medium">Nome</label>
          <input id="roteiro-nome" name="nome" type="text" autoComplete="off" required value={nome} onChange={(event) => setNome(event.target.value)} disabled={enviando} className={campo} aria-describedby={erro ? 'cadastro-roteiro-erro' : 'roteiro-nome-ajuda'} />
          <p id="roteiro-nome-ajuda" className="mt-2 text-xs leading-5 text-muted">Para mudar um roteiro existente, abra-o e use Nova versão.</p>
        </div>
        {erro && <p id="cadastro-roteiro-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={enviando} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}{enviando ? 'Cadastrando…' : 'Cadastrar roteiro'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
