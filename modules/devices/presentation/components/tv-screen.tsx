'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Pause, Timer, WifiOff } from 'lucide-react';
import { BrandGunp } from '../../../access/presentation/components/brand-gunp';
import type { ExecucaoNoPainel, PainelTv, PostoNoPainel } from '../../application/painel-tv';
import { agoraDoServidor, atencoesDaExecucao, pausaAtual, temposAteAgora } from '../../../executions/presentation/acompanhamento';
import { formatarDuracao as formatarCronometro } from '../../../executions/presentation/tempo-decorrido';
import { formatarDuracao } from '../../../indicators/presentation/formatacao';
import { buscarPainelTv, ErroApiDispositivos } from '../api-client';
import { paginarPostos, RECARREGAR_A_CADA_MS, resumoDosPostos, TEMPO_POR_PAGINA_MS } from '../painel-tv-tela';

// Tela de gestão à vista para TV no chão de fábrica: lida de longe, sem mouse nem teclado.
// Letras proporcionais à largura da tela (vw), atualização sozinha, tela sempre acesa e sem nomes de pessoas.

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const HORA_COMPLETA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const DATA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' });

const CORES = {
  EM_EXECUCAO: { faixa: 'bg-[#2f9e6e]', texto: 'text-[#a6dfbf]', rotulo: 'Em execução' },
  PAUSADA: { faixa: 'bg-[#d79a3e]', texto: 'text-[#ffcf99]', rotulo: 'Pausado' },
  LIVRE: { faixa: 'bg-[#3b454e]', texto: 'text-muted', rotulo: 'Livre' },
} as const;

function principalDoPosto(posto: PostoNoPainel): ExecucaoNoPainel | null {
  return posto.execucoes.find((e) => e.status === 'EM_EXECUCAO') ?? posto.execucoes[0] ?? null;
}

