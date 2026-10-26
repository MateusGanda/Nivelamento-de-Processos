'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, Search } from 'lucide-react';
import type { Destino, OrdemDisponivel } from '../../domain/execucao';
import { ErroApiIlha, listarOrdensDisponiveis } from '../api-client';

const cartao = 'w-full cursor-pointer rounded-lg border px-4 py-3 text-left text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';
const selecionado = (ativo: boolean) => ativo ? 'border-accent bg-accent/10' : 'border-[#3b454e] hover:border-accent';

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

// Escolha de ordem → etapa → posto, usada para iniciar e para trocar de operação.
export function IlhaDestino({ rotuloConfirmar, ocupado, aoConfirmar, aoCancelar, aoFalhar, excluirEtapaId }: {
  rotuloConfirmar: string;
  ocupado: boolean;
  aoConfirmar: (destino: Destino) => void;
  aoCancelar: () => void;
  aoFalhar: (falha: unknown) => void;
  // Na troca, a etapa atual não é oferecida de novo.
  excluirEtapaId?: string;
}) {
  const [ordens, setOrdens] = useState<OrdemDisponivel[] | null>(null);
  const [busca, setBusca] = useState('');
  const [ordemId, setOrdemId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [postoId, setPostoId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    listarOrdensDisponiveis(controller.signal)
      .then((dados) => { if (!controller.signal.aborted) setOrdens(dados); })
      .catch((falha: unknown) => { if (!controller.signal.aborted) aoFalhar(falha instanceof ErroApiIlha ? falha : new Error('Não foi possível carregar as ordens.')); });
    return () => controller.abort();
  }, [aoFalhar]);

  const termo = textoBusca(busca.trim());
  const visiveis = useMemo(() => (ordens ?? []).filter((ordem) => !termo || [ordem.numero, ordem.produto.codigo, ordem.produto.nome].some((c) => textoBusca(c).includes(termo))), [ordens, termo]);
  const ordem = ordens?.find((item) => item.id === ordemId);
  const etapa = ordem?.etapas.find((item) => item.id === etapaId);

  if (ordens === null) {
    return <p role="status" className="flex items-center gap-3 py-8 text-base text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando ordens…</p>;
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-semibold">1. Ordem de produção</legend>
        <div className="relative"><Search aria-hidden="true" size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <label htmlFor="ilha-busca-ordem" className="sr-only">Buscar ordem</label>
          <input id="ilha-busca-ordem" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Número da ordem ou produto" className="h-12 w-full rounded-lg border border-[#3b454e] bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>
        {visiveis.length === 0 && <p className="text-base text-muted">{ordens.length === 0 ? 'Nenhuma ordem com etapa em aberto.' : 'Nenhuma ordem encontrada.'}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {visiveis.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === ordemId} onClick={() => { setOrdemId(item.id); setEtapaId(''); setPostoId(''); }} className={`${cartao} ${selecionado(item.id === ordemId)}`}>
              <span className="block font-semibold">{item.numero}</span>
              <span className="block text-sm text-[#c1c8cf]">{item.produto.codigo} – {item.produto.nome} · {item.quantidade.toLocaleString('pt-BR')} {item.unidade}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {ordem && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-lg font-semibold">2. Etapa</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ordem.etapas.map((item) => {
              const indisponivel = item.baixada || item.id === excluirEtapaId || item.postos.length === 0;
              return (
                <button key={item.id} type="button" aria-pressed={item.id === etapaId} disabled={indisponivel}
                  onClick={() => { setEtapaId(item.id); setPostoId(item.postos.length === 1 ? item.postos[0].id : ''); }} className={`${cartao} ${selecionado(item.id === etapaId)}`}>
                  <span className="block font-semibold">{item.ordem}. {item.operacao}</span>
                  <span className="block text-sm text-[#c1c8cf]">{item.baixada ? 'Já teve baixa' : item.id === excluirEtapaId ? 'Etapa atual' : item.postos.length === 0 ? 'Sem posto ativo' : `${item.postos.length} ${item.postos.length === 1 ? 'posto' : 'postos'}`}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {etapa && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-lg font-semibold">3. Posto</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {etapa.postos.map((posto) => (
              <button key={posto.id} type="button" aria-pressed={posto.id === postoId} onClick={() => setPostoId(posto.id)} className={`${cartao} ${selecionado(posto.id === postoId)}`}>
                <span className="block font-semibold">{posto.codigo}</span>
                <span className="block text-sm text-[#c1c8cf]">{posto.nome}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={aoCancelar} disabled={ocupado} className="min-h-12 cursor-pointer rounded-lg border border-[#3b454e] px-5 text-base font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">Cancelar</button>
        <button type="button" disabled={!ordem || !etapa || !postoId || ocupado} onClick={() => aoConfirmar({ ordemId, etapaId, postoId })}
          className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-5 text-base font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
          {ocupado ? <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" /> : <CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} />}{rotuloConfirmar}
        </button>
      </div>
    </div>
  );
}
