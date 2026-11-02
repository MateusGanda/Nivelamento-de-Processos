'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, Pause, RefreshCw } from 'lucide-react';
import { ErroApiIlha, listarMotivosPausa } from '../api-client';

const secundario = 'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 text-base font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60';

// Montado a cada abertura: motivos não ficam em cache entre pausas ou operadores.
export function IlhaPausa({ ocupado, aoCancelar, aoConfirmar, aoFalhar }: {
  ocupado: boolean;
  aoCancelar: () => void;
  aoConfirmar: (motivoId: string) => void;
  aoFalhar: (falha: unknown) => void;
}) {
  const [motivos, setMotivos] = useState<{ id: string; nome: string }[] | null>(null);
  const [motivoId, setMotivoId] = useState('');
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void listarMotivosPausa(controller.signal).then((dados) => {
      if (!controller.signal.aborted) setMotivos(dados);
    }).catch((falha: unknown) => {
      if (controller.signal.aborted) return;
      setErro(falha instanceof ErroApiIlha ? falha.message : 'Não foi possível carregar os motivos. Verifique a conexão e tente novamente.');
      if (falha instanceof ErroApiIlha && (falha.status === 401 || falha.status === 503)) aoFalhar(falha);
    });
    return () => controller.abort();
  }, [aoFalhar, tentativa]);

  function recarregar() {
    setMotivos(null);
    setMotivoId('');
    setErro('');
    setTentativa((atual) => atual + 1);
  }

  const carregando = motivos === null && !erro;

  return (
    <fieldset className="space-y-3 border-t border-white/10 pt-5">
      <legend className="mb-2 text-lg font-semibold">Motivo da pausa</legend>
      {erro ? <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/30 bg-[#f49a8a]/10 p-4 text-base leading-7 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={22} strokeWidth={2} className="mt-1 shrink-0" />{erro}</p>
        : carregando ? <p role="status" className="flex items-center gap-3 text-base text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando motivos…</p>
        : motivos?.length === 0 ? <p role="status" className="text-base text-[#ffcf99]">Nenhum motivo de pausa ativo disponível. Peça ao administrador para cadastrar ou ativar os motivos e atualize a lista.</p>
        : <div className="grid gap-2 sm:grid-cols-2">{motivos?.map((motivo) => (
          <button key={motivo.id} type="button" disabled={ocupado} aria-pressed={motivo.id === motivoId} onClick={() => setMotivoId(motivo.id)}
            className={`min-h-12 cursor-pointer rounded-lg border px-4 py-3 text-left text-base focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${motivo.id === motivoId ? 'border-accent bg-accent/10' : 'border-[#3b454e] hover:border-accent'}`}>{motivo.nome}</button>
        ))}</div>}
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={aoCancelar} disabled={ocupado} className={secundario}>Cancelar</button>
        <button type="button" onClick={recarregar} disabled={carregando || ocupado} className={secundario}><RefreshCw aria-hidden="true" size={20} strokeWidth={2} />{erro ? 'Tentar novamente' : 'Atualizar motivos'}</button>
        <button type="button" disabled={!motivoId || carregando || !!erro || ocupado} onClick={() => { if (motivoId) aoConfirmar(motivoId); }}
          className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#ffcf99] px-5 text-lg font-semibold text-[#2a1d0c] hover:bg-[#ffdcb3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"><Pause aria-hidden="true" size={22} strokeWidth={2} />Confirmar pausa</button>
      </div>
    </fieldset>
  );
}
