'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { cadastrarSetor, ErroApiSetores } from '../api-client';

export function SectorCreateDialog({ dialogRef, botaoRef, aoCadastrado }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  botaoRef: RefObject<HTMLButtonElement | null>;
  aoCadastrado: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState('');

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    if (!nome.trim()) {
      setErro('Informe o nome do setor.');
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      await cadastrarSetor({ nome, descricao });
      dialogRef.current?.close();
      aoCadastrado();
    } catch (falha) {
      if (falha instanceof ErroApiSetores && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiSetores ? falha.message : 'Não foi possível confirmar o cadastro. Verifique a lista e sua conexão antes de tentar novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const campo = 'mt-2 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

  return (
    <dialog
      id="cadastro-setor" ref={dialogRef} aria-labelledby="cadastro-setor-titulo" aria-describedby="cadastro-setor-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      }}
      onClose={() => { setNome(''); setDescricao(''); setErro(''); botaoRef.current?.focus(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="cadastro-setor-titulo" className="text-xl font-semibold">Adicionar setor</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label="Fechar cadastro" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={cadastrar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="cadastro-setor-descricao" className="text-sm leading-6 text-muted">Informe o nome do setor e, se desejar, uma descrição da área de produção.</p>
        <div>
          <label htmlFor="setor-nome" className="block text-sm font-medium">Nome</label>
          <input id="setor-nome" name="nome" type="text" autoComplete="off" required value={nome} onChange={(event) => setNome(event.target.value)} disabled={enviando} className={`${campo} h-12`} aria-describedby={erro ? 'cadastro-setor-erro' : 'setor-nome-ajuda'} />
          <p id="setor-nome-ajuda" className="mt-2 text-xs leading-5 text-muted">Use um nome único para identificar o setor.</p>
        </div>
        <div>
          <label htmlFor="setor-descricao" className="block text-sm font-medium">Descrição <span className="font-normal text-muted">(opcional)</span></label>
          <textarea id="setor-descricao" name="descricao" rows={3} value={descricao} onChange={(event) => setDescricao(event.target.value)} disabled={enviando} className={`${campo} min-h-28 resize-y py-3`} aria-describedby={erro ? 'cadastro-setor-erro' : undefined} />
        </div>
        {erro && <p id="cadastro-setor-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={enviando} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}{enviando ? 'Cadastrando…' : 'Cadastrar setor'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
