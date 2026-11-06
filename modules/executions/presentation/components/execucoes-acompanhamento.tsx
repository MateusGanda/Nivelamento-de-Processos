'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, LoaderCircle, Pause, RefreshCw, Timer } from 'lucide-react';
import type { ExecucaoAcompanhada } from '../../domain/execucao';
import {
  agoraDoServidor, atencoesDaExecucao, consultarExecucoesAbertas, ErroApiAcompanhamento, filtrarExecucoes, formatarHoraCompleta, formatarHorario,
  inicioDaExecucao, INTERVALO_ATUALIZACAO_MS, pausaAtual, setoresDasExecucoes, temposAteAgora,
  type Atencao, type FiltroSituacao, type RespostaAcompanhamento,
} from '../acompanhamento';
import { formatarDuracao } from '../tempo-decorrido';

const botaoSecundario = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';
const SITUACOES: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' }, { valor: 'EM_EXECUCAO', rotulo: 'Em execução' }, { valor: 'PAUSADA', rotulo: 'Pausadas' },
  { valor: 'ATENCAO', rotulo: 'Com atenção' },
];

function textoAtencao(atencao: Atencao, referencia: string): string {
  return atencao.tipo === 'ACIMA_DO_PREVISTO'
    ? `Acima do previsto (${formatarDuracao(atencao.previstoSegundos)})`
    : `Iniciada em outro dia (${formatarHorario(atencao.inicio, referencia)})`;
}

