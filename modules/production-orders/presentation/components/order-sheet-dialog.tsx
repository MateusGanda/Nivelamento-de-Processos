'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertCircle, Cog, Download, LoaderCircle, Printer, RefreshCw, X } from 'lucide-react';
import { ErroApiOrdens } from '../api-client';
import { ErroApiRoteiros } from '../../../routings/presentation/api-client';
import { ErroFichaOrdem, prepararFichaOrdem, type FichaOrdem } from '../ficha-ordem';
import { formatarQuantidade } from '../listing';

function DocumentoOrdem({ ficha, aoCarregar, aoFalhar }: { ficha: FichaOrdem; aoCarregar?: () => void; aoFalhar?: () => void }) {
  const { ordem } = ficha;
  return (
    <article className="ficha-ordem-documento" aria-label={'Ficha da ordem ' + ordem.numero}>
      <header className="ficha-ordem-cabecalho">
        <div>
          <div className="ficha-ordem-marca"><Cog aria-hidden="true" size={26} strokeWidth={2} /><strong>GUNP</strong></div>
          <p className="ficha-ordem-subtitulo">Ordem de produção</p>
          <h3>{ordem.numero}</h3>
        </div>
        <div className="ficha-ordem-area-qr">
          {/* PNG local embutido, compartilhado pela prévia, download e impressão. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ficha.qrPng} width={1024} height={1024} alt={'QR Code da ordem ' + ordem.numero} onLoad={aoCarregar} onError={aoFalhar} />
          <p>Identificação da ordem</p>
        </div>
      </header>
      <dl className="ficha-ordem-resumo">
        <div className="ficha-ordem-produto"><dt>Produto</dt><dd>{ordem.produto.codigo} — {ordem.produto.nome}</dd></div>
        <div><dt>Quantidade</dt><dd>{formatarQuantidade(ordem.quantidade)} {ordem.unidade}</dd></div>
        <div><dt>Plano de produção</dt><dd>{ordem.plano.codigo}</dd></div>
        <div className="ficha-ordem-roteiro"><dt>Roteiro</dt><dd>{ordem.roteiro.nome} — versão {ordem.roteiro.versao}</dd></div>
      </dl>
      <table className="ficha-ordem-etapas">
        <caption>Etapas do roteiro</caption>
        <thead><tr><th scope="col">Sequência</th><th scope="col">Operação</th></tr></thead>
        <tbody>{ficha.etapas.map((etapa) => <tr key={etapa.id}><td>{etapa.ordem}</td><td>{etapa.operacao}</td></tr>)}</tbody>
      </table>
      <p className="ficha-ordem-nota">Esta ficha apresenta as etapas previstas. Consulte na ilha as etapas disponíveis para execução.</p>
    </article>
  );
}

export function OrderSheetDialog({ ordemId, aoFechar }: { ordemId: string; aoFechar: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const consultaRef = useRef<AbortController | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [ficha, setFicha] = useState<FichaOrdem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [qrCarregado, setQrCarregado] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    fecharRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    consultaRef.current = controller;
    void prepararFichaOrdem(ordemId, controller.signal).then((resultado) => {
      if (!controller.signal.aborted) setFicha(resultado);
    }).catch((falha: unknown) => {
      if (controller.signal.aborted) return;
      const erroApi = falha instanceof ErroApiOrdens || falha instanceof ErroApiRoteiros;
      if (erroApi && (falha.status === 401 || falha.status === 403)) {
        dialogRef.current?.close(); router.replace('/login'); router.refresh();
      } else setErro(erroApi || falha instanceof ErroFichaOrdem ? falha.message : 'Não foi possível preparar a ficha. Verifique sua conexão e tente novamente.');
    }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [ordemId, tentativa, router]);

  const pronta = !!ficha && qrCarregado;
  useEffect(() => {
    if (!pronta) return;
    document.body.classList.add('imprimindo-ficha-ordem');
    return () => document.body.classList.remove('imprimindo-ficha-ordem');
  }, [pronta]);

  function fechar() { consultaRef.current?.abort(); dialogRef.current?.close(); }

  function tentarNovamente() {
    consultaRef.current?.abort();
    setCarregando(true); setFicha(null); setErro(''); setQrCarregado(false);
    setTentativa((atual) => atual + 1);
  }

  function baixarQr() {
    if (!ficha || !pronta) return;
    const link = document.createElement('a');
    link.href = ficha.qrPng; link.download = ficha.nomeArquivo;
    document.body.appendChild(link); link.click(); link.remove();
  }

  const secundario = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';
  return <>
    <dialog ref={dialogRef} id="ficha-ordem" aria-labelledby="ficha-ordem-titulo" aria-describedby="ficha-ordem-descricao"
      onCancel={() => consultaRef.current?.abort()}
      onClose={() => { consultaRef.current?.abort(); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <h2 id="ficha-ordem-titulo" className="text-xl font-semibold">Ficha com QR</h2>
        <button ref={fecharRef} type="button" onClick={fechar} aria-label="Fechar ficha da ordem" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent"><X aria-hidden="true" size={22} /></button>
      </div>
      <div className="space-y-5 p-4 sm:p-6" aria-busy={carregando}>
        <p id="ficha-ordem-descricao" className="text-sm leading-6 text-muted">Dados da ordem e etapas da versão de roteiro vinculada a ela. O QR permanece igual mesmo após alterar o número da ordem.</p>
        {carregando && <p role="status" className="flex min-h-44 items-center justify-center gap-3 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} className="motion-safe:animate-spin" />Preparando ficha…</p>}
        {erro && <div className="space-y-3"><p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} className="shrink-0" />{erro}</p><button type="button" onClick={tentarNovamente} className={secundario}><RefreshCw aria-hidden="true" size={18} />Tentar novamente</button></div>}
        {ficha && <>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={baixarQr} disabled={!pronta} className={secundario}><Download aria-hidden="true" size={18} />Baixar QR em PNG</button>
            <button type="button" onClick={() => { if (pronta) window.print(); }} disabled={!pronta} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"><Printer aria-hidden="true" size={18} />Imprimir ficha</button>
          </div>
          <p className="text-xs leading-5 text-muted">Imprima em A4, escala de 100%, sem cabeçalhos e rodapés do navegador. Fichas extensas continuam nas páginas seguintes. Você também pode salvar em PDF na impressão.</p>
          <DocumentoOrdem ficha={ficha} aoCarregar={() => setQrCarregado(true)} aoFalhar={() => { setQrCarregado(false); setErro('Não foi possível exibir o QR Code. Tente novamente.'); }} />
        </>}
      </div>
    </dialog>
    {pronta && ficha && createPortal(<div className="ficha-ordem-impressao" aria-hidden="true"><DocumentoOrdem ficha={ficha} /></div>, document.body)}
  </>;
}
