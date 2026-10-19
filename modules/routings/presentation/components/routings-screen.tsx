'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, LoaderCircle, Plus, Route, Search } from 'lucide-react';
import type { RoteiroResumo } from '../../domain/roteiro';
import { listarRoteiros, ErroApiRoteiros } from '../api-client';
import { filtrarOrdenarRoteiros, formatarData, type ColunaRoteiro, type FiltroStatusRoteiro, type OrdemRoteiro } from '../listing';
import { RoutingCreateDialog } from './routing-create-dialog';

const colunas: ReadonlyArray<{ campo: ColunaRoteiro; titulo: string }> = [
  { campo: 'nome', titulo: 'Nome' }, { campo: 'versao', titulo: 'Versão' }, { campo: 'quantidadeEtapas', titulo: 'Etapas' },
  { campo: 'quantidadeOrdens', titulo: 'Ordens' }, { campo: 'ativo', titulo: 'Status' }, { campo: 'updatedAt', titulo: 'Alterado em' },
];

export function RoutingsScreen() {
  const router = useRouter();
  const [roteiros, setRoteiros] = useState<RoteiroResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatusRoteiro>('todos');
  const [ordem, setOrdem] = useState<OrdemRoteiro>({ coluna: 'nome', direcao: 'asc' });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const botaoAdicionarRef = useRef<HTMLButtonElement>(null);

  const carregar = useCallback((signal?: AbortSignal) => {
    listarRoteiros(signal).then((dados) => {
      if (signal?.aborted) return;
      setRoteiros(dados);
      setErro('');
    }).catch((falha: unknown) => {
      if (signal?.aborted) return;
      if (falha instanceof ErroApiRoteiros && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiRoteiros ? falha.message : 'Não foi possível carregar os roteiros. Verifique sua conexão e tente novamente.');
      }
    }).finally(() => {
      if (!signal?.aborted) setCarregando(false);
    });
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    carregar(controller.signal);
    return () => controller.abort();
  }, [carregar]);

  const visiveis = useMemo(() => filtrarOrdenarRoteiros(roteiros, busca, status, ordem), [roteiros, busca, status, ordem]);

  function ordenar(coluna: ColunaRoteiro) {
    setOrdem((atual) => ({ coluna, direcao: atual.coluna === coluna && atual.direcao === 'asc' ? 'desc' : 'asc' }));
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-semibold tracking-tight">Roteiros</h1><p className="mt-2 text-sm leading-6 text-muted">Monte as etapas de cada roteiro, os postos onde elas podem ser feitas e as versões.</p></div>
        <button
          ref={botaoAdicionarRef} type="button" aria-haspopup="dialog" aria-controls="cadastro-roteiro"
          onClick={() => { if (!dialogRef.current?.open) { dialogRef.current?.showModal(); dialogRef.current?.querySelector<HTMLInputElement>('#roteiro-nome')?.focus(); } }}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        ><Plus aria-hidden="true" size={20} strokeWidth={2} />Adicionar roteiro</button>
      </header>

      <section aria-label="Listagem de roteiros" aria-busy={carregando} className="mt-7 min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
        <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:p-5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="roteiros-busca" className="mb-2 block text-sm font-medium">Buscar roteiros</label>
            <div className="relative"><Search aria-hidden="true" size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input id="roteiros-busca" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome do roteiro" className="h-11 w-full rounded-lg border border-[#3b454e] bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <div className="lg:w-44"><label htmlFor="roteiros-status" className="mb-2 block text-sm font-medium">Status</label>
            <select id="roteiros-status" value={status} onChange={(event) => setStatus(event.target.value as FiltroStatusRoteiro)} className="h-11 w-full rounded-lg border border-[#3b454e] bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option>
            </select>
          </div>
          <button type="button" onClick={() => { setBusca(''); setStatus('todos'); }} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Limpar filtros</button>
        </div>

        {carregando ? (
          <p role="status" className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando roteiros…</p>
        ) : erro ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
            <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>
            <button type="button" onClick={() => { setCarregando(true); setErro(''); carregar(); }} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Tentar novamente</button>
          </div>
        ) : (
          <>
            <div className="max-w-full overflow-x-auto rounded-b-xl">
              <table className="w-full min-w-[860px] text-left text-sm">
                <caption className="sr-only">Roteiros cadastrados, uma linha por versão. Use os cabeçalhos para ordenar as colunas.</caption>
                <thead className="border-b border-white/10 bg-white/[0.025] text-muted"><tr>
                  {colunas.map(({ campo, titulo }) => <th key={campo} scope="col" aria-sort={ordem.coluna === campo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-5 py-3 font-medium">
                    <button type="button" onClick={() => ordenar(campo)} className="flex min-h-8 cursor-pointer items-center gap-2 rounded text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label={`Ordenar por ${titulo}${ordem.coluna === campo && ordem.direcao === 'asc' ? ' em ordem decrescente' : ' em ordem crescente'}`}>
                      {titulo}{ordem.coluna !== campo ? <ArrowUpDown aria-hidden="true" size={16} strokeWidth={2} /> : ordem.direcao === 'asc' ? <ArrowUp aria-hidden="true" size={16} strokeWidth={2} /> : <ArrowDown aria-hidden="true" size={16} strokeWidth={2} />}
                    </button>
                  </th>)}
                  <th scope="col" className="px-5 py-3 text-right font-medium"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {visiveis.map((roteiro) => <tr key={roteiro.id} className="hover:bg-white/[0.025]">
                    <td className="max-w-80 px-5 py-4 font-medium break-words [overflow-wrap:anywhere]">{roteiro.nome}</td>
                    <td className="px-5 py-4 text-[#c1c8cf]">{roteiro.versao}</td>
                    <td className="px-5 py-4 text-[#c1c8cf]">{roteiro.quantidadeEtapas}</td>
                    <td className="px-5 py-4 text-[#c1c8cf]">{roteiro.quantidadeOrdens}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${roteiro.ativo ? 'border-[#7bcba5]/20 bg-[#7bcba5]/10 text-[#a6dfbf]' : 'border-white/10 bg-white/5 text-muted'}`}>{roteiro.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted"><time dateTime={roteiro.updatedAt}>{formatarData(roteiro.updatedAt)}</time></td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/painel/roteiros/${roteiro.id}`} aria-label={`Abrir ${roteiro.nome}, versão ${roteiro.versao}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Abrir<ChevronRight aria-hidden="true" size={16} strokeWidth={2} /></Link>
                    </td>
                  </tr>)}
                  {visiveis.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-muted"><Route aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mb-3" />{roteiros.length === 0 ? 'Nenhum roteiro cadastrado.' : 'Nenhum roteiro encontrado para os filtros selecionados.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <p aria-live="polite" className="border-t border-white/10 px-5 py-3 text-xs text-muted">{visiveis.length} de {roteiros.length} versões de roteiro</p>
          </>
        )}
      </section>
      <RoutingCreateDialog dialogRef={dialogRef} botaoRef={botaoAdicionarRef} />
    </div>
  );
}
