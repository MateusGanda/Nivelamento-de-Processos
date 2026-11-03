'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, LoaderCircle, Lock, LogOut, Pause, Play, RefreshCw, Repeat, ScanLine, Square, Timer } from 'lucide-react';
import { BrandGunp } from '../../../access/presentation/components/brand-gunp';
import type { Destino, ExecucaoAberta, OperadorDaIlha } from '../../domain/execucao';
import {
  bloquearTerminal, darBaixa, ErroApiIlha, identificarOperador, iniciarExecucao, pausarExecucao, retomarExecucao, trocarOperacao,
} from '../api-client';
import { formatarDuracao, lerQuantidade, tempoDecorrido } from '../tempo-decorrido';
import { criarControleRequisicoesIlha } from '../requisicoes-ilha';
import { consultarSituacaoOperador, exigeAtualizacaoSituacao, type IdentificacaoEsperada } from '../recuperacao-ilha';
import { IlhaDestino } from './ilha-destino';
import { IlhaPausa } from './ilha-pausa';

type Modo = null | 'iniciar' | 'trocar' | 'pausar' | 'baixa';
type EstadoBloqueio = null | 'enviando' | 'falhou' | 'concluido';
type RecuperacaoPendente = { operador: IdentificacaoEsperada; detalhe: string; erroConsulta: string };

const botaoGrande = 'flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60';
const botaoSecundario = 'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 text-base font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60';

function Relogio({ execucao }: { execucao: ExecucaoAberta }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const { produtivoSegundos, pausaSegundos } = tempoDecorrido(execucao.eventos, execucao.status, agora);
  return (
    <dl className="grid grid-cols-2 gap-3">
      <div className="min-w-0 rounded-lg bg-white/[0.04] p-4"><dt className="text-sm text-muted">Tempo produtivo</dt><dd className="mt-1 font-mono text-2xl font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-3xl">{formatarDuracao(produtivoSegundos)}</dd></div>
      <div className="min-w-0 rounded-lg bg-white/[0.04] p-4"><dt className="text-sm text-muted">Em pausa</dt><dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#c1c8cf] [overflow-wrap:anywhere] sm:text-3xl">{formatarDuracao(pausaSegundos)}</dd></div>
    </dl>
  );
}

