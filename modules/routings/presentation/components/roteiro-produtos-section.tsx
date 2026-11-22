'use client';

import { useEffect, useRef, useState } from 'react';
import { PaginacaoTabela } from '@/shared/presentation/paginacao-tabela';
import { MenuAcoesRegistro } from '@/shared/presentation/menu-acoes-registro';
import { TabelaComRolagem } from '@/shared/presentation/tabela-com-rolagem';
import { usePaginacaoTabela } from '@/shared/presentation/use-paginacao-tabela';
import { Clock, Lock, Package, Plus, Star, Trash2 } from 'lucide-react';
import type { RoteiroDetalhe, TempoInformado } from '../../domain/roteiro';
import type { Produto } from '../../../products/domain/produto';
import { listarProdutos } from '../../../products/presentation/api-client';
import { ligarProdutoRoteiro, removerProdutoRoteiro, salvarTemposRoteiro, tornarVigenteRoteiro } from '../api-client';
import { TemposPadraoDialog, type PedidoTemposPadrao } from './tempos-padrao-dialog';


export function RoteiroProdutosSection({ roteiro, etapasPendentes, ocupado, executar, salvarTempos }: {
  roteiro: RoteiroDetalhe;
  // Com etapas alteradas e não salvas, os tempos esperariam etapas que ainda não existem.
  etapasPendentes: boolean;
  ocupado: boolean;
  executar: (acao: () => Promise<RoteiroDetalhe>, sucesso: string, padrao: string) => Promise<void>;
  salvarTempos: (acao: () => Promise<RoteiroDetalhe>) => Promise<string | null>;
}) {
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [erroProdutos, setErroProdutos] = useState('');
  const [produtoNovo, setProdutoNovo] = useState('');
  const [pedidoTempos, setPedidoTempos] = useState<PedidoTemposPadrao | null>(null);
  const dialogTemposRef = useRef<HTMLDialogElement>(null);
  const origemFoco = useRef<HTMLButtonElement | null>(null);

  // Os produtos alimentam a escolha; carregados uma vez ao montar a tela.
  useEffect(() => {
    const controller = new AbortController();
    listarProdutos(controller.signal)
      .then((dados) => { if (!controller.signal.aborted) setProdutos(dados); })
      .catch(() => { if (!controller.signal.aborted) setErroProdutos('Não foi possível carregar os produtos. Atualize a página.'); });
    return () => controller.abort();
  }, []);

  const ligados = new Set(roteiro.produtos.map((produto) => produto.id));
  const paginacao = usePaginacaoTabela(roteiro.produtos, roteiro.id);
  // Produto inativo não aparece para ligações novas.
  const disponiveis = (produtos ?? []).filter((produto) => produto.ativo && !ligados.has(produto.id));
  const totalEtapas = roteiro.etapas.length;

  async function ligar() {
    if (!produtoNovo || ocupado) return;
    await executar(() => ligarProdutoRoteiro(roteiro.id, produtoNovo), 'Produto ligado ao roteiro. Defina os tempos padrão e, se for o caso, torne esta versão a vigente.', 'Não foi possível ligar o produto. Tente novamente.');
    setProdutoNovo('');
  }

  return (
    <section aria-labelledby="produtos-titulo" className="mt-7 min-w-0 rounded-lg border border-line-soft bg-surface">
      <div className="border-b border-foreground/10 p-4 sm:p-5">
        <h2 id="produtos-titulo" className="text-lg font-semibold">Produtos e tempos padrão</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Produtos que seguem esta versão do roteiro. A versão vigente é a usada nas próximas ordens do produto, e cada produto tem uma só. O tempo padrão é por produto e etapa, em segundos por unidade.</p>
      </div>

      {roteiro.produtos.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted"><Package aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mb-3" />Nenhum produto ligado a esta versão.</p>
      ) : (
        <TabelaComRolagem legenda="Produtos vinculados ao roteiro" chaveRolagem={paginacao.chaveRolagem}>
          <table className="tabela-com-acoes tabular-nums w-full text-left text-sm">
            <caption className="sr-only">Produtos ligados a esta versão do roteiro.</caption>
            <thead className="border-b border-foreground/10 bg-foreground/[0.025] text-muted"><tr>
              <th scope="col" className="coluna-action font-medium">Action</th>
              <th scope="col" className="px-3 py-3 font-medium">Produto</th>
              <th scope="col" className="px-3 py-3 font-medium">Vigência</th>
              <th scope="col" className="px-3 py-3 font-medium">Ordens</th>
              <th scope="col" className="px-3 py-3 font-medium">Tempos padrão</th>
            </tr></thead>
            <tbody className="divide-y divide-foreground/5">
              {paginacao.itens.map((produto) => {
                const completos = produto.tempos.length;
                return (
                  <tr key={produto.id} className="hover:bg-foreground/[0.025]">
                    <td className="coluna-action">
                      <MenuAcoesRegistro key={paginacao.chaveRolagem} registro={produto.codigo} acoes={[
                        { rotulo: 'Tempos padrão', icone: Clock, indisponivel: etapasPendentes, motivo: 'Salve ou descarte as alterações das etapas.', executar: (botao) => { origemFoco.current = botao; setPedidoTempos((atual) => ({ produto, seq: (atual?.seq ?? 0) + 1 })); } },
                        ...(!produto.vigente ? [{ rotulo: 'Tornar vigente', icone: Star, indisponivel: ocupado || !roteiro.ativo, motivo: !roteiro.ativo ? 'Ative o roteiro para torná-lo vigente.' : 'Aguarde a alteração em andamento.', executar: () => { void executar(() => tornarVigenteRoteiro(roteiro.id, produto.id), `Esta versão agora é a vigente para ${produto.codigo}.`, 'Não foi possível definir a vigência. Tente novamente.'); } }] : []),
                        { rotulo: 'Remover vínculo', icone: Trash2, indisponivel: ocupado || produto.quantidadeOrdens > 0, motivo: produto.quantidadeOrdens > 0 ? 'O produto tem ordens com esta versão.' : 'Aguarde a alteração em andamento.', executar: () => { void executar(() => removerProdutoRoteiro(roteiro.id, produto.id), `${produto.codigo} foi retirado deste roteiro.`, 'Não foi possível remover o produto. Tente novamente.'); } },
                      ]} />
                    </td>
                    <td className="max-w-80 px-3 py-3"><span className="font-medium">{produto.codigo}</span> <span className="text-subtle">– {produto.nome}</span></td>
                    <td className="px-3 py-3">
                      {produto.vigente
                        ? <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-ink"><Star aria-hidden="true" size={14} strokeWidth={2} />Vigente</span>
                        : <span className="text-muted">Não vigente</span>}
                    </td>
                    <td className="px-3 py-3 text-subtle">{produto.quantidadeOrdens}</td>
                    <td className="px-3 py-3">
                      <span className={completos === totalEtapas && totalEtapas > 0 ? 'text-subtle' : 'text-warning'}>{completos} de {totalEtapas} etapas</span>
                      {produto.travado && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted"><Lock aria-hidden="true" size={12} strokeWidth={2} />travados</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabelaComRolagem>
      )}
      {roteiro.produtos.length > 0 && <PaginacaoTabela legenda="Produtos vinculados ao roteiro" paginacao={paginacao} />}

      <div className="flex flex-col gap-3 border-t border-foreground/10 p-4 sm:flex-row sm:items-end sm:p-5">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="roteiro-produto" className="mb-2 block text-sm font-medium">Ligar produto a esta versão</label>
          <select id="roteiro-produto" value={produtoNovo} onChange={(event) => setProdutoNovo(event.target.value)} disabled={!produtos || disponiveis.length === 0 || ocupado} className="h-11 w-full rounded-md border border-line bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60">
            <option value="">{produtos === null && !erroProdutos ? 'Carregando produtos…' : disponiveis.length === 0 ? 'Nenhum produto disponível' : 'Selecione o produto'}</option>
            {disponiveis.map((produto) => <option key={produto.id} value={produto.id}>{produto.codigo} – {produto.nome}</option>)}
          </select>
          {erroProdutos && <p role="alert" className="mt-2 text-xs text-danger">{erroProdutos}</p>}
        </div>
        <button type="button" onClick={() => void ligar()} disabled={!produtoNovo || ocupado} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"><Plus aria-hidden="true" size={18} strokeWidth={2} />Ligar produto</button>
      </div>

      <TemposPadraoDialog
        dialogRef={dialogTemposRef} pedido={pedidoTempos} etapas={roteiro.etapas} aoFechar={() => origemFoco.current?.focus()}
        salvar={(produtoId: string, tempos: TempoInformado[]) => salvarTempos(() => salvarTemposRoteiro(roteiro.id, produtoId, tempos))}
      />
    </section>
  );
}
