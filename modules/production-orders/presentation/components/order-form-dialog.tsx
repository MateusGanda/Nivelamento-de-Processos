'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Lock, LoaderCircle, X } from 'lucide-react';
import type { OpcoesOrdem, Ordem, RoteiroDoProduto } from '../../domain/ordem';
import { alterarOrdem, cadastrarOrdem, ErroApiOrdens } from '../api-client';
import { formatarQuantidade, lerQuantidadeDigitada } from '../listing';

// ordem nula abre o cadastro; uma ordem abre a edição. seq permite reabrir a mesma ordem.
export type PedidoFormularioOrdem = { ordem: Ordem | null; numeroSugerido: string; seq: number };

// Só versões ativas e com etapas podem receber ordens novas.
const roteirosDisponiveis = (roteiros: readonly RoteiroDoProduto[]) => roteiros.filter((roteiro) => roteiro.ativo && roteiro.quantidadeEtapas > 0);

export function OrderFormDialog({ dialogRef, pedido, opcoes, aoConcluir, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoFormularioOrdem | null;
  opcoes: OpcoesOrdem;
  aoConcluir: (acao: 'cadastrada' | 'alterada') => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [numero, setNumero] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [roteiroId, setRoteiroId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [erro, setErro] = useState('');
  const ordem = pedido?.ordem ?? null;
  const edicao = ordem !== null;
  const producaoTravada = edicao && ordem.quantidadeExecucoes > 0;
  const roteiros = roteirosDisponiveis(opcoes.produtos.find((produto) => produto.id === produtoId)?.roteiros ?? []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setNumero(pedido.ordem?.numero ?? pedido.numeroSugerido);
    setPlanoId(pedido.ordem?.plano.id ?? '');
    setProdutoId(pedido.ordem?.produto.id ?? '');
    setRoteiroId(pedido.ordem?.roteiro.id ?? '');
    setQuantidade(pedido.ordem ? String(pedido.ordem.quantidade).replace('.', ',') : '');
    setUnidade(pedido.ordem?.unidade ?? 'un');
    setErro('');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>('#ordem-numero')?.focus();
  }, [pedido, dialogRef]);

  function escolherProduto(id: string) {
    setProdutoId(id);
    // Já sugere a versão vigente do produto; outra versão ligada a ele pode ser escolhida.
    const disponiveis = roteirosDisponiveis(opcoes.produtos.find((produto) => produto.id === id)?.roteiros ?? []);
    setRoteiroId((disponiveis.find((roteiro) => roteiro.vigente) ?? disponiveis[0])?.id ?? '');
  }

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    const quantidadeLida = lerQuantidadeDigitada(quantidade);
    if (!numero.trim() || !planoId || (!edicao && (!produtoId || !roteiroId))) {
      setErro('Informe o número, o plano, o produto e a versão do roteiro.');
      return;
    }
    if (!producaoTravada && (quantidadeLida === undefined || !unidade.trim())) {
      setErro('Informe uma quantidade maior que zero, com até duas casas decimais, e a unidade.');
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      if (ordem) {
        await alterarOrdem(ordem.id, { numero, planoId, ...(producaoTravada ? {} : { quantidade: quantidadeLida, unidade }) });
      } else {
        await cadastrarOrdem({ numero, planoId, produtoId, roteiroId, quantidade: quantidadeLida!, unidade });
      }
      dialogRef.current?.close();
      aoConcluir(ordem ? 'alterada' : 'cadastrada');
    } catch (falha) {
      if (falha instanceof ErroApiOrdens && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiOrdens ? falha.message : 'Não foi possível confirmar a gravação. Verifique sua conexão e tente novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const campo = 'mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';
  const produtoSemRoteiro = !edicao && produtoId !== '' && roteiros.length === 0;

  return (
    <dialog
      id="formulario-ordem" ref={dialogRef} aria-labelledby="formulario-ordem-titulo" aria-describedby="formulario-ordem-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="formulario-ordem-titulo" className="text-xl font-semibold">{edicao ? 'Editar ordem' : 'Adicionar ordem'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label={edicao ? 'Fechar edição' : 'Fechar cadastro'} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="formulario-ordem-descricao" className="text-sm leading-6 text-muted">
          {edicao ? 'O produto e a versão do roteiro ficam fixos na ordem. Para usar outra versão, crie uma ordem nova.' : 'A ordem guarda a versão do roteiro escolhida aqui; mudanças posteriores no roteiro não a alteram.'}
        </p>
        <div>
          <label htmlFor="ordem-numero" className="block text-sm font-medium">Número</label>
          <input id="ordem-numero" name="numero" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={numero} onChange={(event) => setNumero(event.target.value)} disabled={enviando} className={campo} aria-describedby="ordem-numero-ajuda" />
          <p id="ordem-numero-ajuda" className="mt-2 text-xs leading-5 text-muted">Único para cada ordem; normalmente o número da ficha.</p>
        </div>
        <div>
          <label htmlFor="ordem-plano" className="block text-sm font-medium">Plano de produção</label>
          <select id="ordem-plano" name="planoId" required value={planoId} onChange={(event) => setPlanoId(event.target.value)} disabled={enviando || opcoes.planos.length === 0} className={campo}>
            <option value="">{opcoes.planos.length === 0 ? 'Nenhum plano cadastrado' : 'Selecione o plano'}</option>
            {opcoes.planos.map((plano) => <option key={plano.id} value={plano.id}>{plano.codigo}</option>)}
          </select>
        </div>
        {edicao ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm leading-6">
            <p><span className="text-muted">Produto:</span> {ordem.produto.codigo} – {ordem.produto.nome}</p>
            <p><span className="text-muted">Roteiro:</span> {ordem.roteiro.nome}, versão {ordem.roteiro.versao}</p>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="ordem-produto" className="block text-sm font-medium">Produto</label>
              <select id="ordem-produto" name="produtoId" required value={produtoId} onChange={(event) => escolherProduto(event.target.value)} disabled={enviando || opcoes.produtos.length === 0} className={campo}>
                <option value="">{opcoes.produtos.length === 0 ? 'Nenhum produto ativo' : 'Selecione o produto'}</option>
                {opcoes.produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.codigo} – {produto.nome}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ordem-roteiro" className="block text-sm font-medium">Versão do roteiro</label>
              <select id="ordem-roteiro" name="roteiroId" required value={roteiroId} onChange={(event) => setRoteiroId(event.target.value)} disabled={enviando || roteiros.length === 0} className={campo} aria-describedby="ordem-roteiro-ajuda">
                <option value="">{!produtoId ? 'Escolha o produto primeiro' : roteiros.length === 0 ? 'Nenhuma versão disponível' : 'Selecione a versão'}</option>
                {roteiros.map((roteiro) => <option key={roteiro.id} value={roteiro.id}>{roteiro.nome} – v{roteiro.versao}{roteiro.vigente ? ' (vigente)' : ''}</option>)}
              </select>
              <p id="ordem-roteiro-ajuda" className={`mt-2 text-xs leading-5 ${produtoSemRoteiro ? 'text-[#ffcf99]' : 'text-muted'}`}>
                {produtoSemRoteiro ? 'Este produto não tem versão de roteiro ativa e com etapas. Ligue-o a um roteiro antes de criar a ordem.' : 'A versão vigente do produto já vem escolhida.'}
              </p>
            </div>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <label htmlFor="ordem-quantidade" className="block text-sm font-medium">Quantidade</label>
            <input id="ordem-quantidade" name="quantidade" type="text" inputMode="decimal" autoComplete="off" required={!producaoTravada} value={quantidade} onChange={(event) => setQuantidade(event.target.value)} disabled={enviando || producaoTravada} className={campo} />
          </div>
          <div>
            <label htmlFor="ordem-unidade" className="block text-sm font-medium">Unidade</label>
            <input id="ordem-unidade" name="unidade" type="text" autoComplete="off" required={!producaoTravada} value={unidade} onChange={(event) => setUnidade(event.target.value)} disabled={enviando || producaoTravada} className={campo} />
          </div>
        </div>
        {producaoTravada && (
          <p className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-[#c1c8cf]">
            <Lock aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
            A ordem já tem execuções. A quantidade ({formatarQuantidade(ordem.quantidade)} {ordem.unidade}) e a unidade ficam fixas porque a baixa é conferida com elas.
          </p>
        )}
        {erro && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className="min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={enviando || produtoSemRoteiro} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}
            {edicao ? (enviando ? 'Salvando…' : 'Salvar alterações') : (enviando ? 'Cadastrando…' : 'Cadastrar ordem')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