export function IlhaScreen() {
  const router = useRouter();
  const campoRef = useRef<HTMLInputElement>(null);
  const [requisicoes] = useState(criarControleRequisicoesIlha);
  const bloqueioSolicitado = useRef(false);
  const recuperacaoPendente = useRef(false);
  const [recuperacao, setRecuperacao] = useState<RecuperacaoPendente | null>(null);
  const [bloqueio, setBloqueio] = useState<EstadoBloqueio>(null);
  const [matricula, setMatricula] = useState('');
  const [operador, setOperador] = useState<OperadorDaIlha | null>(null);
  const [modo, setModo] = useState<Modo>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [baixa, setBaixa] = useState({ boa: '', retrabalho: '', refugo: '' });
  const podeIdentificar = !ocupado && modo === null && bloqueio === null;

  // Cada formulário cuida de seu campo. A matrícula não recebe o foco da leitura da ordem.
  useEffect(() => {
    if (!podeIdentificar || recuperacao) return;
    const devolverFoco = () => {
      const ativo = document.activeElement;
      if (!ativo || ativo === document.body) campoRef.current?.focus();
    };
    devolverFoco();
    const id = setInterval(devolverFoco, 500);
    return () => clearInterval(id);
  }, [podeIdentificar, recuperacao]);

  // Invalidar pedidos só na desmontagem; mudanças de foco não cancelam uma gravação.
  useEffect(() => () => requisicoes.invalidar(), [requisicoes]);

  const tratarFalha = useCallback((falha: unknown) => {
    if (bloqueioSolicitado.current) return;
    if (falha instanceof ErroApiIlha && (falha.status === 401 || falha.status === 503)) {
      router.refresh();
      return;
    }
    setErro(falha instanceof ErroApiIlha ? falha.message : 'Não foi possível concluir. Verifique a conexão e tente novamente.');
  }, [router]);

  async function executar(acao: (signal: AbortSignal) => Promise<OperadorDaIlha>, sucesso: string, identificando = false) {
    if (bloqueioSolicitado.current || (!identificando && recuperacaoPendente.current)) return;
    await requisicoes.executar(acao, {
      iniciar: () => {
        setOcupado(true);
        setErro('');
        setMensagem('');
        if (identificando) {
          recuperacaoPendente.current = false;
          setRecuperacao(null);
          setMatricula('');
          setOperador(null);
          setModo(null);
          setBaixa({ boa: '', retrabalho: '', refugo: '' });
        }
      },
      concluir: (resultado) => {
        setOperador(resultado);
        setMensagem(sucesso);
        setModo(identificando && !resultado.execucaoAberta ? 'iniciar' : null);
      },
      falhar: (falha) => {
        if (!identificando && operador && exigeAtualizacaoSituacao(falha)) {
          recuperacaoPendente.current = true;
          setRecuperacao({
            operador: { id: operador.id, matricula: operador.matricula },
            detalhe: falha instanceof ErroApiIlha ? falha.message : 'Não foi possível confirmar o resultado da ação.',
            erroConsulta: '',
          });
          setModo(null);
          setBaixa({ boa: '', retrabalho: '', refugo: '' });
          if (falha instanceof ErroApiIlha && (falha.status === 401 || falha.status === 503)) tratarFalha(falha);
        } else tratarFalha(falha);
      },
      finalizar: () => setOcupado(false),
    });
  }

  async function atualizarSituacao() {
    if (!recuperacao || bloqueioSolicitado.current) return;
    await requisicoes.executar((signal) => consultarSituacaoOperador(recuperacao.operador, signal), {
      iniciar: () => {
        setOcupado(true);
        setErro('');
        setMensagem('');
        setRecuperacao((atual) => atual ? { ...atual, erroConsulta: '' } : null);
      },
      concluir: (resultado) => {
        setOperador(resultado);
        recuperacaoPendente.current = false;
        setRecuperacao(null);
        setModo(null);
        setBaixa({ boa: '', retrabalho: '', refugo: '' });
        setMensagem('Situação atualizada. Confira a execução antes de continuar.');
      },
      falhar: (falha) => {
        setRecuperacao((atual) => atual ? { ...atual, erroConsulta: falha instanceof ErroApiIlha ? falha.message : 'Não foi possível consultar a situação. Verifique a conexão e tente novamente.' } : null);
        if (falha instanceof ErroApiIlha && (falha.status === 401 || falha.status === 503)) tratarFalha(falha);
      },
      finalizar: () => setOcupado(false),
    });
  }

  // A identificação só mostra a situação; nenhuma ação é executada pela leitura.
  async function identificar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lida = matricula.trim();
    if (!lida || !podeIdentificar || requisicoes.emAndamento() || bloqueioSolicitado.current) return;
    await executar((signal) => identificarOperador(lida, signal), '', true);
  }

  function limparIdentificacao() {
    requisicoes.invalidar();
    recuperacaoPendente.current = false;
    setRecuperacao(null);
    setMatricula('');
    setOperador(null);
    setModo(null);
    setErro('');
    setMensagem('');
    setBaixa({ boa: '', retrabalho: '', refugo: '' });
    setOcupado(false);
  }

  function sair() {
    if (requisicoes.emAndamento() || bloqueioSolicitado.current) return;
    limparIdentificacao();
    campoRef.current?.focus();
  }

  async function bloquear() {
    if (bloqueioSolicitado.current && requisicoes.emAndamento()) return;
    bloqueioSolicitado.current = true;
    limparIdentificacao();
    await requisicoes.executar(() => bloquearTerminal(), {
      iniciar: () => setBloqueio('enviando'),
      concluir: () => { setBloqueio('concluido'); router.refresh(); },
      falhar: () => setBloqueio('falhou'),
      finalizar: () => {},
    });
  }

  const execucao = operador?.execucaoAberta ?? null;
  const quantidades = { boa: lerQuantidade(baixa.boa), retrabalho: lerQuantidade(baixa.retrabalho), refugo: lerQuantidade(baixa.refugo) };
  const quantidadesValidas = quantidades.boa !== undefined && quantidades.retrabalho !== undefined && quantidades.refugo !== undefined;
  const soma = quantidadesValidas ? Math.round(((quantidades.boa ?? 0) + (quantidades.retrabalho ?? 0) + (quantidades.refugo ?? 0)) * 100) / 100 : null;
  const somaCerta = execucao !== null && soma === execucao.ordem.quantidade;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4"><BrandGunp variante="painel" /><span className="hidden text-sm text-muted sm:inline">Ilha de apontamento</span></div>
        <button type="button" onClick={() => void bloquear()} disabled={bloqueio === 'enviando' || bloqueio === 'concluido'} className={botaoSecundario}><Lock aria-hidden="true" size={18} strokeWidth={2} />{bloqueio === 'enviando' ? 'Bloqueando…' : bloqueio === 'concluido' ? 'Terminal bloqueado' : bloqueio === 'falhou' ? 'Tentar bloquear novamente' : 'Bloquear terminal'}</button>
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        {bloqueio !== null ? (
          <section aria-labelledby="ilha-bloqueio-titulo" className="space-y-4 rounded-xl border border-[#2b353e] bg-[#192128]/70 p-4 sm:p-6">
            <h1 id="ilha-bloqueio-titulo" className="text-2xl font-semibold">Bloqueio do terminal</h1>
            {bloqueio === 'falhou' ? (
              <p role="alert" className="text-base leading-7 text-[#ffb4a5]">Não foi possível confirmar o bloqueio do terminal. Verifique a conexão e tente bloquear novamente.</p>
            ) : <p role="status" className="text-base leading-7 text-muted">{bloqueio === 'enviando' ? 'Bloqueando o terminal…' : 'Terminal bloqueado. Carregando a tela de liberação…'}</p>}
            {bloqueio === 'concluido' && <button type="button" onClick={() => router.refresh()} className={botaoSecundario}>Atualizar página</button>}
          </section>
        ) : <>
        <form onSubmit={identificar} className="rounded-xl border border-[#2b353e] bg-[#192128]/70 p-4 sm:p-5">
          <label htmlFor="ilha-matricula" className="block text-base font-medium">{operador ? 'Outro operador: leia ou digite a matrícula' : 'Leia o crachá ou digite a matrícula'}</label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><ScanLine aria-hidden="true" size={24} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <input id="ilha-matricula" ref={campoRef} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={!podeIdentificar} value={matricula} onChange={(event) => setMatricula(event.target.value)}
                className="h-14 w-full rounded-lg border border-[#3b454e] bg-background pr-4 pl-12 font-mono text-xl tracking-wide outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-wait disabled:opacity-60" />
            </div>
            <button type="submit" disabled={!matricula.trim() || !podeIdentificar} className={`${botaoGrande} bg-accent text-[#171b1f] hover:bg-[#ff8d40]`}>Identificar</button>
          </div>
          {modo !== null && <p className="mt-3 text-sm leading-6 text-muted">Conclua ou cancele o formulário abaixo antes de ler outro crachá. Use Sair para trocar de operador.</p>}
        </form>

        {erro && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/30 bg-[#f49a8a]/10 p-4 text-base leading-7 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={22} strokeWidth={2} className="mt-1 shrink-0" />{erro}</p>}
        {mensagem && <p role="status" className="flex items-start gap-2 rounded-lg border border-[#7bcba5]/30 bg-[#7bcba5]/10 p-4 text-base leading-7 text-[#a6dfbf]"><CheckCircle2 aria-hidden="true" size={22} strokeWidth={2} className="mt-1 shrink-0" />{mensagem}</p>}
        {ocupado && !operador && <p role="status" className="flex items-center gap-3 text-base text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Consultando…</p>}
        {ocupado && operador && !recuperacao && <p role="status" className="flex items-center gap-3 text-base text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Registrando ação. Aguarde antes de trocar o operador.</p>}

        {operador && (
          <section aria-labelledby="ilha-operador" className="space-y-5 rounded-xl border border-[#2b353e] bg-[#192128]/70 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 id="ilha-operador" className="text-2xl font-semibold">{operador.nome}</h1>
                <p className="mt-1 text-base text-muted">Matrícula {operador.matricula}{operador.setor ? ` · ${operador.setor}` : ''}</p>
              </div>
              <button type="button" onClick={sair} disabled={ocupado} className={botaoSecundario}><LogOut aria-hidden="true" size={18} strokeWidth={2} />Sair</button>
            </div>

            {recuperacao ? (
              <div className="space-y-4 rounded-lg border border-[#ffcf99]/30 bg-[#ffcf99]/5 p-4">
                <p role="alert" className="text-base leading-7 text-[#ffcf99]">{recuperacao.detalhe} Consulte a situação atual do operador antes de continuar.</p>
                {recuperacao.erroConsulta && <p role="alert" className="text-base leading-7 text-[#ffb4a5]">{recuperacao.erroConsulta}</p>}
                <button type="button" onClick={() => void atualizarSituacao()} disabled={ocupado} className={`${botaoSecundario} w-full sm:w-auto`}>
                  {ocupado ? <LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" /> : <RefreshCw aria-hidden="true" size={22} strokeWidth={2} />}
                  {ocupado ? 'Consultando situação…' : 'Atualizar situação do operador'}
                </button>
                {ocupado && <p role="status" className="text-base text-muted">Consultando a situação atual do operador…</p>}
                <p className="text-sm leading-6 text-muted">A consulta não repete a ação anterior. Aguarde os dados atualizados para conferir a execução.</p>
              </div>
            ) : execucao ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-base font-semibold ${execucao.status === 'PAUSADA' ? 'bg-[#ffcf99]/15 text-[#ffcf99]' : 'bg-[#7bcba5]/15 text-[#a6dfbf]'}`}>
                    {execucao.status === 'PAUSADA' ? <Pause aria-hidden="true" size={18} strokeWidth={2} /> : <Timer aria-hidden="true" size={18} strokeWidth={2} />}
                    {execucao.status === 'PAUSADA' ? `Pausada${execucao.eventos.at(-1)?.motivo ? ` – ${execucao.eventos.at(-1)?.motivo}` : ''}` : 'Em execução'}
                  </span>
                </div>
                <dl className="grid gap-3 text-base sm:grid-cols-2">
                  <div><dt className="text-sm text-muted">Ordem</dt><dd className="font-semibold">{execucao.ordem.numero} · {execucao.ordem.quantidade.toLocaleString('pt-BR')} {execucao.ordem.unidade}</dd></div>
                  <div><dt className="text-sm text-muted">Produto</dt><dd className="font-semibold">{execucao.produto.codigo} – {execucao.produto.nome}</dd></div>
                  <div><dt className="text-sm text-muted">Etapa</dt><dd className="font-semibold">{execucao.etapa.ordem}. {execucao.etapa.operacao}</dd></div>
                  <div><dt className="text-sm text-muted">Posto</dt><dd className="font-semibold">{execucao.posto.codigo} – {execucao.posto.nome}</dd></div>
                </dl>
                <Relogio execucao={execucao} />

                {modo === null && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {execucao.status === 'PAUSADA' ? (
                      <button type="button" disabled={ocupado} onClick={() => void executar(() => retomarExecucao(operador.matricula, execucao.id), 'Execução retomada.')} className={`${botaoGrande} bg-[#7bcba5] text-[#13201a] hover:bg-[#93d8b6] sm:col-span-3`}><Play aria-hidden="true" size={22} strokeWidth={2} />Retomar</button>
                    ) : (
                      <>
                        <button type="button" disabled={ocupado} onClick={() => { setModo('pausar'); setErro(''); setMensagem(''); }} className={`${botaoGrande} bg-[#ffcf99] text-[#2a1d0c] hover:bg-[#ffdcb3]`}><Pause aria-hidden="true" size={22} strokeWidth={2} />Pausar</button>
                        <button type="button" disabled={ocupado} onClick={() => { setModo('trocar'); setErro(''); }} className={`${botaoGrande} border border-[#3b454e] hover:border-accent`}><Repeat aria-hidden="true" size={22} strokeWidth={2} />Trocar operação</button>
                        <button type="button" disabled={ocupado} onClick={() => { setModo('baixa'); setBaixa({ boa: '', retrabalho: '', refugo: '' }); setErro(''); }} className={`${botaoGrande} bg-accent text-[#171b1f] hover:bg-[#ff8d40]`}><Square aria-hidden="true" size={22} strokeWidth={2} />Finalizar e dar baixa</button>
                      </>
                    )}
                  </div>
                )}

                {modo === 'pausar' && (
                  <IlhaPausa key={execucao.id} ocupado={ocupado} aoCancelar={() => setModo(null)} aoFalhar={tratarFalha}
                    aoConfirmar={(motivoId) => void executar(() => pausarExecucao(operador.matricula, execucao.id, motivoId), 'Execução pausada.')} />
                )}

                {modo === 'baixa' && (
                  <form onSubmit={(event) => { event.preventDefault(); if (somaCerta) void executar(() => darBaixa(operador.matricula, execucao.id, { quantidadeBoa: quantidades.boa!, quantidadeRetrabalho: quantidades.retrabalho!, quantidadeRefugo: quantidades.refugo! }), 'Baixa registrada. A etapa foi concluída.'); }}
                    className="space-y-4 border-t border-white/10 pt-5">
                    <p className="text-lg font-semibold">Resultado da etapa</p>
                    <p className="text-base text-muted">A baixa é da quantidade inteira da ordem: boa + retrabalho + refugo = {execucao.ordem.quantidade.toLocaleString('pt-BR')} {execucao.ordem.unidade}.</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([['boa', 'Boas'], ['retrabalho', 'Retrabalho'], ['refugo', 'Refugo']] as const).map(([campo, rotulo]) => (
                        <div key={campo}>
                          <label htmlFor={`ilha-${campo}`} className="block text-base font-medium">{rotulo}</label>
                          <input id={`ilha-${campo}`} inputMode="decimal" autoComplete="off" value={baixa[campo]} onChange={(event) => setBaixa((atual) => ({ ...atual, [campo]: event.target.value }))}
                            className="mt-2 h-14 w-full rounded-lg border border-[#3b454e] bg-background px-4 text-right font-mono text-xl outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                        </div>
                      ))}
                    </div>
                    <p aria-live="polite" className={`text-base font-medium ${somaCerta ? 'text-[#a6dfbf]' : 'text-[#ffcf99]'}`}>
                      {!quantidadesValidas ? 'Use números maiores ou iguais a zero, com até duas casas decimais.' : `Soma: ${soma?.toLocaleString('pt-BR')} de ${execucao.ordem.quantidade.toLocaleString('pt-BR')}`}
                    </p>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setModo(null)} disabled={ocupado} className={botaoSecundario}>Cancelar</button>
                      <button type="submit" disabled={!somaCerta || ocupado} className={`${botaoGrande} bg-accent text-[#171b1f] hover:bg-[#ff8d40] disabled:cursor-not-allowed`}><Square aria-hidden="true" size={22} strokeWidth={2} />Confirmar baixa</button>
                    </div>
                  </form>
                )}

                {modo === 'trocar' && (
                  <div className="border-t border-white/10 pt-5">
                    <p className="mb-4 text-base text-muted">A execução atual é finalizada sem quantidades e a próxima começa em seguida.</p>
                    <IlhaDestino key={`${operador.id}:${execucao.id}:trocar`} rotuloConfirmar="Trocar para esta etapa" ocupado={ocupado} etapaAtual={{ ordemId: execucao.ordem.id, etapaId: execucao.etapa.id }} aoCancelar={() => setModo(null)} aoFalhar={tratarFalha}
                      aoConfirmar={(destino: Destino) => void executar(() => trocarOperacao(operador.matricula, execucao.id, destino), 'Operação trocada. A nova execução já começou.')} />
                  </div>
                )}
              </div>
            ) : modo === 'iniciar' ? (
              <IlhaDestino key={`${operador.id}:iniciar`} rotuloConfirmar="Iniciar execução" ocupado={ocupado} aoCancelar={() => setModo(null)} aoFalhar={tratarFalha}
                aoConfirmar={(destino: Destino) => void executar(() => iniciarExecucao(operador.matricula, destino), 'Execução iniciada.')} />
            ) : (
              <div className="space-y-4">
                <p className="text-base text-muted">Nenhuma execução em aberto para este operador.</p>
                <button type="button" onClick={() => { setModo('iniciar'); setErro(''); setMensagem(''); }} className={`${botaoGrande} w-full bg-accent text-[#171b1f] hover:bg-[#ff8d40] sm:w-auto`}><Play aria-hidden="true" size={22} strokeWidth={2} />Iniciar execução</button>
              </div>
            )}
          </section>
        )}
        </>}
      </div>
    </main>
  );
}
