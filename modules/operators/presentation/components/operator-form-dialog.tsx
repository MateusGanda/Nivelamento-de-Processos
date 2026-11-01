'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import type { Operador } from '../../domain/operador';
import type { Setor } from '../../../sectors/domain/setor';
import { listarSetores, ErroApiSetores } from '../../../sectors/presentation/api-client';
import { alterarOperador, cadastrarOperador, ErroApiOperadores } from '../api-client';

export type PedidoFormularioOperador = { operador: Operador | null; seq: number };

export function OperatorFormDialog({ dialogRef, pedido, aoConcluir, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoFormularioOperador | null;
  aoConcluir: (operador: Operador, acao: 'cadastrado' | 'alterado') => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const abortSetores = useRef<AbortController | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState('');
  const [setorPrincipalId, setSetorPrincipalId] = useState('');
  const [funcao, setFuncao] = useState('');
  const [erro, setErro] = useState('');
  const [setores, setSetores] = useState<Setor[]>([]);
  const [carregandoSetores, setCarregandoSetores] = useState(false);
  const [erroSetores, setErroSetores] = useState('');
  const operador = pedido?.operador ?? null;
  const edicao = operador !== null;

  const carregarSetores = useCallback(() => {
    abortSetores.current?.abort();
    const controller = new AbortController();
    abortSetores.current = controller;
    setCarregandoSetores(true);
    setErroSetores('');
    void listarSetores(controller.signal).then((dados) => {
      if (!controller.signal.aborted) setSetores(dados);
    }).catch((falha: unknown) => {
      if (controller.signal.aborted) return;
      if (falha instanceof ErroApiSetores && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login'); router.refresh();
      } else setErroSetores('Não foi possível carregar os setores. Tente novamente.');
    }).finally(() => { if (!controller.signal.aborted) setCarregandoSetores(false); });
  }, [router]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setNome(pedido.operador?.nome ?? '');
    setSetorPrincipalId(pedido.operador?.setorPrincipal?.id ?? '');
    setFuncao(pedido.operador?.funcao ?? '');
    setErro('');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>('#operador-nome')?.focus();
    carregarSetores();
    return () => { abortSetores.current?.abort(); };
  }, [pedido, dialogRef, carregarSetores]);

  function fechar() { if (!emEnvio.current) dialogRef.current?.close(); }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current || carregandoSetores || erroSetores) return;
    if (!nome.trim() || (!edicao && !setorPrincipalId)) { setErro('Informe o nome e selecione o setor principal.'); return; }
    emEnvio.current = true; setEnviando(true); setErro('');
    try {
      const resultado = operador
        ? await alterarOperador(operador.id, { nome, funcao, ...(setorPrincipalId ? { setorPrincipalId } : {}) })
        : await cadastrarOperador({ nome, setorPrincipalId, funcao });
      dialogRef.current?.close();
      aoConcluir(resultado, edicao ? 'alterado' : 'cadastrado');
    } catch (falha) {
      if (falha instanceof ErroApiOperadores && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login'); router.refresh();
      } else setErro(falha instanceof ErroApiOperadores ? falha.message : 'Não foi possível confirmar a gravação. Verifique sua conexão e tente novamente.');
    } finally { emEnvio.current = false; setEnviando(false); }
  }

  const campo = 'mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';
  const secundario = 'min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';
  return (
    <dialog id="cadastro-operador" ref={dialogRef} aria-labelledby="cadastro-operador-titulo" aria-describedby="cadastro-operador-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { abortSetores.current?.abort(); setNome(''); setFuncao(''); setSetorPrincipalId(''); setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="cadastro-operador-titulo" className="text-xl font-semibold">{edicao ? 'Editar operador' : 'Adicionar operador'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label={edicao ? 'Fechar edição' : 'Fechar cadastro'} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"><X aria-hidden="true" size={22} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="cadastro-operador-descricao" className="text-sm leading-6 text-muted">{edicao ? 'Atualize os dados do operador. A matrícula é permanente, mesmo após mudança de nome ou setor.' : 'A matrícula será gerada automaticamente após cadastrar. O novo operador será criado como ativo.'}</p>
        {operador && <div><label htmlFor="operador-matricula" className="block text-sm font-medium">Matrícula</label><input id="operador-matricula" readOnly value={operador.matricula} className={`${campo} text-muted`} /></div>}
        <div><label htmlFor="operador-nome" className="block text-sm font-medium">Nome</label><input id="operador-nome" name="nome" type="text" autoComplete="off" required value={nome} onChange={(event) => setNome(event.target.value)} disabled={enviando} className={campo} aria-describedby={erro ? 'cadastro-operador-erro' : undefined} /></div>
        <div>
          <label htmlFor="operador-setor" className="block text-sm font-medium">Setor principal {edicao && !operador?.setorPrincipal && <span className="font-normal text-muted">(cadastro antigo sem setor)</span>}</label>
          <select id="operador-setor" name="setorPrincipalId" required={!edicao} value={setorPrincipalId} onChange={(event) => setSetorPrincipalId(event.target.value)} disabled={enviando || carregandoSetores || !!erroSetores} className={campo} aria-describedby="operador-setor-ajuda">
            <option value="" disabled={!edicao || !!operador?.setorPrincipal}>{carregandoSetores ? 'Carregando setores…' : edicao ? 'Sem setor definido' : 'Selecione um setor'}</option>
            {/* Setor inativo só aparece quando já é o setor principal deste operador. */}
            {setores.filter((setor) => setor.ativo || setor.id === operador?.setorPrincipal?.id).map((setor) => <option key={setor.id} value={setor.id}>{setor.codigo} — {setor.nome}{setor.ativo ? '' : ' (inativo)'}</option>)}
          </select>
          <p id="operador-setor-ajuda" className="mt-2 text-xs leading-5 text-muted">O setor principal informa a lotação habitual e não limita os postos de trabalho.</p>
          {!carregandoSetores && !erroSetores && setores.length === 0 && <p role="status" className="mt-2 text-sm text-muted">Nenhum setor cadastrado. Cadastre um setor antes de adicionar operadores.</p>}
          {erroSetores && <div className="mt-2 space-y-2"><p role="alert" className="text-sm text-[#ffb4a5]">{erroSetores}</p><button type="button" onClick={carregarSetores} disabled={enviando} className={secundario}>Tentar carregar setores novamente</button></div>}
        </div>
        <div><label htmlFor="operador-funcao" className="block text-sm font-medium">Função <span className="font-normal text-muted">(opcional)</span></label><input id="operador-funcao" name="funcao" type="text" value={funcao} onChange={(event) => setFuncao(event.target.value)} disabled={enviando} placeholder="Ex.: Costureiro" className={campo} /></div>
        {erro && <p id="cadastro-operador-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} className="shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className={secundario}>Cancelar</button>
          <button type="submit" disabled={enviando || carregandoSetores || !!erroSetores || (!edicao && setores.length === 0)} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">
            {enviando && <LoaderCircle aria-hidden="true" size={20} className="motion-safe:animate-spin" />}{edicao ? (enviando ? 'Salvando…' : 'Salvar alterações') : (enviando ? 'Cadastrando…' : 'Cadastrar operador')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
