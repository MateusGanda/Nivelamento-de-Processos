'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Clock3, LoaderCircle, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
import type { MotivoPausa } from '../../domain/motivoPausa';
import { definirStatusMotivoPausa, listarMotivosPausa, ErroApiMotivosPausa } from '../api-client';
import { filtrarOrdenarMotivosPausa, formatarDataCadastro, type ColunaMotivoPausa, type FiltroStatusMotivoPausa, type OrdemMotivoPausa } from '../listing';
import { PauseReasonFormDialog, type PedidoFormularioMotivoPausa } from './pause-reason-form-dialog';

const colunas: ReadonlyArray<{ campo: ColunaMotivoPausa; titulo: string }> = [
  { campo: 'nome', titulo: 'Nome' }, { campo: 'descricao', titulo: 'Descrição' }, { campo: 'ativo', titulo: 'Status' },
  { campo: 'createdAt', titulo: 'Cadastrado em' }, { campo: 'updatedAt', titulo: 'Alterado em' },
];
type Acao = 'cadastrado' | 'alterado' | 'ativado' | 'inativado';
const acoes: readonly Acao[] = ['cadastrado', 'alterado', 'ativado', 'inativado'];
const mensagemSucesso = (acao: Acao) => `Motivo de pausa ${acao} com sucesso.`;
const mensagemFalhaAtualizacao = (acao: Acao) => `Motivo de pausa ${acao}, mas não foi possível atualizar a lista. Use Tentar novamente para recarregar, sem repetir a ação.`;

