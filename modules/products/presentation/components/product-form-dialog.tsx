'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import type { Produto } from '../../domain/produto';
import { alterarProduto, cadastrarProduto, ErroApiProdutos } from '../api-client';

// produto nulo abre o cadastro; um produto abre a edição. seq permite reabrir o mesmo produto.
export type PedidoFormularioProduto = { produto: Produto | null; seq: number };

export function ProductFormDialog({ dialogRef, pedido, aoConcluir, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoFormularioProduto | null;
  aoConcluir: (acao: 'cadastrado' | 'alterado') => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const produto = pedido?.produto ?? null;
  const edicao = produto !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setCodigo(pedido.produto?.codigo ?? '');
    setNome(pedido.produto?.nome ?? '');
    setErro('');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>('#produto-codigo')?.focus();
  }, [pedido, dialogRef]);

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    if (!codigo.trim() || !nome.trim()) {
      setErro('Informe o código e o nome do produto.');
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      if (produto) await alterarProduto(produto.id, { codigo, nome });
      else await cadastrarProduto({ codigo, nome });
      dialogRef.current?.close();
      aoConcluir(produto ? 'alterado' : 'cadastrado');
    } catch (falha) {
      if (falha instanceof ErroApiProdutos && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiProdutos ? falha.message : 'Não foi possível confirmar a gravação. Verifique sua conexão e tente novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const campo = 'mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';
  const botaoSecundario = 'min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';

  return (
    <dialog
      id="formulario-produto" ref={dialogRef} aria-labelledby="formulario-produto-titulo" aria-describedby="formulario-produto-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setCodigo(''); setNome(''); setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="formulario-produto-titulo" className="text-xl font-semibold">{edicao ? 'Editar produto' : 'Adicionar produto'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label={edicao ? 'Fechar edição' : 'Fechar cadastro'} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="formulario-produto-descricao" className="text-sm leading-6 text-muted">
          {edicao ? 'Altere o código ou o nome. As ordens de produção já criadas continuam ligadas a este produto.' : 'O produto é o item fabricado. O roteiro e os tempos padrão são definidos depois, no cadastro de roteiros.'}
        </p>
        <div>
          <label htmlFor="produto-codigo" className="block text-sm font-medium">Código</label>
          <input id="produto-codigo" name="codigo" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={codigo} onChange={(event) => setCodigo(event.target.value)} disabled={enviando} className={campo} aria-describedby={erro ? 'formulario-produto-erro' : 'produto-codigo-ajuda'} />
          <p id="produto-codigo-ajuda" className="mt-2 text-xs leading-5 text-muted">Único para cada produto, por exemplo PRD-001.</p>
        </div>
        <div>
          <label htmlFor="produto-nome" className="block text-sm font-medium">Nome</label>
          <input id="produto-nome" name="nome" type="text" autoComplete="off" required value={nome} onChange={(event) => setNome(event.target.value)} disabled={enviando} className={campo} aria-describedby={erro ? 'formulario-produto-erro' : undefined} />
        </div>
        {erro && <p id="formulario-produto-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className={botaoSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}
            {edicao ? (enviando ? 'Salvando…' : 'Salvar alterações') : (enviando ? 'Cadastrando…' : 'Cadastrar produto')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
