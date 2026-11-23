'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PaginacaoTabela } from '@/shared/presentation/paginacao-tabela';
import { MenuAcoesRegistro } from '@/shared/presentation/menu-acoes-registro';
import { TabelaComRolagem } from '@/shared/presentation/tabela-com-rolagem';
import { usePaginacaoTabela } from '@/shared/presentation/use-paginacao-tabela';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, CheckCircle2, LoaderCircle, Pencil, Plus, Search } from 'lucide-react';
import type { Plano } from '../../domain/plano';
import { listarPlanos, ErroApiPlanos } from '../api-client';
import { filtrarOrdenarPlanos, formatarData, formatarDataHora, type ColunaPlano, type OrdemPlano } from '../listing';
import { PlanFormDialog, type PedidoFormularioPlano } from './plan-form-dialog';

const colunas: ReadonlyArray<{ campo: ColunaPlano; titulo: string }> = [
  { campo: 'codigo', titulo: 'Código' }, { campo: 'descricao', titulo: 'Descrição' }, { campo: 'dataInicio', titulo: 'Início' },
  { campo: 'dataFim', titulo: 'Fim' }, { campo: 'quantidadeOrdens', titulo: 'Ordens' }, { campo: 'updatedAt', titulo: 'Alterado em' },
];
type Acao = 'cadastrado' | 'alterado';
const acoes: readonly Acao[] = ['cadastrado', 'alterado'];
const mensagemSucesso = (acao: Acao) => `Plano ${acao} com sucesso.`;
const mensagemFalhaAtualizacao = (acao: Acao) => `Plano ${acao}, mas não foi possível atualizar a lista. Use Tentar novamente para recarregar, sem repetir a operação.`;

