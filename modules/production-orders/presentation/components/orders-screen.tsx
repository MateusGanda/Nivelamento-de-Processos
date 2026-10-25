'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ClipboardList, LoaderCircle, Pencil, Plus, Search } from 'lucide-react';
import { sugerirNumeroOrdem, type OpcoesOrdem, type Ordem } from '../../domain/ordem';
import { listarOrdens, ErroApiOrdens } from '../api-client';
import { filtrarOrdenarOrdens, formatarDataHora, formatarQuantidade, type ColunaOrdem, type OrdemListagem } from '../listing';
import { OrderFormDialog, type PedidoFormularioOrdem } from './order-form-dialog';

const colunas: ReadonlyArray<{ campo: ColunaOrdem; titulo: string }> = [
  { campo: 'numero', titulo: 'Número' }, { campo: 'produto', titulo: 'Produto' }, { campo: 'roteiro', titulo: 'Roteiro' },
  { campo: 'plano', titulo: 'Plano' }, { campo: 'quantidade', titulo: 'Quantidade' }, { campo: 'quantidadeExecucoes', titulo: 'Execuções' },
  { campo: 'createdAt', titulo: 'Criada em' },
];
type Acao = 'cadastrada' | 'alterada';
const acoes: readonly Acao[] = ['cadastrada', 'alterada'];
const mensagemSucesso = (acao: Acao) => `Ordem ${acao} com sucesso.`;
const mensagemFalhaAtualizacao = (acao: Acao) => `Ordem ${acao}, mas não foi possível atualizar a lista. Use Tentar novamente para recarregar, sem repetir a operação.`;