function QuadroPosto({ posto, agoraServidor }: { posto: PostoNoPainel; agoraServidor: number }) {
  const execucao = principalDoPosto(posto);
  const atencoes = execucao ? atencoesDaExecucao(execucao, agoraServidor) : [];
  const pausa = execucao ? pausaAtual(execucao) : null;
  const tempos = execucao ? temposAteAgora(execucao, agoraServidor) : null;
  const cor = CORES[posto.situacao];
  return (
    <article className={`flex min-h-0 flex-col overflow-hidden rounded-[0.8vw] border-[0.25vw] bg-[#192128] ${atencoes.length ? 'border-[#ff8d40]' : 'border-[#2b353e]'}`}>
      <div className={`flex shrink-0 items-center justify-between gap-[0.6vw] px-[1vw] py-[0.45vw] ${cor.faixa}`}>
        <span className="truncate text-[1.8vw] leading-tight font-bold text-[#0f1418]">{posto.codigo}</span>
        <span className="flex shrink-0 items-center gap-[0.4vw] text-[1.1vw] font-semibold text-[#0f1418]">
          {posto.situacao === 'PAUSADA' ? <Pause aria-hidden="true" className="size-[1.3vw]" /> : posto.situacao === 'EM_EXECUCAO' ? <Timer aria-hidden="true" className="size-[1.3vw]" /> : null}
          {cor.rotulo}
        </span>
      </div>
      {/* Linhas sem encolher: o que não couber é cortado no fim do cartão, sem sobrepor o texto. */}
      <div className="flex min-h-0 flex-1 flex-col gap-[0.3vw] overflow-hidden px-[1vw] py-[0.6vw] *:shrink-0">
        {execucao ? (
          <>
            <p className="truncate text-[1.4vw] leading-snug font-semibold">{execucao.ordem.numero} · {execucao.produto.codigo}</p>
            <p className="truncate text-[1.1vw] leading-snug">
              <span className="text-muted">{posto.nome} · </span>{execucao.etapa.ordem}. {execucao.etapa.operacao}
              {posto.execucoes.length > 1 && <span className="text-muted"> · +{posto.execucoes.length - 1} {posto.execucoes.length === 2 ? 'execução' : 'execuções'}</span>}
            </p>
            {pausa ? (
              <p className={`truncate text-[1.2vw] leading-snug font-semibold ${cor.texto}`}>{pausa.motivo ?? 'Pausa'} · há {formatarCronometro((agoraServidor - Date.parse(pausa.desde)) / 1000)}</p>
            ) : (
              <p className={`font-mono text-[2.2vw] leading-none font-bold tabular-nums ${cor.texto}`}>{formatarCronometro(tempos?.produtivoSegundos ?? 0)}</p>
            )}
            {atencoes.length > 0 && (
              <p className="flex items-center gap-[0.4vw] text-[1vw] leading-snug font-semibold text-[#ffb36b]">
                <AlertTriangle aria-hidden="true" className="size-[1.1vw] shrink-0" />
                <span className="truncate">{atencoes.map((a) => (a.tipo === 'ACIMA_DO_PREVISTO' ? 'Acima do previsto' : 'Iniciada em outro dia')).join(' · ')}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="truncate text-[1.1vw] leading-snug text-muted">{posto.nome}</p>
            <p className="mt-auto text-[1.3vw] text-muted">Sem execução no momento</p>
          </>
        )}
      </div>
    </article>
  );
}

export function TvScreen() {
  const router = useRouter();
  const [dados, setDados] = useState<PainelTv | null>(null);
  const [recebidoEm, setRecebidoEm] = useState(0);
  const [semConexaoDesde, setSemConexaoDesde] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [pagina, setPagina] = useState(0);
  const pedido = useRef<AbortController | null>(null);

  const atualizar = useCallback(async () => {
    pedido.current?.abort();
    const controller = new AbortController();
    pedido.current = controller;
    try {
      const resposta = await buscarPainelTv(controller.signal);
      if (controller.signal.aborted) return;
      setDados(resposta);
      setRecebidoEm(Date.now());
      setSemConexaoDesde(null);
    } catch (falha) {
      if (controller.signal.aborted) return;
      // TV desativada ou código trocado: volta para a tela do código.
      if (falha instanceof ErroApiDispositivos && falha.status === 401) { router.refresh(); return; }
      setSemConexaoDesde((desde) => desde ?? Date.now());
    }
  }, [router]);

  const intervaloMs = (dados?.meta.intervaloSegundos ?? 15) * 1000;
  useEffect(() => {
    const primeira = setTimeout(() => void atualizar(), 0);
    const id = setInterval(() => void atualizar(), intervaloMs);
    return () => { clearTimeout(primeira); clearInterval(id); pedido.current?.abort(); };
  }, [atualizar, intervaloMs]);

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const paginas = setInterval(() => setPagina((p) => p + 1), TEMPO_POR_PAGINA_MS);
    const recarga = setTimeout(() => window.location.reload(), RECARREGAR_A_CADA_MS);
    return () => { clearInterval(relogio); clearInterval(paginas); clearTimeout(recarga); };
  }, []);

  // Mantém a tela acesa; o navegador solta o bloqueio quando a aba fica oculta, então pede de novo ao voltar.
  useEffect(() => {
    let sentinela: WakeLockSentinel | null = null;
    const pedir = async () => { try { sentinela = await navigator.wakeLock?.request('screen') ?? null; } catch { /* sem suporte: segue sem bloqueio */ } };
    void pedir();
    const aoVoltar = () => { if (document.visibilityState === 'visible') void pedir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { document.removeEventListener('visibilitychange', aoVoltar); void sentinela?.release().catch(() => {}); };
  }, []);

  const agoraServidor = dados ? agoraDoServidor(dados.meta.consultadoEm, recebidoEm, agora) : agora;
  const paginaAtual = useMemo(() => paginarPostos(dados?.postos ?? [], pagina), [dados, pagina]);
  const resumo = useMemo(() => resumoDosPostos(dados?.postos ?? []), [dados]);
  const maiorCarga = Math.max(1, ...(dados?.cargaPorPosto ?? []).map((c) => c.segundos));

  return (
    <main className="flex h-dvh w-full cursor-none flex-col overflow-hidden bg-[#0f1418] text-foreground select-none">
      <header className="flex shrink-0 items-center justify-between gap-[2vw] border-b border-white/10 px-[2vw] py-[1vw]">
        <div className="flex min-w-0 items-center gap-[1.5vw]">
          {/* A escala não ocupa espaço no layout: a margem fixa compensa o aumento da marca. */}
          <div className="mr-14 shrink-0 origin-left scale-[1.4]"><BrandGunp variante="painel" /></div>
          <div className="min-w-0">
            <p className="truncate text-[1.8vw] font-semibold leading-tight">Gestão à vista{dados?.dispositivo.setor ? ` · ${dados.dispositivo.setor}` : ''}</p>
            <p className="truncate text-[1.1vw] text-muted">{dados ? `${dados.dispositivo.nome}${dados.dispositivo.local ? ` · ${dados.dispositivo.local}` : ''}` : 'Carregando…'}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[2vw]">
          {dados && (
            <div className="flex gap-[1.2vw] text-[1.25vw] font-semibold">
              <span className="text-[#a6dfbf]">{resumo.emExecucao} em execução</span>
              <span className="text-[#ffcf99]">{resumo.pausados} {resumo.pausados === 1 ? 'pausado' : 'pausados'}</span>
              <span className="text-muted">{resumo.livres} {resumo.livres === 1 ? 'livre' : 'livres'}</span>
            </div>
          )}
          <div className="text-right">
            <p className="font-mono text-[3vw] font-bold leading-none tabular-nums">{HORA.format(agora)}</p>
            <p className="text-[1vw] text-muted first-letter:uppercase">{DATA.format(agora)}</p>
          </div>
        </div>
      </header>

      {semConexaoDesde !== null && (
        <p role="status" className="flex shrink-0 items-center gap-[0.8vw] bg-[#5c2a22] px-[2vw] py-[0.5vw] text-[1.2vw] font-semibold text-[#ffd2c8]">
          <WifiOff aria-hidden="true" className="size-[1.4vw]" />Sem conexão desde {HORA.format(semConexaoDesde)}. Mostrando os últimos dados recebidos.
        </p>
      )}

      {!dados ? (
        <p className="m-auto text-[2vw] text-muted">{semConexaoDesde ? 'Sem conexão com o sistema. Tentando de novo…' : 'Carregando o painel…'}</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[2.1fr_1fr] gap-[1.5vw] p-[1.5vw]">
          <section aria-label="Postos de trabalho" className="flex min-h-0 flex-col gap-[0.8vw]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[1.6vw] font-semibold">Postos agora</h2>
              {paginaAtual.total > 1 && <p className="text-[1.1vw] text-muted">Página {paginaAtual.atual + 1} de {paginaAtual.total}</p>}
            </div>
            {dados.postos.length === 0 ? (
              <p className="m-auto text-[1.6vw] text-muted">Nenhum posto ativo neste setor.</p>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-[1vw]">
                {paginaAtual.itens.map((posto) => <QuadroPosto key={posto.codigo} posto={posto} agoraServidor={agoraServidor} />)}
              </div>
            )}
          </section>

          <div className="flex min-h-0 flex-col gap-[1.5vw]">
            <section aria-label="Produção de hoje" className="rounded-[0.8vw] border border-[#2b353e] bg-[#192128] p-[1.2vw]">
              <h2 className="text-[1.6vw] font-semibold">Produção de hoje</h2>
              <p className="mt-[0.3vw] text-[1vw] text-muted">Peças boas na última etapa · {dados.producaoHoje.baixas} {dados.producaoHoje.baixas === 1 ? 'baixa' : 'baixas'} no dia</p>
              {dados.producaoHoje.pecasBoas.length === 0 ? (
                <p className="mt-[0.8vw] text-[1.6vw] font-semibold text-muted">Nenhuma peça concluída ainda</p>
              ) : (
                <ul className="mt-[0.6vw] space-y-[0.4vw]">
                  {dados.producaoHoje.pecasBoas.slice(0, 4).map((p) => (
                    <li key={`${p.produtoCodigo}-${p.unidade}`} className="flex items-baseline justify-between gap-[1vw]">
                      <span className="truncate text-[1.4vw]">{p.produtoCodigo}</span>
                      <span className="font-mono text-[2.4vw] font-bold tabular-nums text-[#a6dfbf]">{p.quantidadeBoa.toLocaleString('pt-BR')} <span className="text-[1.2vw] font-semibold">{p.unidade}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Carga pendente por posto" className="flex min-h-0 flex-1 flex-col rounded-[0.8vw] border border-[#2b353e] bg-[#192128] p-[1.2vw]">
              <h2 className="text-[1.6vw] font-semibold">Carga pendente</h2>
              <p className="mt-[0.3vw] text-[1vw] text-muted">Trabalho ainda sem baixa, por posto (estimativa)</p>
              {dados.cargaPorPosto.length === 0 ? (
                <p className="mt-[0.8vw] text-[1.4vw] text-muted">Sem carga pendente</p>
              ) : (
                <ul className="mt-[0.8vw] min-h-0 space-y-[0.7vw] overflow-hidden">
                  {dados.cargaPorPosto.slice(0, 6).map((c) => (
                    <li key={c.codigo}>
                      <div className="flex items-baseline justify-between gap-[1vw] text-[1.2vw]">
                        <span className="truncate font-semibold">{c.codigo}</span>
                        <span className="shrink-0 tabular-nums">{formatarDuracao(c.segundos)}</span>
                      </div>
                      <div className="mt-[0.3vw] h-[0.8vw] rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${Math.max(2, (c.segundos / maiorCarga) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      <footer className="flex shrink-0 items-center justify-between gap-[2vw] border-t border-white/10 px-[2vw] py-[0.6vw] text-[0.95vw] text-muted">
        <span>O tempo é da execução e não mede o desempenho de uma pessoa.</span>
        <span>{dados ? `Atualizado às ${HORA_COMPLETA.format(Date.parse(dados.meta.consultadoEm))} · atualiza a cada ${dados.meta.intervaloSegundos} s` : ''}</span>
      </footer>
    </main>
  );
}
