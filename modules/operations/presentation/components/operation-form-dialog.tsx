'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import type { Operacao } from '../../domain/operacao';
import { alterarOperacao, cadastrarOperacao, ErroApiOperacoes } from '../api-client';

export type PedidoFormularioOperacao = { operacao: Operacao | null; seq: number };

export function OperationFormDialog({ dialogRef, pedido, aoConcluir, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoFormularioOperacao | null;
  aoConcluir: (acao: 'cadastrado' | 'alterado') => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState('');
  const operacao = pedido?.operacao ?? null;
  const edicao = operacao !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setNome(pedido.operacao?.nome ?? '');
    setDescricao(pedido.operacao?.descricao ?? '');
    setErro('');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>('#operacao-nome')?.focus();
  }, [pedido, dialogRef]);

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    if (!nome.trim()) { setErro('Informe o nome da operação.'); return; }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      if (operacao) await alterarOperacao(operacao.id, { nome, descricao });
      else await cadastrarOperacao({ nome, descricao });
      dialogRef.current?.close();
      aoConcluir(operacao ? 'alterado' : 'cadastrado');
    } catch (falha) {
      if (falha instanceof ErroApiOperacoes && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiOperacoes ? falha.message : 'Não foi possível confirmar a gravação. Verifique sua conexão e tente novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const campo = 'mt-2 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';
  const botaoSecundario = 'min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';

  return (
    <dialog
      id="formulario-operacao" ref={dialogRef} aria-labelledby="formulario-operacao-titulo" aria-describedby="formulario-operacao-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setNome(''); setDescricao(''); setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="formulario-operacao-titulo" className="text-xl font-semibold">{edicao ? 'Editar operação' : 'Adicionar operação'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label={edicao ? 'Fechar edição' : 'Fechar cadastro'} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="formulario-operacao-descricao" className="text-sm leading-6 text-muted">
          {edicao ? 'Altere o nome ou a descrição. Os vínculos com as etapas dos roteiros serão preservados.' : 'A operação é uma atividade do processo produtivo. O tempo padrão é definido por produto e etapa no roteiro.'}
        </p>
        <div>
          <label htmlFor="operacao-nome" className="block text-sm font-medium">Nome</label>
          <input id="operacao-nome" name="nome" type="text" autoComplete="off" required value={nome} onChange={(event) => setNome(event.target.value)} disabled={enviando} className={`${campo} h-12`} aria-describedby={erro ? 'formulario-operacao-erro' : 'operacao-nome-ajuda'} />
          <p id="operacao-nome-ajuda" className="mt-2 text-xs leading-5 text-muted">Nome único, por exemplo Corte ou Montagem.</p>
        </div>
        <div>
          <label htmlFor="operacao-descricao" className="block text-sm font-medium">Descrição <span className="font-normal text-muted">(opcional)</span></label>
          <textarea id="operacao-descricao" name="descricao" rows={3} value={descricao} onChange={(event) => setDescricao(event.target.value)} disabled={enviando} className={`${campo} min-h-24 resize-y py-3`} />
        </div>
        {erro && <p id="formulario-operacao-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className={botaoSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}
            {edicao ? (enviando ? 'Salvando…' : 'Salvar alterações') : (enviando ? 'Cadastrando…' : 'Cadastrar operação')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
