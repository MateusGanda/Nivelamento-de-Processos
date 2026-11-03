'use client';

import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw, ScanLine, Search } from 'lucide-react';
import type { Destino } from '../../domain/execucao';
import { idDaOrdemNoQr } from '../../../production-orders/domain/identificacao-ordem';
import { ErroApiIlha, listarOrdensDisponiveis } from '../api-client';
import { motivoIndisponibilidadeEtapa } from '../disponibilidade-etapa';
import { consultarOrdemPorQr, ErroLeituraOrdem } from '../ordem-por-qr';
import { criarControleRequisicoesIlha } from '../requisicoes-ilha';
import { destinoSelecionado, filtrarOrdensManuais, reduzirSelecaoDestino, selecaoDestinoInicial, type EntradaDestino } from '../selecao-destino';

const cartao = 'w-full cursor-pointer rounded-lg border px-4 py-3 text-left text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';
const selecionado = (ativo: boolean) => ativo ? 'border-accent bg-accent/10' : 'border-[#3b454e] hover:border-accent';
const secundario = 'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-5 text-base font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

// QR ou pesquisa manual → ordem → etapa → posto. Ler nunca confirma produção.
export function IlhaDestino({ rotuloConfirmar, ocupado, aoConfirmar, aoCancelar, aoFalhar, etapaAtual }: {
  rotuloConfirmar: string;
  ocupado: boolean;
  aoConfirmar: (destino: Destino) => void;
  aoCancelar: () => void;
  aoFalhar: (falha: unknown) => void;
  etapaAtual?: Pick<Destino, 'ordemId' | 'etapaId'>;
}) {
  const [estado, dispatch] = useReducer(reduzirSelecaoDestino, selecaoDestinoInicial);
  const [controle] = useState(criarControleRequisicoesIlha);
  const [codigo, setCodigo] = useState('');
  const [busca, setBusca] = useState('');
  const [focoLeitura, setFocoLeitura] = useState(false);
  const leituraRef = useRef<HTMLInputElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const etapasRef = useRef<HTMLLegendElement>(null);
  const [ultimaLeitura, setUltimaLeitura] = useState('');
  const { entrada, ordens, carregando, erro, ordemId, etapaId, postoId } = estado;

  useEffect(() => () => controle.invalidar(), [controle]);

  useEffect(() => {
    if (ocupado || carregando) return;
    if (ordemId) etapasRef.current?.focus();
    else if (entrada === 'qr') leituraRef.current?.focus();
    else buscaRef.current?.focus();
  }, [entrada, ordemId, carregando, ocupado]);

  async function consultar(tipo: EntradaDestino, leitura = '') {
    if (ocupado || controle.emAndamento() || (tipo === 'qr' && !leitura.trim())) return;
    if (tipo === 'qr') { setUltimaLeitura(leitura); setCodigo(''); }
    await controle.executar(async (signal) => tipo === 'qr'
      ? consultarOrdemPorQr(leitura, signal)
      : { ordens: await listarOrdensDisponiveis(signal), ordemId: undefined }, {
      iniciar: () => dispatch({ tipo: 'iniciarConsulta' }),
      concluir: (resultado) => dispatch({ tipo: 'receberOrdens', ...resultado }),
      falhar: (falha) => {
        dispatch({ tipo: 'falharConsulta', mensagem: falha instanceof ErroApiIlha || falha instanceof ErroLeituraOrdem ? falha.message : 'Não foi possível consultar as ordens. Verifique a conexão e tente novamente.' });
        if (falha instanceof ErroApiIlha && (falha.status === 401 || falha.status === 503)) aoFalhar(falha);
      },
      finalizar: () => dispatch({ tipo: 'finalizarConsulta' }),
    });
  }

  function lerOutraOrdem() {
    if (ocupado || controle.emAndamento()) return;
    setUltimaLeitura(''); setCodigo(''); setBusca('');
    dispatch({ tipo: 'mudarEntrada', entrada: 'qr' });
  }

  function pesquisarManualmente() {
    if (ocupado || controle.emAndamento()) return;
    setUltimaLeitura(''); setCodigo('');
    dispatch({ tipo: 'mudarEntrada', entrada: 'manual' });
    void consultar('manual');
  }

  function identificarQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void consultar('qr', codigo);
  }

  const visiveis = useMemo(() => filtrarOrdensManuais(ordens, busca), [ordens, busca]);
  const ordem = ordens?.find((item) => item.id === ordemId);
  const etapa = ordem?.etapas.find((item) => item.id === etapaId);
  const destino = destinoSelecionado(estado, etapaAtual, ocupado);
  const indisponivel = ocupado || carregando;

  return (
    <div className="space-y-6" aria-busy={indisponivel}>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">1. Ordem de produção</h2>
        {entrada === 'qr' && !ordem && <form onSubmit={identificarQr} className="space-y-3">
          <label htmlFor="ilha-qr-ordem" className="block text-base font-medium">Leia o QR da ordem</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1"><ScanLine aria-hidden="true" size={22} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input id="ilha-qr-ordem" ref={leituraRef} value={codigo} onChange={(event) => setCodigo(event.target.value)} onFocus={() => setFocoLeitura(true)} onBlur={() => setFocoLeitura(false)}
                autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={indisponivel} aria-describedby="ilha-qr-ordem-ajuda"
                className="h-14 w-full min-w-0 rounded-lg border border-[#3b454e] bg-background pr-3 pl-11 font-mono text-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50" />
            </div>
            <button type="submit" disabled={indisponivel || !codigo.trim()} className={secundario}>Identificar ordem</button>
          </div>
          <p id="ilha-qr-ordem-ajuda" role="status" className="text-sm leading-6 text-muted">{indisponivel ? 'Aguarde a consulta antes de ler outra ficha.' : focoLeitura ? 'Pronto para ler o QR da ordem. A leitura apenas seleciona a ordem.' : 'Selecione o campo acima para ler a ficha da ordem.'}</p>
        </form>}

        {carregando && <p role="status" className="flex items-center gap-3 py-4 text-base text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Consultando ordens…</p>}
        {erro && <div className="space-y-3"><p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/30 bg-[#f49a8a]/10 p-4 text-base leading-7 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={22} strokeWidth={2} className="mt-1 shrink-0" />{erro}</p>
          {entrada === 'qr' && ultimaLeitura && <button type="button" disabled={indisponivel} onClick={() => void consultar('qr', ultimaLeitura)} className={secundario}><RefreshCw aria-hidden="true" size={20} />Tentar novamente</button>}
        </div>}

        {entrada === 'manual' && !carregando && !erro && <>
          <div className="relative"><Search aria-hidden="true" size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <label htmlFor="ilha-busca-ordem" className="sr-only">Buscar ordem por número ou produto</label>
            <input id="ilha-busca-ordem" ref={buscaRef} type="search" value={busca} onChange={(event) => setBusca(event.target.value)} disabled={ocupado}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (idDaOrdemNoQr(busca) && !ocupado && !controle.emAndamento()) { dispatch({ tipo: 'mudarEntrada', entrada: 'qr' }); void consultar('qr', busca); } } }}
              placeholder="Número da ordem ou produto" className="h-12 w-full rounded-lg border border-[#3b454e] bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50" />
          </div>
          {visiveis.length === 0 && <p role="status" className="text-base text-muted">{ordens?.length === 0 ? 'Nenhuma ordem com etapa em aberto.' : 'Nenhuma ordem encontrada.'}</p>}
          <div className="grid gap-2 sm:grid-cols-2">{visiveis.map((item) => <button key={item.id} type="button" disabled={ocupado} aria-pressed={item.id === ordemId}
            onClick={() => { if (!ocupado && !controle.emAndamento()) dispatch({ tipo: 'selecionarOrdem', id: item.id }); }} className={`${cartao} ${selecionado(item.id === ordemId)}`}>
            <span className="block font-semibold">{item.numero}</span><span className="block text-sm text-[#c1c8cf]">{item.produto.codigo} – {item.produto.nome} · {item.quantidade.toLocaleString('pt-BR')} {item.unidade}</span>
          </button>)}</div>
        </>}

        {ordem && <div className="space-y-1 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <p className="font-semibold">{ordem.numero}</p><p className="text-base text-[#c1c8cf]">{ordem.produto.codigo} – {ordem.produto.nome}</p>
          <p className="text-sm text-muted">{ordem.quantidade.toLocaleString('pt-BR')} {ordem.unidade} · Plano {ordem.plano}</p>
        </div>}

        <div className="flex flex-col gap-3 sm:flex-row">
          {(entrada === 'manual' || ordem) && <button type="button" disabled={indisponivel} onClick={lerOutraOrdem} className={secundario}><ScanLine aria-hidden="true" size={20} />Ler outra ordem</button>}
          {entrada === 'qr' && <button type="button" disabled={indisponivel} onClick={pesquisarManualmente} className={secundario}><Search aria-hidden="true" size={20} />Pesquisar ordem manualmente</button>}
        </div>
      </div>

      {ordem && <fieldset className="space-y-3" disabled={indisponivel}>
        <legend ref={etapasRef} tabIndex={-1} className="mb-2 rounded text-lg font-semibold outline-none focus-visible:outline-2 focus-visible:outline-accent">2. Etapa</legend>
        <div className="grid gap-2 sm:grid-cols-2">{ordem.etapas.map((item) => {
          const motivo = motivoIndisponibilidadeEtapa(ordem.id, item, etapaAtual);
          return <button key={item.id} type="button" aria-pressed={item.id === etapaId} disabled={motivo !== null || indisponivel}
            onClick={() => { if (!ocupado && !controle.emAndamento()) dispatch({ tipo: 'selecionarEtapa', id: item.id, atual: etapaAtual }); }} className={`${cartao} ${selecionado(item.id === etapaId)}`}>
            <span className="block font-semibold">{item.ordem}. {item.operacao}</span><span className="block text-sm text-[#c1c8cf]">{motivo ?? `${item.postos.length} ${item.postos.length === 1 ? 'posto' : 'postos'}`}</span>
          </button>;
        })}</div>
      </fieldset>}

      {etapa && <fieldset className="space-y-3" disabled={indisponivel}>
        <legend className="mb-2 text-lg font-semibold">3. Posto</legend>
        <div className="grid gap-2 sm:grid-cols-3">{etapa.postos.map((posto) => <button key={posto.id} type="button" disabled={indisponivel} aria-pressed={posto.id === postoId}
          onClick={() => { if (!ocupado && !controle.emAndamento()) dispatch({ tipo: 'selecionarPosto', id: posto.id }); }} className={`${cartao} ${selecionado(posto.id === postoId)}`}>
          <span className="block font-semibold">{posto.codigo}</span><span className="block text-sm text-[#c1c8cf]">{posto.nome}</span>
        </button>)}</div>
      </fieldset>}

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => { if (!ocupado) { controle.invalidar(); aoCancelar(); } }} disabled={ocupado} className={secundario}>Cancelar</button>
        {entrada === 'manual' && <button type="button" onClick={() => void consultar('manual')} disabled={indisponivel} className={secundario}><RefreshCw aria-hidden="true" size={20} />{erro ? 'Tentar novamente' : 'Atualizar ordens'}</button>}
        <button type="button" disabled={!destino || indisponivel} onClick={() => { if (destino && !ocupado && !controle.emAndamento()) aoConfirmar(destino); }}
          className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-5 text-base font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
          {ocupado ? <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" /> : <CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} />}{rotuloConfirmar}
        </button>
      </div>
    </div>
  );
}
