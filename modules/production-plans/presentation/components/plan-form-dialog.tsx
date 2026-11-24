'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import type { Plano } from '../../domain/plano';
import { alterarPlano, cadastrarPlano, ErroApiPlanos } from '../api-client';
import { LIMITES_TEXTO } from '../../../../shared/validation';

// plano nulo abre o cadastro; um plano abre a edição. seq permite reabrir o mesmo plano.
export type PedidoFormularioPlano = { plano: Plano | null; seq: number };

export function PlanFormDialog({ dialogRef, pedido, aoConcluir, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoFormularioPlano | null;
  aoConcluir: (acao: 'cadastrado' | 'alterado', codigo: string) => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [erro, setErro] = useState('');
  const plano = pedido?.plano ?? null;
  const edicao = plano !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setDescricao(pedido.plano?.descricao ?? '');
    setDataInicio(pedido.plano?.dataInicio ?? '');
    setDataFim(pedido.plano?.dataFim ?? '');
    setErro('');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLTextAreaElement>('#plano-descricao')?.focus();
  }, [pedido, dialogRef]);

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    if (dataInicio && dataFim && dataFim < dataInicio) {
      setErro('A data de fim não pode ser anterior à data de início.');
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    const dados = { descricao: descricao || null, dataInicio: dataInicio || null, dataFim: dataFim || null };
    try {
      const confirmado = plano ? await alterarPlano(plano.id, dados) : await cadastrarPlano(dados);
      dialogRef.current?.close();
      aoConcluir(plano ? 'alterado' : 'cadastrado', confirmado.codigo);
    } catch (falha) {
      if (falha instanceof ErroApiPlanos && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiPlanos ? falha.message : 'Não foi possível confirmar a gravação. Verifique sua conexão e tente novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const campo = 'mt-2 h-12 w-full rounded-md border border-line bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60 [color-scheme:dark]';

  return (
    <dialog
      id="formulario-plano" ref={dialogRef} aria-labelledby="formulario-plano-titulo" aria-describedby="formulario-plano-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setDescricao(''); setDataInicio(''); setDataFim(''); setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-line-raised bg-raised p-0 text-foreground shadow-lg backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between gap-4 border-b border-foreground/10 px-6 py-4">
        <h2 id="formulario-plano-titulo" className="text-xl font-semibold">{edicao ? 'Editar plano' : 'Adicionar plano'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label={edicao ? 'Fechar edição' : 'Fechar cadastro'} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="formulario-plano-descricao" className="text-sm leading-6 text-muted">
          {edicao ? 'Altere os dados do plano. As ordens de produção ligadas a ele continuam no plano.' : 'O plano agrupa as ordens de produção de um período. O período é opcional.'}
        </p>
        {plano ? (
          <div>
            <label htmlFor="plano-codigo" className="block text-sm font-medium">Código</label>
            <input id="plano-codigo" type="text" readOnly value={plano.codigo} className={campo} />
            <p className="mt-2 text-xs leading-5 text-muted">O código é permanente.</p>
          </div>
        ) : <p className="text-sm text-muted">O código será gerado automaticamente ao cadastrar.</p>}
        <div>
          <label htmlFor="plano-descricao" className="block text-sm font-medium">Descrição <span className="font-normal text-muted">(opcional)</span></label>
          <textarea id="plano-descricao" maxLength={LIMITES_TEXTO.descricao} name="descricao" rows={3} value={descricao} onChange={(event) => setDescricao(event.target.value)} disabled={enviando} className={`${campo} h-auto py-3`} />
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium">Período <span className="font-normal text-muted">(opcional)</span></legend>
          <div>
            <label htmlFor="plano-inicio" className="block text-sm text-subtle">Início</label>
            <input id="plano-inicio" name="dataInicio" type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} disabled={enviando} className={campo} />
          </div>
          <div>
            <label htmlFor="plano-fim" className="block text-sm text-subtle">Fim</label>
            <input id="plano-fim" name="dataFim" type="date" min={dataInicio || undefined} value={dataFim} onChange={(event) => setDataFim(event.target.value)} disabled={enviando} className={campo} />
          </div>
        </fieldset>
        {erro && <p id="formulario-plano-erro" role="alert" className="flex items-start gap-2 rounded-md border border-danger-fill/25 bg-danger-fill/5 p-3 text-sm leading-6 text-danger"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-foreground/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className="min-h-11 cursor-pointer rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={enviando} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}
            {edicao ? (enviando ? 'Salvando…' : 'Salvar alterações') : (enviando ? 'Cadastrando…' : 'Cadastrar plano')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