function Situacao({ execucao, referencia, atencoes }: { execucao: ExecucaoAcompanhada; referencia: string; atencoes: Atencao[] }) {
  const pausa = pausaAtual(execucao);
  return (
    <div className="space-y-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${pausa ? 'bg-[#ffcf99]/15 text-[#ffcf99]' : 'bg-[#7bcba5]/15 text-[#a6dfbf]'}`}>
        {pausa ? <Pause aria-hidden="true" size={14} strokeWidth={2} /> : <Timer aria-hidden="true" size={14} strokeWidth={2} />}
        {pausa ? 'Pausada' : 'Em execução'}
      </span>
      {pausa && <p className="text-xs leading-5 text-muted">{pausa.motivo ?? 'Motivo não informado'} · desde {formatarHorario(pausa.desde, referencia)}</p>}
      {atencoes.length > 0 && (
        <ul aria-label="Atenção" className="space-y-1">
          {atencoes.map((atencao) => (
            <li key={atencao.tipo} className="flex items-start gap-1.5 text-xs font-medium leading-5 text-[#ffcf99]">
              <AlertTriangle aria-hidden="true" size={14} strokeWidth={2} className="mt-0.5 shrink-0" />{textoAtencao(atencao, referencia)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExecucoesAcompanhamento() {
  const router = useRouter();
  const [dados, setDados] = useState<RespostaAcompanhamento | null>(null);
  const [recebidoEm, setRecebidoEm] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [setor, setSetor] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas');
  const [agora, setAgora] = useState(() => Date.now());
  const pedido = useRef<AbortController | null>(null);

  // Cada consulta cancela a anterior; uma resposta antiga nunca substitui uma mais nova.
  const atualizar = useCallback(async () => {
    pedido.current?.abort();
    const controller = new AbortController();
    pedido.current = controller;
    setCarregando(true);
    try {
      const resposta = await consultarExecucoesAbertas(controller.signal);
      if (controller.signal.aborted) return;
      setDados(resposta);
      setRecebidoEm(Date.now());
      setErro('');
    } catch (falha) {
      if (controller.signal.aborted) return;
      if (falha instanceof ErroApiAcompanhamento && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
        return;
      }
      setErro(falha instanceof ErroApiAcompanhamento ? falha.message : 'Não foi possível carregar as execuções. Verifique a conexão e tente novamente.');
    } finally {
      if (!controller.signal.aborted) setCarregando(false);
    }
  }, [router]);

  // Atualiza ao abrir, a cada 30 s com a aba visível e ao voltar para a aba.
  useEffect(() => {
    const primeira = setTimeout(() => void atualizar(), 0);
    const id = setInterval(() => { if (!document.hidden) void atualizar(); }, INTERVALO_ATUALIZACAO_MS);
    const aoVoltar = () => { if (!document.hidden) void atualizar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearTimeout(primeira); clearInterval(id); document.removeEventListener('visibilitychange', aoVoltar); pedido.current?.abort(); };
  }, [atualizar]);

  // Relógio da tela para os tempos andarem entre uma consulta e outra.
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const execucoes = useMemo(() => dados?.execucoes ?? [], [dados]);
  const setores = useMemo(() => setoresDasExecucoes(execucoes), [execucoes]);
  const setorValido = setor !== null && setores.includes(setor) ? setor : null;
  const agoraServidor = dados ? agoraDoServidor(dados.meta.consultadoEm, recebidoEm, agora) : 0;
  const visiveis = useMemo(() => filtrarExecucoes(execucoes, { setor: setorValido, situacao }, agoraServidor), [execucoes, setorValido, situacao, agoraServidor]);
  const contagem = {
    todas: execucoes.length, EM_EXECUCAO: execucoes.filter((e) => e.status === 'EM_EXECUCAO').length,
    PAUSADA: execucoes.filter((e) => e.status === 'PAUSADA').length, ATENCAO: execucoes.filter((e) => atencoesDaExecucao(e, agoraServidor).length > 0).length,
  };
  const referencia = dados?.meta.consultadoEm ?? '';

  return (
    <section aria-labelledby="acompanhamento-titulo" className="mt-7 min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 id="acompanhamento-titulo" className="text-lg font-semibold">Execuções em andamento</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted">Execuções em execução ou pausadas agora, da mais antiga para a mais recente. O tempo é da execução e não mede o desempenho de uma pessoa.</p>
          <p className="mt-1 text-sm leading-6 text-muted">Pedem atenção as execuções com tempo produtivo acima do previsto para a ordem (tempo padrão × quantidade) e as iniciadas em outro dia.</p>
          <p aria-live="polite" className="mt-1 text-xs text-muted">
            {dados ? `Atualizado às ${formatarHoraCompleta(dados.meta.consultadoEm)} · atualiza sozinho a cada ${INTERVALO_ATUALIZACAO_MS / 1000} s` : carregando ? 'Carregando…' : ''}
          </p>
        </div>
        <button type="button" onClick={() => void atualizar()} disabled={carregando} className={botaoSecundario}>
          {carregando ? <LoaderCircle aria-hidden="true" size={16} strokeWidth={2} className="motion-safe:animate-spin" /> : <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />}
          Atualizar
        </button>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/30 bg-[#f49a8a]/10 p-3 text-sm leading-6 text-[#ffb4a5]">
            <AlertCircle aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
            {dados ? `Não foi possível atualizar. Mostrando os dados de ${formatarHoraCompleta(dados.meta.consultadoEm)}.` : erro}
          </p>
        )}

        {dados && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div role="group" aria-label="Situação" className="flex flex-wrap gap-2">
              {SITUACOES.map((opcao) => (
                <button key={opcao.valor} type="button" aria-pressed={situacao === opcao.valor} onClick={() => setSituacao(opcao.valor)}
                  className={`min-h-11 cursor-pointer rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${situacao === opcao.valor ? 'border-accent bg-accent/10 text-foreground' : 'border-[#3b454e] text-muted hover:border-accent'}`}>
                  {opcao.rotulo} ({contagem[opcao.valor]})
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="acompanhamento-setor" className="block text-sm text-muted">Setor</label>
              <select id="acompanhamento-setor" value={setorValido ?? ''} onChange={(evento) => setSetor(evento.target.value || null)}
                className="mt-1 h-11 w-full rounded-lg border border-[#3b454e] bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:w-56">
                <option value="">Todos os setores</option>
                {setores.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </div>
          </div>
        )}

        {!dados && carregando && <p role="status" className="flex items-center gap-3 py-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />Carregando as execuções…</p>}
        {!dados && !carregando && erro && <button type="button" onClick={() => void atualizar()} className={botaoSecundario}><RefreshCw aria-hidden="true" size={16} strokeWidth={2} />Tentar novamente</button>}
        {dados && execucoes.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhuma execução em andamento.</p>}
        {dados && execucoes.length > 0 && visiveis.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhuma execução com esses filtros.</p>}

        {visiveis.length > 0 && (
          <>
            <div className="hidden lg:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Execuções em andamento</caption>
                <thead className="border-b border-white/10 text-muted"><tr>
                  {['Situação', 'Operador', 'Ordem', 'Etapa', 'Posto', 'Início'].map((titulo) => <th key={titulo} scope="col" className="px-3 py-2.5 font-medium">{titulo}</th>)}
                  {['Produtivo', 'Em pausa'].map((titulo) => <th key={titulo} scope="col" className="px-3 py-2.5 text-right font-medium">{titulo}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {visiveis.map((execucao) => {
                    const tempos = temposAteAgora(execucao, agoraServidor);
                    const inicio = inicioDaExecucao(execucao);
                    const atencoes = atencoesDaExecucao(execucao, agoraServidor);
                    return (
                      <tr key={execucao.id} className={`align-top ${atencoes.length > 0 ? 'bg-[#ffcf99]/[0.04] shadow-[inset_3px_0_0_#ffcf99]' : ''}`}>
                        <td className="px-3 py-3"><Situacao execucao={execucao} referencia={referencia} atencoes={atencoes} /></td>
                        <td className="px-3 py-3"><p className="font-medium">{execucao.operador.nome}</p><p className="text-xs text-muted">{execucao.operador.matricula}</p></td>
                        <td className="px-3 py-3"><p className="font-medium">{execucao.ordem.numero}</p><p className="text-xs text-muted">{execucao.produto.codigo} – {execucao.produto.nome} · {execucao.ordem.quantidade.toLocaleString('pt-BR')} {execucao.ordem.unidade}</p></td>
                        <td className="px-3 py-3">{execucao.etapa.ordem}. {execucao.etapa.operacao}</td>
                        <td className="px-3 py-3"><p className="font-medium">{execucao.posto.codigo}</p><p className="text-xs text-muted">{execucao.setor}</p></td>
                        <td className="px-3 py-3 tabular-nums">{inicio ? formatarHorario(inicio, referencia) : '—'}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{formatarDuracao(tempos.produtivoSegundos)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{formatarDuracao(tempos.pausaSegundos)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 lg:hidden" aria-label="Execuções em andamento">
              {visiveis.map((execucao) => {
                const tempos = temposAteAgora(execucao, agoraServidor);
                const inicio = inicioDaExecucao(execucao);
                const atencoes = atencoesDaExecucao(execucao, agoraServidor);
                return (
                  <li key={execucao.id} className={`min-w-0 space-y-3 rounded-lg border bg-background/40 p-4 ${atencoes.length > 0 ? 'border-[#ffcf99]/50' : 'border-[#2b353e]'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0"><p className="font-semibold [overflow-wrap:anywhere]">{execucao.operador.nome}</p><p className="text-xs text-muted">{execucao.operador.matricula}</p></div>
                      <Situacao execucao={execucao} referencia={referencia} atencoes={atencoes} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0"><dt className="text-xs text-muted">Ordem</dt><dd className="[overflow-wrap:anywhere]">{execucao.ordem.numero} · {execucao.produto.codigo}</dd></div>
                      <div className="min-w-0"><dt className="text-xs text-muted">Etapa</dt><dd className="[overflow-wrap:anywhere]">{execucao.etapa.ordem}. {execucao.etapa.operacao}</dd></div>
                      <div className="min-w-0"><dt className="text-xs text-muted">Posto</dt><dd className="[overflow-wrap:anywhere]">{execucao.posto.codigo} · {execucao.setor}</dd></div>
                      <div className="min-w-0"><dt className="text-xs text-muted">Início</dt><dd className="tabular-nums">{inicio ? formatarHorario(inicio, referencia) : '—'}</dd></div>
                      <div><dt className="text-xs text-muted">Produtivo</dt><dd className="font-mono tabular-nums">{formatarDuracao(tempos.produtivoSegundos)}</dd></div>
                      <div><dt className="text-xs text-muted">Em pausa</dt><dd className="font-mono tabular-nums">{formatarDuracao(tempos.pausaSegundos)}</dd></div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
