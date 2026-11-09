'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Check, Copy, KeyRound, LoaderCircle, X } from 'lucide-react';
import { consultarChaveIlha, ErroApiIlha, gerarChaveIlha, type SituacaoChaveIlha } from '../api-client';

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

function descricao(situacao: SituacaoChaveIlha): string {
  if (situacao.origem === 'PAINEL') {
    return `Chave gerada em ${DATA_HORA.format(new Date(situacao.trocadaEm!))}${situacao.trocadaPor ? ` por ${situacao.trocadaPor}` : ''}.`;
  }
  if (situacao.origem === 'AMBIENTE') return 'Em uso a chave definida na configuração do servidor. Gere uma chave aqui para poder trocá-la pelo painel sempre que precisar.';
  return 'A ilha ainda não tem chave e nenhum terminal pode ser liberado. Gere a primeira chave para começar.';
}

// Bloco da página Execuções: o administrador troca a chave do terminal sem depender de quem configura o servidor.
// A chave nova aparece uma única vez; o banco guarda só o resumo.
export function ChaveIlhaPainel() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const emEnvio = useRef(false);
  const [situacao, setSituacao] = useState<SituacaoChaveIlha | null>(null);
  const [erroCarga, setErroCarga] = useState('');
  const [modo, setModo] = useState<'confirmar' | 'exibir'>('confirmar');
  const [chave, setChave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);

  const sairSeSemAcesso = useCallback((falha: unknown) => {
    if (falha instanceof ErroApiIlha && (falha.status === 401 || falha.status === 403)) {
      router.replace('/login');
      router.refresh();
      return true;
    }
    return false;
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    consultarChaveIlha(controller.signal)
      .then((dados) => { setSituacao(dados); setErroCarga(''); })
      .catch((falha) => {
        if (controller.signal.aborted || sairSeSemAcesso(falha)) return;
        setErroCarga(falha instanceof ErroApiIlha ? falha.message : 'Não foi possível consultar a chave da ilha.');
      });
    return () => controller.abort();
  }, [sairSeSemAcesso]);

  function abrir() {
    setModo('confirmar');
    setChave('');
    setErro('');
    setCopiado(false);
    dialogRef.current?.showModal();
  }

  async function gerar() {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      const resultado = await gerarChaveIlha();
      setSituacao(resultado.situacao);
      setChave(resultado.chave);
      setModo('exibir');
    } catch (falha) {
      if (!sairSeSemAcesso(falha)) setErro(falha instanceof ErroApiIlha ? falha.message : 'Não foi possível gerar a chave. Verifique sua conexão e tente novamente.');
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(chave); setCopiado(true); } catch { setCopiado(false); }
  }

  function aoFechar() {
    // A chave não fica guardada na tela depois de fechar a janela.
    setChave('');
    botaoRef.current?.focus();
  }

  const botaoSecundario = 'min-h-11 cursor-pointer rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';
  const botaoPrincipal = 'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70';

  return (
    <section aria-labelledby="chave-ilha-titulo" className="mt-8 rounded-xl border border-[#2b353e] bg-[#192128]/65 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 id="chave-ilha-titulo" className="flex items-center gap-2 text-lg font-semibold"><KeyRound aria-hidden="true" size={20} strokeWidth={2} />Chave da ilha</h2>
          <p className="mt-1 text-sm leading-6 text-muted" aria-live="polite">
            {erroCarga ? <span className="text-[#ffb4a5]">{erroCarga}</span> : situacao ? descricao(situacao) : 'Consultando a chave…'}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">Use quando a chave vazar ou quando alguém que a conhecia deixar a equipe. Os terminais precisam da chave nova para voltar a registrar.</p>
        </div>
        <button ref={botaoRef} type="button" aria-haspopup="dialog" aria-controls="chave-ilha-dialogo" onClick={abrir} disabled={!situacao}
          className={`${botaoSecundario} flex shrink-0 items-center justify-center gap-2`}>
          <KeyRound aria-hidden="true" size={18} />{situacao?.origem === 'NENHUMA' ? 'Gerar a chave' : 'Gerar nova chave'}
        </button>
      </div>

      <dialog id="chave-ilha-dialogo" ref={dialogRef} aria-labelledby="chave-ilha-dialogo-titulo"
        onCancel={(event) => { if (emEnvio.current) event.preventDefault(); }} onClose={aoFechar}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <h2 id="chave-ilha-dialogo-titulo" className="text-xl font-semibold">{modo === 'exibir' ? 'Nova chave da ilha' : 'Gerar nova chave da ilha'}</h2>
          <button type="button" onClick={() => { if (!emEnvio.current) dialogRef.current?.close(); }} disabled={enviando} aria-label="Fechar" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"><X aria-hidden="true" size={22} strokeWidth={2} /></button>
        </div>
        {modo === 'exibir' ? (
          <div className="space-y-5 p-6">
            <p className="text-sm leading-6 text-muted">Digite esta chave em cada terminal da ilha para liberá-lo de novo. Ela aparece só agora: anote ou copie antes de fechar. Não envie a chave em grupos.</p>
            <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-5 text-center font-mono text-xl font-bold tracking-[0.12em] break-all sm:text-2xl" aria-label={`Chave ${chave}`}>{chave}</p>
            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button type="button" onClick={() => dialogRef.current?.close()} className={botaoSecundario}>Fechar</button>
              <button type="button" onClick={() => void copiar()} className={botaoPrincipal}>
                {copiado ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}{copiado ? 'Copiada' : 'Copiar chave'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <p className="flex items-start gap-2 text-sm leading-6 text-[#ffcf99]"><AlertTriangle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />Todos os terminais da ilha serão bloqueados na hora e só voltam a funcionar com a chave nova. A chave antiga deixa de valer.</p>
            <p className="text-sm leading-6 text-muted">As execuções abertas não mudam: só o acesso dos terminais é bloqueado.</p>
            {erro && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button type="button" onClick={() => dialogRef.current?.close()} disabled={enviando} className={botaoSecundario}>Cancelar</button>
              <button type="button" onClick={() => void gerar()} disabled={enviando} className={botaoPrincipal}>
                {enviando ? <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" /> : <KeyRound aria-hidden="true" size={18} />}Gerar e bloquear terminais
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
