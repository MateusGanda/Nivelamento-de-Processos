'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, LoaderCircle, Pencil, Plus, Power, PowerOff, Search, UsersRound } from 'lucide-react';
import type { Operador } from '../../domain/operador';
import { definirStatusOperador, listarOperadores, ErroApiOperadores } from '../api-client';
import { filtrarOrdenarOperadores, formatarDataCadastro, type ColunaOperador, type FiltroStatusOperador, type OrdemOperador } from '../listing';
import { OperatorFormDialog, type PedidoFormularioOperador } from './operator-form-dialog';

const colunas: ReadonlyArray<{ campo: ColunaOperador; titulo: string }> = [
  { campo: 'nome', titulo: 'Nome' }, { campo: 'matricula', titulo: 'Matrícula' },
  { campo: 'setor', titulo: 'Setor principal' }, { campo: 'funcao', titulo: 'Função' },
  { campo: 'ativo', titulo: 'Status' }, { campo: 'createdAt', titulo: 'Cadastrado em' },
];
const mensagemFalhaAtualizacao = 'Gravação concluída, mas não foi possível atualizar a lista. Use Tentar novamente para recarregar, sem repetir a gravação.';

export function OperatorsScreen() {
  const router = useRouter();
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatusOperador>('todos');
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null);
  // Recusa da mudança de status: aparece acima da lista, sem esconder a tabela.
  const [erroStatus, setErroStatus] = useState('');
  const [ordem, setOrdem] = useState<OrdemOperador>({ coluna: 'nome', direcao: 'asc' });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const origemFoco = useRef<HTMLButtonElement | null>(null);
  const ultimaMensagem = useRef('');
  const [pedido, setPedido] = useState<PedidoFormularioOperador | null>(null);
  const pedidoLista = useRef(0);
  const montado = useRef(false);

  const carregarLista = useCallback((signal?: AbortSignal): Promise<boolean | null> => {
    const pedido = ++pedidoLista.current;
    return listarOperadores(signal).then((dados) => {
      if (signal?.aborted || !montado.current || pedido !== pedidoLista.current) return null;
      setOperadores(dados);
      setErro('');
      setMensagem((atual) => atual === mensagemFalhaAtualizacao ? ultimaMensagem.current : atual);
      return true;
    }).catch((falha: unknown) => {
      if (signal?.aborted || !montado.current || pedido !== pedidoLista.current) return null;
      if (falha instanceof ErroApiOperadores && (falha.status === 401 || falha.status === 403)) {
        setOperadores([]);
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiOperadores ? falha.message : 'Não foi possível carregar os operadores. Verifique sua conexão e tente novamente.');
      }
      return false;
    }).finally(() => {
      if (!signal?.aborted && montado.current && pedido === pedidoLista.current) setCarregando(false);
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

  function abrirFormulario(operador: Operador | null, botao: HTMLButtonElement) {
    if (dialogRef.current?.open) return;
    origemFoco.current = botao;
    setPedido((atual) => ({ operador, seq: (atual?.seq ?? 0) + 1 }));
  }

  function aoConcluir(operador: Operador, acao: 'cadastrado' | 'alterado' | 'ativado' | 'inativado') {
    ultimaMensagem.current = 'Operador ' + acao + ' com sucesso. Matrícula: ' + operador.matricula + '.';
    setMensagem(ultimaMensagem.current);
    setErroStatus('');
    setCarregando(true);
    setErro('');
    void carregarLista().then((sucesso) => {
      if (sucesso === false && montado.current) setMensagem(mensagemFalhaAtualizacao);
    });
  }

  async function alternarStatus(operador: Operador) {
    if (alterandoStatus) return;
    setAlterandoStatus(operador.id);
    setMensagem('');
    setErroStatus('');
    try {
      aoConcluir(await definirStatusOperador(operador.id, !operador.ativo), operador.ativo ? 'inativado' : 'ativado');
    } catch (falha) {
      if (falha instanceof ErroApiOperadores && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else if (montado.current) {
        setErroStatus(falha instanceof ErroApiOperadores ? falha.message : 'Não foi possível alterar o status. Verifique sua conexão e tente novamente.');
      }
    } finally {
      if (montado.current) setAlterandoStatus(null);
    }
  }

  const visiveis = useMemo(() => filtrarOrdenarOperadores(operadores, busca, status, ordem), [operadores, busca, status, ordem]);

  function ordenar(coluna: ColunaOperador) {
    setOrdem((atual) => ({ coluna, direcao: atual.coluna === coluna && atual.direcao === 'asc' ? 'desc' : 'asc' }));
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-semibold tracking-tight">Operadores</h1><p className="mt-2 text-sm leading-6 text-muted">Cadastre, consulte, atualize e inative os operadores e seus setores principais.</p></div>
        <button
          type="button" aria-haspopup="dialog" aria-controls="cadastro-operador"
          onClick={(event) => abrirFormulario(null, event.currentTarget)}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        ><Plus aria-hidden="true" size={20} strokeWidth={2} />Adicionar operador</button>
      </header>

      {mensagem && <p role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-[#7bcba5]/25 bg-[#7bcba5]/5 p-4 text-sm leading-6 text-[#a6dfbf]"><CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{mensagem}</p>}
      {erroStatus && <p role="alert" className="mt-6 flex items-start gap-2 rounded-lg border border-[#ffb4a5]/25 bg-[#ffb4a5]/5 p-4 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erroStatus}</p>}

      <section aria-label="Listagem de operadores" className="mt-7 min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
        <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:p-5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="operadores-busca" className="mb-2 block text-sm font-medium">Buscar operadores</label>
            <div className="relative"><Search aria-hidden="true" size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input id="operadores-busca" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome, matrícula, função ou setor" className="h-11 w-full rounded-lg border border-[#3b454e] bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <div className="lg:w-44"><label htmlFor="operadores-status" className="mb-2 block text-sm font-medium">Status</label>
            <select id="operadores-status" value={status} onChange={(event) => setStatus(event.target.value as FiltroStatusOperador)} className="h-11 w-full rounded-lg border border-[#3b454e] bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option>
            </select>
          </div>
          <button type="button" onClick={() => { setBusca(''); setStatus('todos'); }} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Limpar filtros</button>
        </div>

        {carregando && operadores.length === 0 ? (
          <p role="status" className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando operadores…</p>
        ) : erro ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
            <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>
            <button type="button" onClick={tentarNovamente} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Tentar novamente</button>
          </div>
        ) : (
          <>
            <div className="max-w-full overflow-x-auto rounded-b-xl">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <caption className="sr-only">Operadores cadastrados. Use os cabeçalhos para ordenar as colunas.</caption>
                <thead className="border-b border-white/10 bg-white/[0.025] text-muted"><tr>
                  {colunas.map(({ campo, titulo }) => <th key={campo} scope="col" aria-sort={ordem.coluna === campo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-5 py-3 font-medium">
                    <button type="button" onClick={() => ordenar(campo)} className="flex min-h-8 cursor-pointer items-center gap-2 rounded text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label={`Ordenar por ${titulo}${ordem.coluna === campo && ordem.direcao === 'asc' ? ' em ordem decrescente' : ' em ordem crescente'}`}>
                      {titulo}{ordem.coluna !== campo ? <ArrowUpDown aria-hidden="true" size={16} strokeWidth={2} /> : ordem.direcao === 'asc' ? <ArrowUp aria-hidden="true" size={16} strokeWidth={2} /> : <ArrowDown aria-hidden="true" size={16} strokeWidth={2} />}
                    </button>
                  </th>)}
                  <th scope="col" className="px-5 py-3 text-right font-medium"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {visiveis.map((operador) => <tr key={operador.id} className="hover:bg-white/[0.025]">
                    <td className="max-w-96 px-5 py-4 font-medium break-words [overflow-wrap:anywhere]">{operador.nome}</td>
                    <td className="max-w-64 px-5 py-4 break-words text-[#c1c8cf] [overflow-wrap:anywhere]">{operador.matricula}</td>
                    <td className="max-w-64 px-5 py-4 break-words text-muted">{operador.setorPrincipal ? operador.setorPrincipal.codigo + ' — ' + operador.setorPrincipal.nome : 'Sem setor definido'}</td>
                    <td className="max-w-64 px-5 py-4 break-words text-muted">{operador.funcao ?? 'Não informada'}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${operador.ativo ? 'border-[#7bcba5]/20 bg-[#7bcba5]/10 text-[#a6dfbf]' : 'border-white/10 bg-white/5 text-muted'}`}>{operador.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted"><time dateTime={operador.createdAt}>{formatarDataCadastro(operador.createdAt)}</time></td>
                    <td className="px-5 py-3 text-right whitespace-nowrap"><button type="button" aria-haspopup="dialog" aria-controls="cadastro-operador" aria-label={'Editar ' + operador.nome} onClick={(event) => abrirFormulario(operador, event.currentTarget)} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Pencil aria-hidden="true" size={16} />Editar</button>
                      {/* aria-disabled em vez de disabled: o botão mantém o foco durante o envio. */}
                      <button type="button" aria-label={`${operador.ativo ? 'Inativar' : 'Ativar'} ${operador.nome}`} aria-disabled={alterandoStatus !== null}
                        onClick={() => void alternarStatus(operador)}
                        className="ml-2 inline-flex min-h-10 w-28 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-wait aria-disabled:opacity-60"
                      >{alterandoStatus === operador.id ? <LoaderCircle aria-hidden="true" size={16} strokeWidth={2} className="motion-safe:animate-spin" /> : operador.ativo ? <PowerOff aria-hidden="true" size={16} strokeWidth={2} /> : <Power aria-hidden="true" size={16} strokeWidth={2} />}{operador.ativo ? 'Inativar' : 'Ativar'}</button>
                    </td>
                  </tr>)}
                  {visiveis.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-muted"><UsersRound aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mb-3" />{operadores.length === 0 ? 'Nenhum operador cadastrado.' : 'Nenhum operador encontrado para os filtros selecionados.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <p aria-live="polite" className="border-t border-white/10 px-5 py-3 text-xs text-muted">{visiveis.length} de {operadores.length} operadores</p>
          </>
        )}
      </section>
      <OperatorFormDialog dialogRef={dialogRef} pedido={pedido} aoConcluir={aoConcluir} aoFechar={() => { setPedido(null); origemFoco.current?.focus(); }} />
    </div>
  );
}
