'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PaginacaoTabela } from '@/shared/presentation/paginacao-tabela';
import { MenuAcoesRegistro } from '@/shared/presentation/menu-acoes-registro';
import { TabelaComRolagem } from '@/shared/presentation/tabela-com-rolagem';
import { usePaginacaoTabela } from '@/shared/presentation/use-paginacao-tabela';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Factory, LoaderCircle, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
import type { Posto } from '../../domain/posto';
import { definirStatusPosto, listarPostos, ErroApiPostos } from '../api-client';
import { filtrarOrdenarPostos, formatarDataCadastro, type ColunaPosto, type FiltroStatusPosto, type OrdemPosto } from '../listing';
import { WorkstationFormDialog, type PedidoFormularioPosto } from './workstation-form-dialog';

const colunas: ReadonlyArray<{ campo: ColunaPosto; titulo: string }> = [
  { campo: 'codigo', titulo: 'Código' }, { campo: 'nome', titulo: 'Nome' }, { campo: 'setor', titulo: 'Setor' },
  { campo: 'ativo', titulo: 'Status' }, { campo: 'createdAt', titulo: 'Cadastrado em' },
];
type Acao = 'cadastrado' | 'alterado' | 'ativado' | 'inativado';
const acoes: readonly Acao[] = ['cadastrado', 'alterado', 'ativado', 'inativado'];
const mensagemSucesso = (acao: Acao) => `Posto ${acao} com sucesso.`;
const mensagemFalhaAtualizacao = (acao: Acao) => `Posto ${acao}, mas não foi possível atualizar a lista. Use Tentar novamente para recarregar, sem repetir a operação.`;

