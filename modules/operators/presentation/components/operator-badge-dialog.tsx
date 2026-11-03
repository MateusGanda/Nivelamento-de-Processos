'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertCircle, Cog, Download, LoaderCircle, Printer, RefreshCw, X } from 'lucide-react';
import { ErroApiOperadores } from '../api-client';
import { ErroCrachaOperador, prepararCrachaOperador, type CrachaOperador } from '../cracha-operador';

function CartaoOperador({ cracha, cartaoRef, aoCarregar, aoFalhar }: {
  cracha: CrachaOperador;
  cartaoRef?: RefObject<HTMLElement | null>;
  aoCarregar?: () => void;
  aoFalhar?: () => void;
}) {
  const { operador } = cracha;
  return (
    <article ref={cartaoRef} className="cracha-operador-cartao" aria-label={'Crachá de ' + operador.nome}>
      <div className="cracha-operador-conteudo">
        <header className="cracha-operador-marca"><Cog aria-hidden="true" strokeWidth={2} /><strong>GUNP</strong><span>Identificação do operador</span></header>
        <div className="cracha-operador-dados">
          <p className="cracha-operador-nome" data-texto-cracha>{operador.nome}</p>
          <div><span className="cracha-operador-rotulo">Matrícula</span><p className="cracha-operador-matricula" data-texto-cracha>{operador.matricula}</p></div>
          <div><span className="cracha-operador-rotulo">Setor principal</span><p className="cracha-operador-setor" data-texto-cracha>{operador.setorPrincipal ? `${operador.setorPrincipal.codigo} — ${operador.setorPrincipal.nome}` : 'Sem setor definido'}</p></div>
        </div>
        {/* Imagem local embutida: o mesmo PNG é usado na prévia, no download e no papel. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cracha-operador-qr" src={cracha.qrPng} width={1024} height={1024} alt={'QR Code da matrícula ' + operador.matricula} onLoad={aoCarregar} onError={aoFalhar} />
      </div>
    </article>
  );
}

export function OperatorBadgeDialog({ operadorId, aoFechar }: { operadorId: string; aoFechar: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cartaoRef = useRef<HTMLElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const consultaRef = useRef<AbortController | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [cracha, setCracha] = useState<CrachaOperador | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [qrCarregado, setQrCarregado] = useState(false);
  const [cabeNoCartao, setCabeNoCartao] = useState<boolean | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    fecharRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    consultaRef.current = controller;
    void prepararCrachaOperador(operadorId, controller.signal).then((resultado) => {
      if (!controller.signal.aborted) setCracha(resultado);
    }).catch((falha: unknown) => {
      if (controller.signal.aborted) return;
      if (falha instanceof ErroApiOperadores && (falha.status === 401 || falha.status === 403)) {
        dialogRef.current?.close(); router.replace('/login'); router.refresh();
      } else setErro(falha instanceof ErroApiOperadores || falha instanceof ErroCrachaOperador ? falha.message : 'Não foi possível preparar o crachá. Verifique sua conexão e tente novamente.');
    }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [operadorId, tentativa, router]);

  useEffect(() => {
    const cartao = cartaoRef.current;
    if (!cracha || !qrCarregado || !cartao) return;
    let ativo = true;
    const conferir = () => {
      if (!ativo) return;
      const textos = Array.from(cartao.querySelectorAll<HTMLElement>('[data-texto-cracha]'));
      setCabeNoCartao(textos.every((texto) => texto.scrollHeight <= texto.clientHeight + 1 && texto.scrollWidth <= texto.clientWidth + 1));
    };
    const observador = new ResizeObserver(conferir);
    observador.observe(cartao);
    void document.fonts.ready.then(conferir);
    return () => { ativo = false; observador.disconnect(); };
  }, [cracha, qrCarregado]);

  const podeImprimir = !!cracha && qrCarregado && cabeNoCartao === true;
  useEffect(() => {
    if (!podeImprimir) return;
    document.body.classList.add('imprimindo-cracha-operador');
    return () => document.body.classList.remove('imprimindo-cracha-operador');
  }, [podeImprimir]);

  function fechar() { consultaRef.current?.abort(); dialogRef.current?.close(); }

  function tentarNovamente() {
    consultaRef.current?.abort();
    setCarregando(true); setCracha(null); setErro(''); setQrCarregado(false); setCabeNoCartao(null);
    setTentativa((atual) => atual + 1);
  }

  function baixarQr() {
    if (!cracha || !qrCarregado) return;
    const link = document.createElement('a');
    link.href = cracha.qrPng; link.download = cracha.nomeArquivo;
    document.body.appendChild(link); link.click(); link.remove();
  }

  const secundario = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';
  return <>
    <dialog ref={dialogRef} id="cracha-operador" aria-labelledby="cracha-operador-titulo" aria-describedby="cracha-operador-descricao"
      onCancel={() => consultaRef.current?.abort()}
      onClose={() => { consultaRef.current?.abort(); aoFechar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-[#34404b] bg-[#1b232a] p-0 text-foreground shadow-2xl backdrop:bg-black/65">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <h2 id="cracha-operador-titulo" className="text-xl font-semibold">Crachá do operador</h2>
        <button ref={fecharRef} type="button" onClick={fechar} aria-label="Fechar crachá" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent"><X aria-hidden="true" size={22} /></button>
      </div>
      <div className="space-y-5 p-4 sm:p-6" aria-busy={carregando}>
        <p id="cracha-operador-descricao" className="text-sm leading-6 text-muted">Leia este crachá na identificação da ilha. As ações de execução continuam sendo confirmadas na tela.</p>
        {carregando && <p role="status" className="flex min-h-44 items-center justify-center gap-3 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} className="motion-safe:animate-spin" />Preparando crachá…</p>}
        {erro && <div className="space-y-3"><p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-3 text-sm text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} className="shrink-0" />{erro}</p><button type="button" onClick={tentarNovamente} className={secundario}><RefreshCw aria-hidden="true" size={18} />Tentar novamente</button></div>}
        {cracha && <>
          <CartaoOperador cracha={cracha} cartaoRef={cartaoRef} aoCarregar={() => setQrCarregado(true)} aoFalhar={() => { setQrCarregado(false); setCabeNoCartao(null); setErro('Não foi possível exibir o QR Code. Tente novamente.'); }} />
          {cabeNoCartao === false && <p role="alert" className="text-sm leading-6 text-[#ffb4a5]">Os dados completos não cabem neste tamanho de crachá. A impressão está indisponível para evitar cortes. Você pode baixar o QR em PNG e preparar um cartão maior.</p>}
          <p className="text-xs leading-5 text-muted">Crachá de 86 × 54 mm. Na impressão, use escala de 100% e desative os cabeçalhos e rodapés. O setor é o atual; a matrícula e o QR permanecem iguais após transferências.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={baixarQr} disabled={!qrCarregado} className={secundario}><Download aria-hidden="true" size={18} />Baixar QR em PNG</button>
            <button type="button" onClick={() => { if (podeImprimir) window.print(); }} disabled={!podeImprimir} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"><Printer aria-hidden="true" size={18} />Imprimir crachá</button>
          </div>
        </>}
      </div>
    </dialog>
    {podeImprimir && cracha && createPortal(<div className="cracha-operador-impressao" aria-hidden="true"><CartaoOperador cracha={cracha} /></div>, document.body)}
  </>;
}