export function PlansScreen() {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<OrdemPlano>({ coluna: 'codigo', direcao: 'asc' });
  const [pedido, setPedido] = useState<PedidoFormularioPlano | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const origemFoco = useRef<HTMLButtonElement | null>(null);
  const pedidoLista = useRef(0);
  const montado = useRef(false);

  const carregarLista = useCallback((signal?: AbortSignal): Promise<boolean | null> => {
    const numero = ++pedidoLista.current;
    return listarPlanos(signal).then((dados) => {
      if (signal?.aborted || !montado.current || numero !== pedidoLista.current) return null;
      setPlanos(dados);
      setErro('');
      setMensagem((atual) => {
        const acao = acoes.find((item) => atual === mensagemFalhaAtualizacao(item));
        return acao ? mensagemSucesso(acao) : atual;
      });
      return true;
    }).catch((falha: unknown) => {
      if (signal?.aborted || !montado.current || numero !== pedidoLista.current) return null;
      if (falha instanceof ErroApiPlanos && (falha.status === 401 || falha.status === 403)) {
        setPlanos([]);
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiPlanos ? falha.message : 'Não foi possível carregar os planos. Verifique sua conexão e tente novamente.');
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

  function abrirFormulario(plano: Plano | null, botao: HTMLButtonElement) {
    if (dialogRef.current?.open) return;
    origemFoco.current = botao;
    setPedido((atual) => ({ plano, seq: (atual?.seq ?? 0) + 1 }));
  }

  function aoConcluir(acao: Acao) {
    setMensagem(mensagemSucesso(acao));
    setCarregando(true);
    setErro('');
    void carregarLista().then((sucesso) => {
      if (sucesso === false && montado.current) setMensagem(mensagemFalhaAtualizacao(acao));
    });
  }

  const visiveis = useMemo(() => filtrarOrdenarPlanos(planos, busca, ordem), [planos, busca, ordem]);
  const paginacao = usePaginacaoTabela(visiveis, JSON.stringify([busca, ordem]));

  function ordenar(coluna: ColunaPlano) {
    setOrdem((atual) => ({ coluna, direcao: atual.coluna === coluna && atual.direcao === 'asc' ? 'desc' : 'asc' }));
  }

  return (
    <div className="pagina-com-tabela mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-semibold tracking-tight">Planos de Produção</h1><p className="mt-2 text-sm leading-6 text-muted">Cadastre, consulte e altere os planos que agrupam as ordens de produção.</p></div>
        <button
          type="button" aria-haspopup="dialog" aria-controls="formulario-plano"
          onClick={(event) => abrirFormulario(null, event.currentTarget)}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        ><Plus aria-hidden="true" size={20} strokeWidth={2} />Adicionar plano</button>
      </header>

      {mensagem && <p role="status" className="mt-6 flex items-start gap-2 rounded-md border border-success-fill/25 bg-success-fill/5 p-4 text-sm leading-6 text-success"><CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{mensagem}</p>}

      <section aria-label="Listagem de planos" aria-busy={carregando} className="listagem-com-rolagem mt-7 min-w-0 rounded-lg border border-line-soft bg-surface">
        <div className="flex flex-col gap-4 border-b border-foreground/10 p-4 sm:p-5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="planos-busca" className="mb-2 block text-sm font-medium">Buscar planos</label>
            <div className="relative"><Search aria-hidden="true" size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input id="planos-busca" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Código ou descrição" className="h-11 w-full rounded-md border border-line bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <button type="button" onClick={() => setBusca('')} className="min-h-11 cursor-pointer rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Limpar busca</button>
        </div>

        {/* Na recarga após gravar, a tabela continua na tela para o foco voltar ao botão Editar. */}
        {carregando && planos.length === 0 ? (
          <p role="status" className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando planos…</p>
        ) : erro ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
            <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-danger"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>
            <button type="button" onClick={() => { setCarregando(true); setErro(''); void carregarLista(); }} className="min-h-11 cursor-pointer rounded-md border border-line px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Tentar novamente</button>
          </div>
        ) : (
          <>
            <TabelaComRolagem legenda="Planos de produção" chaveRolagem={paginacao.chaveRolagem}>
              <table className="tabela-com-acoes tabular-nums w-full text-left text-sm">
                <caption className="sr-only">Planos de produção cadastrados. Use os cabeçalhos para ordenar as colunas.</caption>
                <thead className="border-b border-foreground/10 bg-foreground/[0.025] text-muted"><tr>
                  <th scope="col" className="coluna-action font-medium">Ações</th>
                  {colunas.map(({ campo, titulo }) => <th key={campo} scope="col" aria-sort={ordem.coluna === campo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-3 font-medium">
                    <button type="button" onClick={() => ordenar(campo)} className="flex min-h-8 cursor-pointer items-center gap-2 rounded text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label={`Ordenar por ${titulo}${ordem.coluna === campo && ordem.direcao === 'asc' ? ' em ordem decrescente' : ' em ordem crescente'}`}>
                      {titulo}{ordem.coluna !== campo ? <ArrowUpDown aria-hidden="true" size={16} strokeWidth={2} /> : ordem.direcao === 'asc' ? <ArrowUp aria-hidden="true" size={16} strokeWidth={2} /> : <ArrowDown aria-hidden="true" size={16} strokeWidth={2} />}
                    </button>
                  </th>)}
                </tr></thead>
                <tbody className="divide-y divide-foreground/5">
                  {paginacao.itens.map((plano) => <tr key={plano.id} className="hover:bg-foreground/[0.025]">
                    <td className="coluna-action">
                      <MenuAcoesRegistro key={paginacao.chaveRolagem} registro={plano.codigo} acoes={[
                        { rotulo: 'Editar', icone: Pencil, executar: (botao) => abrirFormulario(plano, botao) },
                      ]} />
                    </td>
                    <td className="max-w-48 px-3 py-3 font-medium break-words [overflow-wrap:anywhere]">{plano.codigo}</td>
                    <td className="max-w-96 px-3 py-3 break-words text-subtle [overflow-wrap:anywhere]">{plano.descricao ?? <span className="text-muted">Sem descrição</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-subtle">{plano.dataInicio ? <time dateTime={plano.dataInicio}>{formatarData(plano.dataInicio)}</time> : <span className="text-muted">—</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-subtle">{plano.dataFim ? <time dateTime={plano.dataFim}>{formatarData(plano.dataFim)}</time> : <span className="text-muted">—</span>}</td>
                    <td className="px-3 py-3 text-subtle">{plano.quantidadeOrdens}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted"><time dateTime={plano.updatedAt}>{formatarDataHora(plano.updatedAt)}</time></td>
                  </tr>)}
                  {visiveis.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-muted"><CalendarRange aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mb-3" />{planos.length === 0 ? 'Nenhum plano cadastrado.' : 'Nenhum plano encontrado para a busca.'}</td></tr>}
                </tbody>
              </table>
            </TabelaComRolagem>
            <PaginacaoTabela legenda="Planos de produção" paginacao={paginacao} totalGeral={planos.length} />
          </>
        )}
      </section>
      <PlanFormDialog dialogRef={dialogRef} pedido={pedido} aoConcluir={aoConcluir} aoFechar={() => origemFoco.current?.focus()} />
    </div>
  );
}
