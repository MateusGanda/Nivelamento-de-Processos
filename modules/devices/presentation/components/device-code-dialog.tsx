'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Check, Copy, KeyRound, LoaderCircle, X } from 'lucide-react';
import type { Dispositivo } from '../../domain/dispositivo';
import { ErroApiDispositivos, gerarNovoCodigoDispositivo } from '../api-client';

// Duas situações: confirmar a troca do código de uma TV, ou mostrar o código recém-gerado (uma única vez).
export type PedidoCodigo =
  | { modo: 'confirmar'; dispositivo: Dispositivo; seq: number }
  | { modo: 'exibir'; dispositivo: Dispositivo; codigo: string; seq: number };

export function DeviceCodeDialog({ dialogRef, pedido, aoGerar, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoCodigo | null;
  aoGerar: (resultado: { dispositivo: Dispositivo; codigo: string }) => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setErro('');
    setCopiado(false);
    if (!dialog.open) dialog.showModal();
  }, [pedido, dialogRef]);

  async function confirmar() {
    if (!pedido || pedido.modo !== 'confirmar' || emEnvio.current) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      aoGerar(await gerarNovoCodigoDispositivo(pedido.dispositivo.id));
    } catch (falha) {
      if (falha instanceof ErroApiDispositivos && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiDispositivos ? falha.message : 'Não foi possível gerar o código. Verifique sua conexão e tente novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  async function copiar(codigo: string) {
    try { await navigator.clipboard.writeText(codigo); setCopiado(true); } catch { setCopiado(false); }
  }

  const botaoSecundario = 'min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';

  return (
    <dialog
      id="codigo-dispositivo" ref={dialogRef} aria-labelledby="codigo-dispositivo-titulo"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClose={aoFechar}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="codigo-dispositivo-titulo" className="text-xl font-semibold">{pedido?.modo === 'exibir' ? 'Código de acesso da TV' : 'Gerar novo código'}</h2>
        <button type="button" onClick={() => { if (!emEnvio.current) dialogRef.current?.close(); }} disabled={enviando} aria-label="Fechar" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      {pedido?.modo === 'exibir' ? (
        <div className="space-y-5 p-6">
          <p className="text-sm leading-6 text-muted">Na TV <strong className="text-foreground">{pedido.dispositivo.nome}</strong>, abra o endereço <strong className="text-foreground">/tv</strong> do sistema e digite este código. Ele aparece só agora: anote ou copie antes de fechar.</p>
          <p className="rounded-lg border border-accent/40 bg-accent/10 py-5 text-center font-mono text-3xl font-bold tracking-[0.2em]" aria-label={`Código ${pedido.codigo}`}>{pedido.codigo}</p>
          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <button type="button" onClick={() => dialogRef.current?.close()} className={botaoSecundario}>Fechar</button>
            <button type="button" onClick={() => void copiar(pedido.codigo)} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {copiado ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}{copiado ? 'Copiado' : 'Copiar código'}
            </button>
          </div>
        </div>
      ) : pedido ? (
        <div className="space-y-5 p-6">
          <p className="flex items-start gap-2 text-sm leading-6 text-[#ffcf99]"><AlertTriangle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />A TV <strong>{pedido.dispositivo.nome}</strong> perde o acesso na próxima atualização e só volta a funcionar com o código novo.</p>
          {erro && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={enviando} className={botaoSecundario}>Cancelar</button>
            <button type="button" onClick={() => void confirmar()} disabled={enviando} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
              {enviando ? <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" /> : <KeyRound aria-hidden="true" size={18} />}Gerar novo código
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