export function WorkstationsScreen() {
  const router = useRouter();
  const [postos, setPostos] = useState<Posto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatusPosto>('todos');
  const [ordem, setOrdem] = useState<OrdemPosto>({ coluna: 'codigo', direcao: 'asc' });
  const [pedido, setPedido] = useState<PedidoFormularioPosto | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const origemFoco = useRef<HTMLButtonElement | null>(null);
  const pedidoLista = useRef(0);
  const montado = useRef(false);

  const carregarLista = useCallback((signal?: AbortSignal): Promise<boolean | null> => {
    const pedido = ++pedidoLista.current;
    return listarPostos(signal).then((dados) => {
      if (signal?.aborted || !montado.current || pedido !== pedidoLista.current) return null;
      setPostos(dados);
      setErro('');
      setMensagem((atual) => {
        const acao = acoes.find((item) => atual === mensagemFalhaAtualizacao(item));
        return acao ? mensagemSucesso(acao) : atual;
      });
      return true;
    }).catch((falha: unknown) => {
      if (signal?.aborted || !montado.current || pedido !== pedidoLista.current) return null;
      if (falha instanceof ErroApiPostos && (falha.status === 401 || falha.status === 403)) {
        setPostos([]);
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiPostos ? falha.message : 'Não foi possível carregar os postos. Verifique sua conexão e tente novamente.');
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

  function recarregarApos(acao: Acao) {
    setMensagem(mensagemSucesso(acao));
    setCarregando(true);
    setErro('');
    void carregarLista().then((sucesso) => {
      if (sucesso === false && montado.current) setMensagem(mensagemFalhaAtualizacao(acao));
    });
  }

  function abrirFormulario(posto: Posto | null, botao: HTMLButtonElement) {
    if (dialogRef.current?.open) return;
    origemFoco.current = botao;
    setPedido((atual) => ({ posto, seq: (atual?.seq ?? 0) + 1 }));
  }

  async function alternarStatus(posto: Posto) {
    if (alterandoStatus) return;
    setAlterandoStatus(posto.id);
    setMensagem('');
    try {
      await definirStatusPosto(posto.id, !posto.ativo);
      recarregarApos(posto.ativo ? 'inativado' : 'ativado');
    } catch (falha) {
      if (falha instanceof ErroApiPostos && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiPostos ? falha.message : 'Não foi possível alterar o status. Verifique sua conexão e tente novamente.');
      }
    } finally {
      if (montado.current) setAlterandoStatus(null);
    }
  }

  const visiveis = useMemo(() => filtrarOrdenarPostos(postos, busca, status, ordem), [postos, busca, status, ordem]);
  const paginacao = usePaginacaoTabela(visiveis, JSON.stringify([busca, status, ordem]));

  function ordenar(coluna: ColunaPosto) {
    setOrdem((atual) => ({ coluna, direcao: atual.coluna === coluna && atual.direcao === 'asc' ? 'desc' : 'asc' }));
  }

  return (
    <div className="pagina-com-tabela mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-semibold tracking-tight">Postos</h1><p className="mt-2 text-sm leading-6 text-muted">Cadastre, consulte, altere e inative os postos de trabalho de cada setor.</p></div>
        <button
          type="button" aria-haspopup="dialog" aria-controls="formulario-posto"
          onClick={(event) => abrirFormulario(null, event.currentTarget)}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        ><Plus aria-hidden="true" size={20} strokeWidth={2} />Adicionar posto</button>
      </header>

      {mensagem && <p role="status" className="mt-6 flex items-start gap-2 rounded-md border border-success-fill/25 bg-success-fill/5 p-4 text-sm leading-6 text-success"><CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{mensagem}</p>}

      <section aria-label="Listagem de postos" aria-busy={carregando} className="listagem-com-rolagem mt-7 min-w-0 rounded-lg border border-line-soft bg-surface">
        <div className="flex flex-col gap-4 border-b border-foreground/10 p-4 sm:p-5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="postos-busca" className="mb-2 block text-sm font-medium">Buscar postos</label>
            <div className="relative"><Search aria-hidden="true" size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input id="postos-busca" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Código, nome ou setor" className="h-11 w-full rounded-md border border-line bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <div className="lg:w-44"><label htmlFor="postos-status" className="mb-2 block text-sm font-medium">Status</label>
            <select id="postos-status" value={status} onChange={(event) => setStatus(event.target.value as FiltroStatusPosto)} className="h-11 w-full rounded-md border border-line bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option>
            </select>
          </div>
          <button type="button" onClick={() => { setBusca(''); setStatus('todos'); }} className="min-h-11 cursor-pointer rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Limpar filtros</button>
        </div>

        {/* Na recarga após gravar, a tabela continua na tela para o foco voltar ao botão da linha. */}
        {carregando && postos.length === 0 ? (
          <p role="status" className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando postos…</p>
        ) : erro ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
            <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-danger"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>
            <button type="button" onClick={tentarNovamente} className="min-h-11 cursor-pointer rounded-md border border-line px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Tentar novamente</button>
          </div>
        ) : (
          <>
            <TabelaComRolagem legenda="Postos" chaveRolagem={paginacao.chaveRolagem}>
              <table className="tabela-com-acoes tabular-nums w-full text-left text-sm">
                <caption className="sr-only">Postos cadastrados. Use os cabeçalhos para ordenar as colunas.</caption>
                <thead className="border-b border-foreground/10 bg-foreground/[0.025] text-muted"><tr>
                  <th scope="col" className="coluna-action font-medium">Action</th>
                  {colunas.map(({ campo, titulo }) => <th key={campo} scope="col" aria-sort={ordem.coluna === campo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-3 font-medium">
                    <button type="button" onClick={() => ordenar(campo)} className="flex min-h-8 cursor-pointer items-center gap-2 rounded text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label={`Ordenar por ${titulo}${ordem.coluna === campo && ordem.direcao === 'asc' ? ' em ordem decrescente' : ' em ordem crescente'}`}>
                      {titulo}{ordem.coluna !== campo ? <ArrowUpDown aria-hidden="true" size={16} strokeWidth={2} /> : ordem.direcao === 'asc' ? <ArrowUp aria-hidden="true" size={16} strokeWidth={2} /> : <ArrowDown aria-hidden="true" size={16} strokeWidth={2} />}
                    </button>
                  </th>)}
                </tr></thead>
                <tbody className="divide-y divide-foreground/5">
                  {paginacao.itens.map((posto) => <tr key={posto.id} className="hover:bg-foreground/[0.025]">
                    <td className="coluna-action">
                      <MenuAcoesRegistro key={paginacao.chaveRolagem} registro={posto.codigo} acoes={[
                        { rotulo: 'Editar', icone: Pencil, executar: (botao) => abrirFormulario(posto, botao) },
                        { rotulo: posto.ativo ? 'Inativar' : 'Ativar', icone: posto.ativo ? PowerOff : Power, indisponivel: alterandoStatus !== null, motivo: 'Aguarde a alteração em andamento.', executar: () => { void alternarStatus(posto); } },
                      ]} />
                    </td>
                    <td className="max-w-48 px-3 py-3 font-medium break-words [overflow-wrap:anywhere]">{posto.codigo}</td>
                    <td className="max-w-80 px-3 py-3 break-words text-subtle [overflow-wrap:anywhere]">{posto.nome}</td>
                    <td className="max-w-64 px-3 py-3 break-words text-subtle [overflow-wrap:anywhere]">{posto.setor.nome}</td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${posto.ativo ? 'border-success-fill/20 bg-success-fill/10 text-success' : 'border-foreground/10 bg-foreground/5 text-muted'}`}>{posto.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted"><time dateTime={posto.createdAt}>{formatarDataCadastro(posto.createdAt)}</time></td>
                  </tr>)}
                  {visiveis.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-muted"><Factory aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mb-3" />{postos.length === 0 ? 'Nenhum posto cadastrado.' : 'Nenhum posto encontrado para os filtros selecionados.'}</td></tr>}
                </tbody>
              </table>
            </TabelaComRolagem>
            <PaginacaoTabela legenda="Postos" paginacao={paginacao} totalGeral={postos.length} />
          </>
        )}
      </section>
      <WorkstationFormDialog dialogRef={dialogRef} pedido={pedido} aoConcluir={recarregarApos} aoFechar={() => origemFoco.current?.focus()} />
    </div>
  );
}
