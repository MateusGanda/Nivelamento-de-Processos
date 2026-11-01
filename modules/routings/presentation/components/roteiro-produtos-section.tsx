'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Lock, Package, Plus, Star, Trash2 } from 'lucide-react';
import type { RoteiroDetalhe, TempoInformado } from '../../domain/roteiro';
import type { Produto } from '../../../products/domain/produto';
import { listarProdutos } from '../../../products/presentation/api-client';
import { ligarProdutoRoteiro, removerProdutoRoteiro, salvarTemposRoteiro, tornarVigenteRoteiro } from '../api-client';
import { TemposPadraoDialog, type PedidoTemposPadrao } from './tempos-padrao-dialog';

const botaoLinha = 'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

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
  // Produto inativo não aparece para ligações novas.
  const disponiveis = (produtos ?? []).filter((produto) => produto.ativo && !ligados.has(produto.id));
  const totalEtapas = roteiro.etapas.length;

  async function ligar() {
    if (!produtoNovo || ocupado) return;
    await executar(() => ligarProdutoRoteiro(roteiro.id, produtoNovo), 'Produto ligado ao roteiro. Defina os tempos padrão e, se for o caso, torne esta versão a vigente.', 'Não foi possível ligar o produto. Tente novamente.');
    setProdutoNovo('');
  }

  return (
    <section aria-labelledby="produtos-titulo" className="mt-7 min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
      <div className="border-b border-white/10 p-4 sm:p-5">
        <h2 id="produtos-titulo" className="text-lg font-semibold">Produtos e tempos padrão</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Produtos que seguem esta versão do roteiro. A versão vigente é a usada nas próximas ordens do produto, e cada produto tem uma só. O tempo padrão é por produto e etapa, em segundos por unidade.</p>
      </div>

      {roteiro.produtos.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted"><Package aria-hidden="true" size={28} strokeWidth={2} className="mx-auto mb-3" />Nenhum produto ligado a esta versão.</p>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">Produtos ligados a esta versão do roteiro.</caption>
            <thead className="border-b border-white/10 bg-white/[0.025] text-muted"><tr>
              <th scope="col" className="px-5 py-3 font-medium">Produto</th>
              <th scope="col" className="px-5 py-3 font-medium">Vigência</th>
              <th scope="col" className="px-5 py-3 font-medium">Ordens</th>
              <th scope="col" className="px-5 py-3 font-medium">Tempos padrão</th>
              <th scope="col" className="px-5 py-3 text-right font-medium"><span className="sr-only">Ações</span></th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {roteiro.produtos.map((produto) => {
                const completos = produto.tempos.length;
                return (
                  <tr key={produto.id} className="hover:bg-white/[0.025]">
                    <td className="max-w-80 px-5 py-4"><span className="font-medium">{produto.codigo}</span> <span className="text-[#c1c8cf]">– {produto.nome}</span></td>
                    <td className="px-5 py-4">
                      {produto.vigente
                        ? <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"><Star aria-hidden="true" size={14} strokeWidth={2} />Vigente</span>
                        : <button type="button" aria-label={`Tornar esta versão vigente para ${produto.codigo}`} aria-disabled={ocupado || !roteiro.ativo}
                            title={!roteiro.ativo ? 'Ative o roteiro antes de torná-lo vigente.' : undefined}
                            onClick={() => { if (!ocupado && roteiro.ativo) void executar(() => tornarVigenteRoteiro(roteiro.id, produto.id), `Esta versão agora é a vigente para ${produto.codigo}.`, 'Não foi possível definir a vigência. Tente novamente.'); }}
                            className={botaoLinha}><Star aria-hidden="true" size={16} strokeWidth={2} />Tornar vigente</button>}
                    </td>
                    <td className="px-5 py-4 text-[#c1c8cf]">{produto.quantidadeOrdens}</td>
                    <td className="px-5 py-4">
                      <span className={completos === totalEtapas && totalEtapas > 0 ? 'text-[#c1c8cf]' : 'text-[#ffcf99]'}>{completos} de {totalEtapas} etapas</span>
                      {produto.travado && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted"><Lock aria-hidden="true" size={12} strokeWidth={2} />travados</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" aria-haspopup="dialog" aria-controls="tempos-padrao" aria-label={`Tempos padrão de ${produto.codigo}`}
                          aria-disabled={etapasPendentes} title={etapasPendentes ? 'Salve ou descarte as alterações das etapas antes de mudar os tempos.' : undefined}
                          onClick={(event) => { if (etapasPendentes) return; origemFoco.current = event.currentTarget; setPedidoTempos((atual) => ({ produto, seq: (atual?.seq ?? 0) + 1 })); }}
                          className={botaoLinha}><Clock aria-hidden="true" size={16} strokeWidth={2} />Tempos</button>
                        <button type="button" aria-label={`Remover ${produto.codigo} deste roteiro`} aria-disabled={ocupado || produto.quantidadeOrdens > 0}
                          title={produto.quantidadeOrdens > 0 ? 'O produto tem ordens com esta versão; a ligação não pode ser removida.' : undefined}
                          onClick={() => { if (!ocupado && produto.quantidadeOrdens === 0) void executar(() => removerProdutoRoteiro(roteiro.id, produto.id), `${produto.codigo} foi retirado deste roteiro.`, 'Não foi possível remover o produto. Tente novamente.'); }}
                          className={botaoLinha}><Trash2 aria-hidden="true" size={16} strokeWidth={2} />Remover</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-end sm:p-5">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="roteiro-produto" className="mb-2 block text-sm font-medium">Ligar produto a esta versão</label>
          <select id="roteiro-produto" value={produtoNovo} onChange={(event) => setProdutoNovo(event.target.value)} disabled={!produtos || disponiveis.length === 0 || ocupado} className="h-11 w-full rounded-lg border border-[#3b454e] bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60">
            <option value="">{produtos === null && !erroProdutos ? 'Carregando produtos…' : disponiveis.length === 0 ? 'Nenhum produto disponível' : 'Selecione o produto'}</option>
            {disponiveis.map((produto) => <option key={produto.id} value={produto.id}>{produto.codigo} – {produto.nome}</option>)}
          </select>
          {erroProdutos && <p role="alert" className="mt-2 text-xs text-[#ffb4a5]">{erroProdutos}</p>}
        </div>
        <button type="button" onClick={() => void ligar()} disabled={!produtoNovo || ocupado} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"><Plus aria-hidden="true" size={18} strokeWidth={2} />Ligar produto</button>
      </div>

      <TemposPadraoDialog
        dialogRef={dialogTemposRef} pedido={pedidoTempos} etapas={roteiro.etapas} aoFechar={() => origemFoco.current?.focus()}
        salvar={(produtoId: string, tempos: TempoInformado[]) => salvarTempos(() => salvarTemposRoteiro(roteiro.id, produtoId, tempos))}
      />
    </section>
  );
}