export function PauseReasonsScreen() {
  const router = useRouter();
  const [motivosPausa, setMotivosPausa] = useState<MotivoPausa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<OrdemMotivoPausa>({ coluna: 'nome', direcao: 'asc' });
  const [status, setStatus] = useState<FiltroStatusMotivoPausa>('todos');
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoFormularioMotivoPausa | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const origemFoco = useRef<HTMLButtonElement | null>(null);
  const pedidoLista = useRef(0);
  const montado = useRef(false);

  const carregarLista = useCallback((signal?: AbortSignal): Promise<boolean | null> => {
    const numero = ++pedidoLista.current;
    return listarMotivosPausa(signal).then((dados) => {
      if (signal?.aborted || !montado.current || numero !== pedidoLista.current) return null;
      setMotivosPausa(dados);
      setErro('');
      setMensagem((atual) => {
        const acao = acoes.find((item) => atual === mensagemFalhaAtualizacao(item));
        return acao ? mensagemSucesso(acao) : atual;
      });
      return true;
    }).catch((falha: unknown) => {
      if (signal?.aborted || !montado.current || numero !== pedidoLista.current) return null;
      if (falha instanceof ErroApiMotivosPausa && (falha.status === 401 || falha.status === 403)) {
        setMotivosPausa([]);
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiMotivosPausa ? falha.message : 'Não foi possível carregar os motivos de pausa. Verifique sua conexão e tente novamente.');
      }
      return false;
    }).finally(() => {
      if (!signal?.aborted && montado.current && numero === pedidoLista.current) setCarregando(false);
    });
  }, [router]);

  useEffect(() => {
    montado.current = true;
    const controller = new AbortController();
    void carregarLista(controller.signal);
    return () => { montado.current = false; controller.abort(); };
  }, [carregarLista]);

  function tentarNovamente() {
    setCarregando(true);
    setErro('');
    void carregarLista();
  }

  function abrirFormulario(motivoPausa: MotivoPausa | null, botao: HTMLButtonElement) {
    if (dialogRef.current?.open) return;
    origemFoco.current = botao;
    setPedido((atual) => ({ motivoPausa, seq: (atual?.seq ?? 0) + 1 }));
  }

  async function alternarStatus(motivoPausa: MotivoPausa) {
    if (alterandoStatus) return;
    setAlterandoStatus(motivoPausa.id);
    setMensagem('');
    try {
      await definirStatusMotivoPausa(motivoPausa.id, !motivoPausa.ativo);
      aoConcluir(motivoPausa.ativo ? 'inativado' : 'ativado');
    } catch (falha) {
      if (falha instanceof ErroApiMotivosPausa && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiMotivosPausa ? falha.message : 'Não foi possível alterar o status. Verifique sua conexão e tente novamente.');
      }
    } finally {
      if (montado.current) setAlterandoStatus(null);
    }
  }

  function aoConcluir(acao: Acao) {
    setMensagem(mensagemSucesso(acao));
    setCarregando(true);
    setErro('');
    void carregarLista().then((sucesso) => {
      if (sucesso === false && montado.current) setMensagem(mensagemFalhaAtualizacao(acao));
    });
  }

  const visiveis = useMemo(() => filtrarOrdenarMotivosPausa(motivosPausa, busca, ordem, status), [motivosPausa, busca, ordem, status]);

  function ordenar(coluna: ColunaMotivoPausa) {
    setOrdem((atual) => ({ coluna, direcao: atual.coluna === coluna && atual.direcao === 'asc' ? 'desc' : 'asc' }));
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-semibold tracking-tight">Motivos de pausa</h1><p className="mt-2 text-sm leading-6 text-muted">Cadastre, consulte, altere e inative os motivos que classificam as paradas da produção.</p></div>
        <button
          type="button" aria-haspopup="dialog" aria-controls="formulario-motivoPausa"
          onClick={(event) => abrirFormulario(null, event.currentTarget)}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        ><Plus aria-hidden="true" size={20} strokeWidth={2} />Adicionar motivo de pausa</button>
      </header>

      {mensagem && <p role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-[#7bcba5]/25 bg-[#7bcba5]/5 p-4 text-sm leading-6 text-[#a6dfbf]"><CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{mensagem}</p>}

      <section aria-label="Listagem de motivos de pausa" aria-busy={carregando} className="mt-7 min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
        <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:p-5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="motivosPausa-busca" className="mb-2 block text-sm font-medium">Buscar motivos de pausa</label>
            <div className="relative"><Search aria-hidden="true" size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input id="motivosPausa-busca" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome ou descrição" className="h-11 w-full rounded-lg border border-[#3b454e] bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <div className="lg:w-44"><label htmlFor="motivosPausa-status" className="mb-2 block text-sm font-medium">Status</label>
            <select id="motivosPausa-status" value={status} onChange={(event) => setStatus(event.target.value as FiltroStatusMotivoPausa)} className="h-11 w-full rounded-lg border border-[#3b454e] bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option>
            </select>
          </div>
          <button type="button" onClick={() => { setBusca(''); setStatus('todos'); }} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Limpar filtros</button>
        </div>

        {/* Na recarga após gravar, a tabela continua na tela para o foco voltar ao botão Editar. */}
        {carregando && motivosPausa.length === 0 ? (
          <p role="status" className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando motivos de pausa…</p>
        ) : erro ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
            <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>
            <button type="button" onClick={tentarNovamente} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Tentar novamente</button>
          </div>
        ) : (
          <>
            <div className="max-w-full overflow-x-auto rounded-b-xl">
              <table className="w-full min-w-[920px] text-left text-sm">
                <caption className="sr-only">Motivos de pausa cadastrados. Use os cabeçalhos para ordenar as colunas.</caption>
                <thead className="border-b border-white/10 bg-white/[0.025] text-muted"><tr>
                  {colunas.map(({ campo, titulo }) => <th key={campo} scope="col" aria-sort={ordem.coluna === campo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-5 py-3 font-medium">
                    <button type="button" onClick={() => ordenar(campo)} className="flex min-h-8 cursor-pointer items-center gap-2 rounded text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label={`Ordenar por ${titulo}${ordem.coluna === campo && ordem.direcao === 'asc' ? ' em ordem decrescente' : ' em ordem crescente'}`}>
                      {titulo}{ordem.coluna !== campo ? <ArrowUpDown aria-hidden="true" size={16} strokeWidth={2} /> : ordem.direcao === 'asc' ? <ArrowUp aria-hidden="true" size={16} strokeWidth={2} /> : <ArrowDown aria-hidden="true" size={16} strokeWidth={2} />}
                    </button>
                  </th>)}
                  <th scope="col" className="px-5 py-3 text-right font-medium"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {visiveis.map((motivoPausa) => <tr key={motivoPausa.id} className="hover:bg-white/[0.025]">
                    <td className="max-w-48 px-5 py-4 font-medium break-words [overflow-wrap:anywhere]">{motivoPausa.nome}</td>
                    <td className="max-w-96 px-5 py-4 break-words text-[#c1c8cf] [overflow-wrap:anywhere]">{motivoPausa.descricao ?? 'Sem descrição'}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${motivoPausa.ativo ? 'border-[#7bcba5]/20 bg-[#7bcba5]/10 text-[#a6dfbf]' : 'border-white/10 bg-white/5 text-muted'}`}>{motivoPausa.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted"><time dateTime={motivoPausa.createdAt}>{formatarDataCadastro(motivoPausa.createdAt)}</time></td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted"><time dateTime={motivoPausa.updatedAt}>{formatarDataCadastro(motivoPausa.updatedAt)}</time></td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" aria-haspopup="dialog" aria-controls="formulario-motivoPausa" aria-label={`Editar ${motivoPausa.nome}`}
                        onClick={(event) => abrirFormulario(motivoPausa, event.currentTarget)}
                        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      ><Pencil aria-hidden="true" size={16} strokeWidth={2} />Editar</button>
                      {/* aria-disabled em vez de disabled: o botão mantém o foco durante o envio. */}
                      <button type="button" aria-label={`${motivoPausa.ativo ? 'Inativar' : 'Ativar'} ${motivoPausa.nome}`} aria-disabled={alterandoStatus !== null}
                        onClick={() => void alternarStatus(motivoPausa)}
                        className="ml-2 inline-flex min-h-10 w-28 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-wait aria-disabled:opacity-60"
                      >{alterandoStatus === motivoPausa.id ? <LoaderCircle aria-hidden="true" size={16} strokeWidth={2} className="motion-safe:animate-spin" /> : motivoPausa.ativo ? <PowerOff aria-hidden="true" size={16} strokeWidth={2} /> : <Power aria-hidden="true" size={16} strokeWidth={2} />}{motivoPausa.ativo ? 'Inativar' : 'Ativar'}</button>
                    </td>
                  </tr>)}
                  {visiveis.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-muted"><Clock3 aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mb-3" />{motivosPausa.length === 0 ? 'Nenhum motivo de pausa cadastrado.' : 'Nenhum motivo de pausa encontrado para os filtros selecionados.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <p aria-live="polite" className="border-t border-white/10 px-5 py-3 text-xs text-muted">{visiveis.length} de {motivosPausa.length} motivos de pausa</p>
          </>
        )}
      </section>
      <PauseReasonFormDialog dialogRef={dialogRef} pedido={pedido} aoConcluir={aoConcluir} aoFechar={() => origemFoco.current?.focus()} />
    </div>
  );
}
