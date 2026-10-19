'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import type { Posto } from '../../domain/posto';
import type { Setor } from '../../../sectors/domain/setor';
import { listarSetores } from '../../../sectors/presentation/api-client';
import { alterarPosto, cadastrarPosto, ErroApiPostos } from '../api-client';

// posto nulo abre o cadastro; um posto abre a edição. seq permite reabrir o mesmo posto.
export type PedidoFormularioPosto = { posto: Posto | null; seq: number };

export function WorkstationFormDialog({ dialogRef, pedido, aoConcluir, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoFormularioPosto | null;
  aoConcluir: (acao: 'cadastrado' | 'alterado') => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [setorId, setSetorId] = useState('');
  const [erro, setErro] = useState('');
  const [setores, setSetores] = useState<Setor[] | null>(null);
  const [erroSetores, setErroSetores] = useState('');
  const posto = pedido?.posto ?? null;
  const edicao = posto !== null;

  // Os setores alimentam a lista de escolha; carregados uma vez ao montar a tela.
  useEffect(() => {
    const controller = new AbortController();
    listarSetores(controller.signal)
      .then((dados) => { if (!controller.signal.aborted) setSetores(dados); })
      .catch(() => { if (!controller.signal.aborted) setErroSetores('Não foi possível carregar os setores. Feche e abra o formulário novamente.'); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setCodigo(pedido.posto?.codigo ?? '');
    setNome(pedido.posto?.nome ?? '');
    setSetorId(pedido.posto?.setor.id ?? '');
    setErro('');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>('#posto-codigo')?.focus();
  }, [pedido, dialogRef]);

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    if (!codigo.trim() || !nome.trim() || !setorId) {
      setErro('Informe o código, o nome e o setor do posto.');
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      if (posto) await alterarPosto(posto.id, { codigo, nome, setorId });
      else await cadastrarPosto({ codigo, nome, setorId });
      dialogRef.current?.close();
      aoConcluir(posto ? 'alterado' : 'cadastrado');
    } catch (falha) {
      if (falha instanceof ErroApiPostos && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiPostos ? falha.message : 'Não foi possível confirmar a gravação. Verifique sua conexão e tente novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const semSetores = setores !== null && setores.length === 0;
  const campo = 'mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';
  const botaoSecundario = 'min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';

  return (
    <dialog
      id="formulario-posto" ref={dialogRef} aria-labelledby="formulario-posto-titulo" aria-describedby="formulario-posto-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setCodigo(''); setNome(''); setSetorId(''); setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="formulario-posto-titulo" className="text-xl font-semibold">{edicao ? 'Editar posto' : 'Adicionar posto'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label={edicao ? 'Fechar edição' : 'Fechar cadastro'} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="formulario-posto-descricao" className="text-sm leading-6 text-muted">
          {edicao ? 'Altere o código, o nome ou o setor. As execuções já registradas continuam ligadas a este posto.' : 'O posto é o local ou recurso onde as etapas são feitas. O novo posto será criado como ativo.'}
        </p>
        <div>
          <label htmlFor="posto-codigo" className="block text-sm font-medium">Código</label>
          <input id="posto-codigo" name="codigo" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={codigo} onChange={(event) => setCodigo(event.target.value)} disabled={enviando} className={campo} aria-describedby={erro ? 'formulario-posto-erro' : 'posto-codigo-ajuda'} />
          <p id="posto-codigo-ajuda" className="mt-2 text-xs leading-5 text-muted">Único para cada posto, por exemplo MON-01.</p>
        </div>
        <div>
          <label htmlFor="posto-nome" className="block text-sm font-medium">Nome</label>
          <input id="posto-nome" name="nome" type="text" autoComplete="off" required value={nome} onChange={(event) => setNome(event.target.value)} disabled={enviando} className={campo} aria-describedby={erro ? 'formulario-posto-erro' : undefined} />
        </div>
        <div>
          <label htmlFor="posto-setor" className="block text-sm font-medium">Setor</label>
          <select id="posto-setor" name="setorId" required value={setorId} onChange={(event) => setSetorId(event.target.value)} disabled={enviando || !setores || semSetores} className={campo}>
            <option value="">{setores === null && !erroSetores ? 'Carregando setores…' : 'Selecione o setor'}</option>
            {(setores ?? []).map((setor) => <option key={setor.id} value={setor.id}>{setor.nome}</option>)}
          </select>
          {semSetores && <p className="mt-2 text-xs leading-5 text-muted">Nenhum setor cadastrado. Cadastre um setor antes de adicionar postos.</p>}
          {erroSetores && <p role="alert" className="mt-2 text-xs leading-5 text-[#ffb4a5]">{erroSetores}</p>}
        </div>
        {erro && <p id="formulario-posto-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className={botaoSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando || semSetores} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}
            {edicao ? (enviando ? 'Salvando…' : 'Salvar alterações') : (enviando ? 'Cadastrando…' : 'Cadastrar posto')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