export function OrdersScreen({ opcoes }: { opcoes: OpcoesOrdem }) {
  const router = useRouter();
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [ordem, setOrdem] = useState<OrdemListagem>({ coluna: 'numero', direcao: 'asc' });
  const [pedido, setPedido] = useState<PedidoFormularioOrdem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const origemFoco = useRef<HTMLButtonElement | null>(null);
  const pedidoLista = useRef(0);
  const montado = useRef(false);

  const carregarLista = useCallback((signal?: AbortSignal): Promise<boolean | null> => {
    const numero = ++pedidoLista.current;
    return listarOrdens(signal).then((dados) => {
      if (signal?.aborted || !montado.current || numero !== pedidoLista.current) return null;
      setOrdens(dados);
      setErro('');
      setMensagem((atual) => {
        const acao = acoes.find((item) => atual === mensagemFalhaAtualizacao(item));
        return acao ? mensagemSucesso(acao) : atual;
      });
      return true;
    }).catch((falha: unknown) => {
      if (signal?.aborted || !montado.current || numero !== pedidoLista.current) return null;
      if (falha instanceof ErroApiOrdens && (falha.status === 401 || falha.status === 403)) {
        setOrdens([]);
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiOrdens ? falha.message : 'Não foi possível carregar as ordens. Verifique sua conexão e tente novamente.');
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

  function abrirFormulario(item: Ordem | null, botao: HTMLButtonElement) {
    if (dialogRef.current?.open) return;
    origemFoco.current = botao;
    setPedido((atual) => ({ ordem: item, numeroSugerido: sugerirNumeroOrdem(ordens.map((o) => o.numero)), seq: (atual?.seq ?? 0) + 1 }));
  }

  function aoConcluir(acao: Acao) {
    setMensagem(mensagemSucesso(acao));
    setCarregando(true);
    setErro('');
    void carregarLista().then((sucesso) => {
      if (sucesso === false && montado.current) setMensagem(mensagemFalhaAtualizacao(acao));
    });
    // A ordem nova trava o roteiro; atualiza as opções que vêm do servidor.
    if (acao === 'cadastrada') router.refresh();
  }

  const visiveis = useMemo(() => filtrarOrdenarOrdens(ordens, busca, planoId, ordem), [ordens, busca, planoId, ordem]);

  function ordenar(coluna: ColunaOrdem) {
    setOrdem((atual) => ({ coluna, direcao: atual.coluna === coluna && atual.direcao === 'asc' ? 'desc' : 'asc' }));
  }

  const semCadastros = opcoes.planos.length === 0 || opcoes.produtos.length === 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-semibold tracking-tight">Ordens de Produção</h1><p className="mt-2 text-sm leading-6 text-muted">Crie e acompanhe as ordens, cada uma com o produto, a versão do roteiro, o plano e a quantidade.</p></div>
        <button
          type="button" aria-haspopup="dialog" aria-controls="formulario-ordem"
          onClick={(event) => abrirFormulario(null, event.currentTarget)}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        ><Plus aria-hidden="true" size={20} strokeWidth={2} />Adicionar ordem</button>
      </header>

      {semCadastros && (
        <p className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm leading-6 text-[#ffcf99]">
          Para criar ordens é preciso ter ao menos um <Link href="/painel/planos-de-producao" className="underline underline-offset-4">plano de produção</Link> e um <Link href="/painel/produtos" className="underline underline-offset-4">produto ativo</Link> ligado a um <Link href="/painel/roteiros" className="underline underline-offset-4">roteiro</Link> com etapas.
        </p>
      )}
      {mensagem && <p role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-[#7bcba5]/25 bg-[#7bcba5]/5 p-4 text-sm leading-6 text-[#a6dfbf]"><CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{mensagem}</p>}

      <section aria-label="Listagem de ordens" aria-busy={carregando} className="mt-7 min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
        <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:p-5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="ordens-busca" className="mb-2 block text-sm font-medium">Buscar ordens</label>
            <div className="relative"><Search aria-hidden="true" size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input id="ordens-busca" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Número, produto ou roteiro" className="h-11 w-full rounded-lg border border-[#3b454e] bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <div className="lg:w-56"><label htmlFor="ordens-plano" className="mb-2 block text-sm font-medium">Plano</label>
            <select id="ordens-plano" value={planoId} onChange={(event) => setPlanoId(event.target.value)} className="h-11 w-full rounded-lg border border-[#3b454e] bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="">Todos os planos</option>
              {opcoes.planos.map((plano) => <option key={plano.id} value={plano.id}>{plano.codigo}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => { setBusca(''); setPlanoId(''); }} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Limpar filtros</button>
        </div>

        {/* Na recarga após gravar, a tabela continua na tela para o foco voltar ao botão Editar. */}
        {carregando && ordens.length === 0 ? (
          <p role="status" className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando ordens…</p>
        ) : erro ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
            <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>
            <button type="button" onClick={() => { setCarregando(true); setErro(''); void carregarLista(); }} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Tentar novamente</button>
          </div>
        ) : (
          <>
            <div className="max-w-full overflow-x-auto rounded-b-xl">
              <table className="w-full min-w-[1020px] text-left text-sm">
                <caption className="sr-only">Ordens de produção cadastradas. Use os cabeçalhos para ordenar as colunas.</caption>
                <thead className="border-b border-white/10 bg-white/[0.025] text-muted"><tr>
                  {colunas.map(({ campo, titulo }) => <th key={campo} scope="col" aria-sort={ordem.coluna === campo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-5 py-3 font-medium">
                    <button type="button" onClick={() => ordenar(campo)} className="flex min-h-8 cursor-pointer items-center gap-2 rounded text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label={`Ordenar por ${titulo}${ordem.coluna === campo && ordem.direcao === 'asc' ? ' em ordem decrescente' : ' em ordem crescente'}`}>
                      {titulo}{ordem.coluna !== campo ? <ArrowUpDown aria-hidden="true" size={16} strokeWidth={2} /> : ordem.direcao === 'asc' ? <ArrowUp aria-hidden="true" size={16} strokeWidth={2} /> : <ArrowDown aria-hidden="true" size={16} strokeWidth={2} />}
                    </button>
                  </th>)}
                  <th scope="col" className="px-5 py-3 text-right font-medium"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {visiveis.map((item) => <tr key={item.id} className="hover:bg-white/[0.025]">
                    <td className="px-5 py-4 font-medium whitespace-nowrap">{item.numero}</td>
                    <td className="max-w-64 px-5 py-4 text-[#c1c8cf]"><span className="font-medium text-foreground">{item.produto.codigo}</span> – {item.produto.nome}</td>
                    <td className="max-w-64 px-5 py-4 text-[#c1c8cf]"><Link href={`/painel/roteiros/${item.roteiro.id}`} className="underline-offset-4 hover:underline">{item.roteiro.nome} – v{item.roteiro.versao}</Link></td>
                    <td className="px-5 py-4 whitespace-nowrap text-[#c1c8cf]">{item.plano.codigo}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-[#c1c8cf]">{formatarQuantidade(item.quantidade)} {item.unidade}</td>
                    <td className="px-5 py-4 text-[#c1c8cf]">{item.quantidadeExecucoes}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted"><time dateTime={item.createdAt}>{formatarDataHora(item.createdAt)}</time></td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" aria-haspopup="dialog" aria-controls="formulario-ordem" aria-label={`Editar ${item.numero}`}
                        onClick={(event) => abrirFormulario(item, event.currentTarget)}
                        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      ><Pencil aria-hidden="true" size={16} strokeWidth={2} />Editar</button>
                    </td>
                  </tr>)}
                  {visiveis.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-muted"><ClipboardList aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mb-3" />{ordens.length === 0 ? 'Nenhuma ordem cadastrada.' : 'Nenhuma ordem encontrada para os filtros selecionados.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <p aria-live="polite" className="border-t border-white/10 px-5 py-3 text-xs text-muted">{visiveis.length} de {ordens.length} ordens</p>
          </>
        )}
      </section>
      <OrderFormDialog dialogRef={dialogRef} pedido={pedido} opcoes={opcoes} aoConcluir={aoConcluir} aoFechar={() => origemFoco.current?.focus()} />
    </div>
  );
}
