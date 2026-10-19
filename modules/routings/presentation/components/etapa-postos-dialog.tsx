'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import type { EtapaDoRoteiro } from '../../domain/roteiro';
import type { Posto } from '../../../workstations/domain/posto';
import { listarPostos } from '../../../workstations/presentation/api-client';

// seq permite reabrir a mesma etapa.
export type PedidoPostosEtapa = { etapa: EtapaDoRoteiro; seq: number };

export function EtapaPostosDialog({ dialogRef, pedido, salvar, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoPostosEtapa | null;
  salvar: (etapaId: string, postoIds: string[]) => Promise<string | null>;
  aoFechar: () => void;
}) {
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [postos, setPostos] = useState<Posto[] | null>(null);
  const [erroPostos, setErroPostos] = useState('');
  const [erro, setErro] = useState('');
  const etapa = pedido?.etapa ?? null;

  // Os postos alimentam a lista de escolha; carregados uma vez ao montar a tela.
  useEffect(() => {
    const controller = new AbortController();
    listarPostos(controller.signal)
      .then((dados) => { if (!controller.signal.aborted) setPostos(dados); })
      .catch(() => { if (!controller.signal.aborted) setErroPostos('Não foi possível carregar os postos. Feche e abra novamente.'); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setSelecionados(new Set(pedido.etapa.postos.map((posto) => posto.id)));
    setErro('');
    if (!dialog.open) dialog.showModal();
  }, [pedido, dialogRef]);

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current || !etapa || !postos) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    // Mantém a ordem da lista exibida.
    const falha = await salvar(etapa.id, opcoes.filter((posto) => selecionados.has(posto.id)).map((posto) => posto.id));
    emEnvio.current = false;
    setEnviando(false);
    if (falha) setErro(falha);
    else dialogRef.current?.close();
  }

  // Postos inativos só aparecem quando já estão ligados à etapa, para poderem ser retirados.
  const ligados = new Set(etapa?.postos.map((posto) => posto.id) ?? []);
  const opcoes = (postos ?? []).filter((posto) => posto.ativo || ligados.has(posto.id));

  return (
    <dialog
      id="postos-etapa" ref={dialogRef} aria-labelledby="postos-etapa-titulo" aria-describedby="postos-etapa-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="postos-etapa-titulo" className="text-xl font-semibold">{etapa ? `Postos da etapa ${etapa.ordem} – ${etapa.operacao.nome}` : 'Postos da etapa'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label="Fechar postos da etapa" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="postos-etapa-descricao" className="text-sm leading-6 text-muted">Marque os postos onde esta etapa pode ser feita. A carga pendente da etapa é dividida entre os postos ativos marcados.</p>
        {postos === null && !erroPostos && <p role="status" className="flex items-center gap-2 text-sm text-muted"><LoaderCircle aria-hidden="true" size={18} strokeWidth={2} className="motion-safe:animate-spin" />Carregando postos…</p>}
        {erroPostos && <p role="alert" className="text-sm text-[#ffb4a5]">{erroPostos}</p>}
        {postos !== null && opcoes.length === 0 && <p className="text-sm text-muted">Nenhum posto ativo cadastrado. Cadastre os postos antes de ligá-los às etapas.</p>}
        {opcoes.length > 0 && (
          <fieldset className="space-y-1">
            <legend className="mb-2 text-sm font-medium">Postos compatíveis</legend>
            {opcoes.map((posto) => (
              <label key={posto.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5">
                <input type="checkbox" checked={selecionados.has(posto.id)} onChange={() => alternar(posto.id)} disabled={enviando} className="size-4 accent-[#ff7a1a]" />
                <span className="text-sm"><span className="font-medium">{posto.codigo}</span> – {posto.nome} <span className="text-muted">({posto.setor.nome}{posto.ativo ? '' : ', inativo'})</span></span>
              </label>
            ))}
          </fieldset>
        )}
        {erro && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={enviando || postos === null} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}{enviando ? 'Salvando…' : 'Salvar postos'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
