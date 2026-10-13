'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { cadastrarOperador, ErroApiOperadores } from '../api-client';

export function OperatorCreateDialog({ dialogRef, botaoRef, aoCadastrado }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  botaoRef: RefObject<HTMLButtonElement | null>;
  aoCadastrado: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [erro, setErro] = useState('');

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    if (!nome.trim() || !matricula.trim()) {
      setErro('Informe o nome e a matrícula do operador.');
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      await cadastrarOperador({ nome, matricula });
      dialogRef.current?.close();
      aoCadastrado();
    } catch (falha) {
      if (falha instanceof ErroApiOperadores && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiOperadores ? falha.message : 'Não foi possível confirmar o cadastro. Verifique sua conexão e tente novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const campo = 'mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';
  const botaoSecundario = 'min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';

  return (
    <dialog
      id="cadastro-operador" ref={dialogRef} aria-labelledby="cadastro-operador-titulo" aria-describedby="cadastro-operador-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setNome(''); setMatricula(''); setErro(''); botaoRef.current?.focus(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="cadastro-operador-titulo" className="text-xl font-semibold">Adicionar operador</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label="Fechar cadastro" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={cadastrar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="cadastro-operador-descricao" className="text-sm leading-6 text-muted">Preencha os dados de identificação. O novo operador será criado como ativo.</p>
        <div>
          <label htmlFor="operador-nome" className="block text-sm font-medium">Nome</label>
          <input id="operador-nome" name="nome" type="text" autoComplete="off" required value={nome} onChange={(event) => setNome(event.target.value)} disabled={enviando} className={campo} aria-describedby={erro ? 'cadastro-operador-erro' : undefined} />
        </div>
        <div>
          <label htmlFor="operador-matricula" className="block text-sm font-medium">Matrícula</label>
          <input id="operador-matricula" name="matricula" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={matricula} onChange={(event) => setMatricula(event.target.value)} disabled={enviando} className={campo} aria-describedby={erro ? 'cadastro-operador-erro' : 'operador-matricula-ajuda'} />
          <p id="operador-matricula-ajuda" className="mt-2 text-xs leading-5 text-muted">Única para cada operador. Letras maiúsculas e minúsculas são preservadas.</p>
        </div>
        {erro && <p id="cadastro-operador-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className={botaoSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}{enviando ? 'Cadastrando…' : 'Cadastrar operador'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
