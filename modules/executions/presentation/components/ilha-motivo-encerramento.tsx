'use client';

import { useEffect, useState } from 'react';
import { ErroApiIlha, listarMotivosPausa } from '../api-client';

// Motivo do encerramento do turno. "Fim do turno" já vem marcado e não depende de cadastro; os demais são
// os motivos de pausa ativos (por exemplo, falta de material). Se a lista não carregar, o fim do turno
// continua disponível: o encerramento não fica bloqueado por isso.
export function IlhaMotivoEncerramento({ motivoId, aoMudar, ocupado, aoFalhar }: {
  motivoId: string | null;
  aoMudar: (motivoId: string | null) => void;
  ocupado: boolean;
  aoFalhar: (falha: unknown) => void;
}) {
  const [motivos, setMotivos] = useState<{ id: string; nome: string }[] | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void listarMotivosPausa(controller.signal).then((dados) => {
      if (!controller.signal.aborted) setMotivos(dados);
    }).catch((falha: unknown) => {
      if (controller.signal.aborted) return;
      setMotivos([]);
      setAviso('Não foi possível carregar os outros motivos. O encerramento pode ser feito como fim do turno.');
      if (falha instanceof ErroApiIlha && (falha.status === 401 || falha.status === 503)) aoFalhar(falha);
    });
    return () => controller.abort();
  }, [aoFalhar]);

  const opcao = (id: string | null, nome: string) => (
    <button key={id ?? 'fim-do-turno'} type="button" disabled={ocupado} aria-pressed={motivoId === id} onClick={() => aoMudar(id)}
      className={`min-h-12 cursor-pointer rounded-md border px-4 py-3 text-left text-base focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${motivoId === id ? 'border-accent bg-accent/10' : 'border-line hover:border-accent'}`}>{nome}</button>
  );

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-base font-medium">Motivo</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {opcao(null, 'Fim do turno')}
        {motivos?.map((motivo) => opcao(motivo.id, motivo.nome))}
      </div>
      {motivos === null && <p role="status" className="text-sm text-muted">Carregando os outros motivos…</p>}
      {aviso && <p role="status" className="text-sm text-warning">{aviso}</p>}
    </fieldset>
  );
}
