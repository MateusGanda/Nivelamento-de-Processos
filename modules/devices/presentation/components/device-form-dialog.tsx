'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import type { Dispositivo } from '../../domain/dispositivo';
import { alterarDispositivo, cadastrarDispositivo, ErroApiDispositivos } from '../api-client';
import { LIMITES_TEXTO } from '../../../../shared/validation';

export type PedidoFormularioDispositivo = { dispositivo: Dispositivo | null; seq: number };
type SetorOpcao = { id: string; nome: string; ativo: boolean };

export function DeviceFormDialog({ dialogRef, pedido, setores, aoCadastrar, aoAlterar, aoFechar }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pedido: PedidoFormularioDispositivo | null;
  setores: SetorOpcao[];
  aoCadastrar: (resultado: { dispositivo: Dispositivo; codigo: string }) => void;
  aoAlterar: () => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState('');
  const [local, setLocal] = useState('');
  const [setorId, setSetorId] = useState('');
  const [erro, setErro] = useState('');
  const dispositivo = pedido?.dispositivo ?? null;
  const edicao = dispositivo !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pedido || !dialog) return;
    setNome(pedido.dispositivo?.nome ?? '');
    setLocal(pedido.dispositivo?.local ?? '');
    setSetorId(pedido.dispositivo?.setor?.id ?? '');
    setErro('');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>('#dispositivo-nome')?.focus();
  }, [pedido, dialogRef]);

  function fechar() {
    if (!emEnvio.current) dialogRef.current?.close();
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;
    if (!nome.trim()) { setErro('Informe o nome da TV.'); return; }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    const dados = { nome, local: local.trim() || null, setorId: setorId || null };
    try {
      if (dispositivo) {
        await alterarDispositivo(dispositivo.id, dados);
        dialogRef.current?.close();
        aoAlterar();
      } else {
        const resultado = await cadastrarDispositivo(dados);
        dialogRef.current?.close();
        aoCadastrar(resultado);
      }
    } catch (falha) {
      if (falha instanceof ErroApiDispositivos && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
      } else {
        setErro(falha instanceof ErroApiDispositivos ? falha.message : 'Não foi possível confirmar a gravação. Verifique sua conexão e tente novamente.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const campo = 'mt-2 h-12 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';
  const botaoSecundario = 'min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';
  const opcoes = setores.filter((s) => s.ativo || s.id === setorId);

  return (
    <dialog
      id="formulario-dispositivo" ref={dialogRef} aria-labelledby="formulario-dispositivo-titulo" aria-describedby="formulario-dispositivo-descricao"
      onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) fechar();
      } }}
      onClose={() => { setNome(''); setLocal(''); setSetorId(''); setErro(''); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <h2 id="formulario-dispositivo-titulo" className="text-xl font-semibold">{edicao ? 'Editar TV' : 'Adicionar TV'}</h2>
        <button type="button" onClick={fechar} disabled={enviando} aria-label={edicao ? 'Fechar edição' : 'Fechar cadastro'} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
      </div>
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-5 p-6">
        <p id="formulario-dispositivo-descricao" className="text-sm leading-6 text-muted">
          {edicao ? 'Altere o nome, o local ou o setor exibido. A TV continua liberada com o mesmo código.' : 'A TV mostra em tempo real a situação dos postos, a produção do dia e a carga pendente. Ao cadastrar, o sistema gera o código de acesso, exibido uma única vez.'}
        </p>
        <div>
          <label htmlFor="dispositivo-nome" className="block text-sm font-medium">Nome</label>
          <input id="dispositivo-nome" maxLength={LIMITES_TEXTO.nome} type="text" autoComplete="off" required value={nome} onChange={(event) => setNome(event.target.value)} disabled={enviando} className={campo} placeholder="Ex.: TV da Montagem" />
        </div>
        <div>
          <label htmlFor="dispositivo-local" className="block text-sm font-medium">Local <span className="font-normal text-muted">(opcional)</span></label>
          <input id="dispositivo-local" maxLength={LIMITES_TEXTO.nome} type="text" autoComplete="off" value={local} onChange={(event) => setLocal(event.target.value)} disabled={enviando} className={campo} placeholder="Ex.: Parede da linha 2" />
        </div>
        <div>
          <label htmlFor="dispositivo-setor" className="block text-sm font-medium">Setor exibido</label>
          <select id="dispositivo-setor" value={setorId} onChange={(event) => setSetorId(event.target.value)} disabled={enviando} className={`${campo} px-3`}>
            <option value="">Todos os setores</option>
            {opcoes.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.ativo ? '' : ' (inativo)'}</option>)}
          </select>
        </div>
        {erro && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-white/10 pt-5 sm:flex-row">
          <button type="button" onClick={fechar} disabled={enviando} className={botaoSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70">
            {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}
            {edicao ? (enviando ? 'Salvando…' : 'Salvar alterações') : (enviando ? 'Cadastrando…' : 'Cadastrar TV')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
