'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { AlertCircle, LoaderCircle, Lock, X } from 'lucide-react';
import type { EtapaDoRoteiro, ProdutoDoRoteiro, TempoInformado } from '../../domain/roteiro';
import { lerTempoDigitado } from '../listing';

// seq permite reabrir o mesmo produto.
export type PedidoTemposPadrao = { produto: ProdutoDoRoteiro; seq: number };

export function TemposPadraoDialog({ dialogRef, pedido, etapas, salvar, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoTemposPadrao | null;
  etapas: readonly EtapaDoRoteiro[];
  salvar: (produtoId: string, tempos: TempoInformado[]) => Promise<string | null>;
  aoFechar: () => void;
}) {
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');
  const produto = pedido?.produto ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setValores(Object.fromEntries(pedido.produto.tempos.map((tempo) => [tempo.etapaId, String(tempo.tempoPadrao).replace('.', ',')])));
    setErro('');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input')?.focus();
  }, [pedido, dialogRef]);

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current || !produto || produto.travado) return;
    const tempos: TempoInformado[] = [];
    for (const etapa of etapas) {
      const lido = lerTempoDigitado(valores[etapa.id] ?? '');
      if (lido === undefined) {
        setErro(`Tempo inválido na etapa ${etapa.ordem} (${etapa.operacao.nome}). Use segundos maiores que zero, com até duas casas decimais.`);
        return;
      }
      tempos.push({ etapaId: etapa.id, tempoPadrao: lido });
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    const falha = await salvar(produto.id, tempos);
    emEnvio.current = false;
    setEnviando(false);
    if (falha) setErro(falha);
    else dialogRef.current?.close();
  }

  const campo = 'h-11 w-36 rounded-lg border border-[#3b454e] bg-background px-3 text-right text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

  return (
    <dialog
      id="tempos-padrao" ref={dialogRef} aria-labelledby="tempos-padrao-titulo" aria-describedby="tempos-padrao-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="tempos-padrao-titulo" className="text-xl font-semibold">{produto ? `Tempos padrão – ${produto.codigo}` : 'Tempos padrão'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label="Fechar tempos padrão" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="tempos-padrao-descricao" className="text-sm leading-6 text-muted">
          Tempo padrão de cada etapa para {produto?.nome ?? 'o produto'}, em segundos por unidade produzida. Deixe em branco a etapa que ainda não tem tempo definido.
        </p>
        {produto?.travado && (
          <p className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-[#c1c8cf]">
            <Lock aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
            Este produto já tem ordens com esta versão do roteiro, por isso os tempos estão travados. Para mudá-los, use Nova versão.
          </p>
        )}
        {etapas.length === 0 ? <p className="text-sm text-muted">O roteiro ainda não tem etapas salvas.</p> : (
          <ol className="divide-y divide-white/5 rounded-lg border border-white/10">
            {etapas.map((etapa) => (
              <li key={etapa.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <label htmlFor={`tempo-${etapa.id}`} className="min-w-0 text-sm"><span className="font-medium">{etapa.ordem}.</span> {etapa.operacao.nome}</label>
                <span className="flex shrink-0 items-center gap-2">
                  <input id={`tempo-${etapa.id}`} type="text" inputMode="decimal" autoComplete="off" value={valores[etapa.id] ?? ''} placeholder="sem tempo"
                    onChange={(event) => setValores((atual) => ({ ...atual, [etapa.id]: event.target.value }))}
                    disabled={enviando || produto?.travado} aria-describedby="tempos-padrao-unidade" className={campo} />
                  <span aria-hidden="true" className="w-6 text-sm text-muted">s</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p id="tempos-padrao-unidade" className="sr-only">Segundos por unidade produzida.</p>
        {erro && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">{produto?.travado ? 'Fechar' : 'Cancelar'}</button>
          {!produto?.travado && (
            <button type="submit" disabled={enviando || etapas.length === 0} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
              {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}{enviando ? 'Salvando…' : 'Salvar tempos'}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
