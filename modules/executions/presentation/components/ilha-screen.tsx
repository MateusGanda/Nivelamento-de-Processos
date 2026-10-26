'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, LoaderCircle, Lock, LogOut, Pause, Play, Repeat, ScanLine, Square, Timer } from 'lucide-react';
import { BrandGunp } from '../../../access/presentation/components/brand-gunp';
import type { Destino, ExecucaoAberta, OperadorDaIlha } from '../../domain/execucao';
import {
  bloquearTerminal, darBaixa, ErroApiIlha, identificarOperador, iniciarExecucao, listarMotivosPausa, pausarExecucao, retomarExecucao, trocarOperacao,
} from '../api-client';
import { formatarDuracao, lerQuantidade, tempoDecorrido } from '../tempo-decorrido';
import { IlhaDestino } from './ilha-destino';

type Modo = null | 'iniciar' | 'trocar' | 'pausar' | 'baixa';

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
  const emEnvio = useRef(false);
  const [matricula, setMatricula] = useState('');
  const [operador, setOperador] = useState<OperadorDaIlha | null>(null);
  const [modo, setModo] = useState<Modo>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [motivos, setMotivos] = useState<{ id: string; nome: string }[] | null>(null);
  const [motivoId, setMotivoId] = useState('');
  const [baixa, setBaixa] = useState({ boa: '', retrabalho: '', refugo: '' });

  // O leitor USB funciona como teclado: sem outro campo em uso, o foco volta para a matrícula.
  useEffect(() => {
    const devolverFoco = () => {
      const ativo = document.activeElement;
      if (!ativo || ativo === document.body) campoRef.current?.focus();
    };
    const id = setInterval(devolverFoco, 500);
    return () => clearInterval(id);
  }, []);

  const tratarFalha = useCallback((falha: unknown) => {
    if (falha instanceof ErroApiIlha && (falha.status === 401 || falha.status === 503)) {
      router.refresh();
      return;
    }
    setErro(falha instanceof ErroApiIlha ? falha.message : 'Não foi possível concluir. Verifique a conexão e tente novamente.');
  }, [router]);

  async function executar(acao: () => Promise<OperadorDaIlha>, sucesso: string) {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      setOperador(await acao());
      setMensagem(sucesso);
      setModo(null);
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      emEnvio.current = false;
      setOcupado(false);
    }
  }

  // A identificação só mostra a situação; nenhuma ação é executada pela leitura.
  async function identificar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lida = matricula.trim();
    if (!lida || emEnvio.current) return;
    setMatricula('');
    setModo(null);
    setOperador(null);
    await executar(() => identificarOperador(lida), '');
  }

  function sair() {
    setOperador(null);
    setModo(null);
    setErro('');
    setMensagem('');
    campoRef.current?.focus();
  }

  async function abrirPausa() {
    setModo('pausar');
    setMotivoId('');
    if (motivos) return;
    try { setMotivos(await listarMotivosPausa()); }
    catch (falha) { tratarFalha(falha); setModo(null); }
  }

  async function bloquear() {
    try { await bloquearTerminal(); } finally { router.refresh(); }
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
        <button type="button" onClick={() => void bloquear()} className={botaoSecundario}><Lock aria-hidden="true" size={18} strokeWidth={2} />Bloquear terminal</button>
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <form onSubmit={identificar} className="rounded-xl border border-[#2b353e] bg-[#192128]/70 p-4 sm:p-5">
          <label htmlFor="ilha-matricula" className="block text-base font-medium">{operador ? 'Outro operador: leia ou digite a matrícula' : 'Leia o crachá ou digite a matrícula'}</label>
          <div className="mt-3 flex gap-3">
            <div className="relative flex-1"><ScanLine aria-hidden="true" size={24} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <input id="ilha-matricula" ref={campoRef} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} value={matricula} onChange={(event) => setMatricula(event.target.value)}
                className="h-14 w-full rounded-lg border border-[#3b454e] bg-background pr-4 pl-12 font-mono text-xl tracking-wide outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <button type="submit" disabled={!matricula.trim() || ocupado} className={`${botaoGrande} bg-accent text-[#171b1f] hover:bg-[#ff8d40]`}>Identificar</button>
          </div>
        </form>

        {erro && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/30 bg-[#f49a8a]/10 p-4 text-base leading-7 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={22} strokeWidth={2} className="mt-1 shrink-0" />{erro}</p>}
        {mensagem && <p role="status" className="flex items-start gap-2 rounded-lg border border-[#7bcba5]/30 bg-[#7bcba5]/10 p-4 text-base leading-7 text-[#a6dfbf]"><CheckCircle2 aria-hidden="true" size={22} strokeWidth={2} className="mt-1 shrink-0" />{mensagem}</p>}
        {ocupado && !operador && <p role="status" className="flex items-center gap-3 text-base text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Consultando…</p>}

        {operador && (
          <section aria-labelledby="ilha-operador" className="space-y-5 rounded-xl border border-[#2b353e] bg-[#192128]/70 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 id="ilha-operador" className="text-2xl font-semibold">{operador.nome}</h1>
                <p className="mt-1 text-base text-muted">Matrícula {operador.matricula}{operador.setor ? ` · ${operador.setor}` : ''}</p>
              </div>
              <button type="button" onClick={sair} className={botaoSecundario}><LogOut aria-hidden="true" size={18} strokeWidth={2} />Sair</button>
            </div>

            {execucao ? (
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
                        <button type="button" disabled={ocupado} onClick={() => void abrirPausa()} className={`${botaoGrande} bg-[#ffcf99] text-[#2a1d0c] hover:bg-[#ffdcb3]`}><Pause aria-hidden="true" size={22} strokeWidth={2} />Pausar</button>
                        <button type="button" disabled={ocupado} onClick={() => { setModo('trocar'); setErro(''); }} className={`${botaoGrande} border border-[#3b454e] hover:border-accent`}><Repeat aria-hidden="true" size={22} strokeWidth={2} />Trocar operação</button>
                        <button type="button" disabled={ocupado} onClick={() => { setModo('baixa'); setBaixa({ boa: '', retrabalho: '', refugo: '' }); setErro(''); }} className={`${botaoGrande} bg-accent text-[#171b1f] hover:bg-[#ff8d40]`}><Square aria-hidden="true" size={22} strokeWidth={2} />Finalizar e dar baixa</button>
                      </>
                    )}
                  </div>
                )}

                {modo === 'pausar' && (
                  <fieldset className="space-y-3 border-t border-white/10 pt-5">
                    <legend className="mb-2 text-lg font-semibold">Motivo da pausa</legend>
                    {motivos === null ? <p role="status" className="text-base text-muted">Carregando motivos…</p>
                      : motivos.length === 0 ? <p className="text-base text-[#ffcf99]">Nenhum motivo de pausa cadastrado. Peça ao administrador para cadastrar os motivos.</p>
                      : <div className="grid gap-2 sm:grid-cols-2">{motivos.map((motivo) => (
                        <button key={motivo.id} type="button" aria-pressed={motivo.id === motivoId} onClick={() => setMotivoId(motivo.id)}
                          className={`min-h-12 cursor-pointer rounded-lg border px-4 py-3 text-left text-base focus-visible:outline-2 focus-visible:outline-accent ${motivo.id === motivoId ? 'border-accent bg-accent/10' : 'border-[#3b454e] hover:border-accent'}`}>{motivo.nome}</button>
                      ))}</div>}
                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setModo(null)} disabled={ocupado} className={botaoSecundario}>Cancelar</button>
                      <button type="button" disabled={!motivoId || ocupado} onClick={() => void executar(() => pausarExecucao(operador.matricula, execucao.id, motivoId), 'Execução pausada.')} className={`${botaoGrande} bg-[#ffcf99] text-[#2a1d0c] hover:bg-[#ffdcb3] disabled:cursor-not-allowed`}><Pause aria-hidden="true" size={22} strokeWidth={2} />Confirmar pausa</button>
                    </div>
                  </fieldset>
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
                    <IlhaDestino rotuloConfirmar="Trocar para esta etapa" ocupado={ocupado} excluirEtapaId={execucao.etapa.id} aoCancelar={() => setModo(null)} aoFalhar={tratarFalha}
                      aoConfirmar={(destino: Destino) => void executar(() => trocarOperacao(operador.matricula, execucao.id, destino), 'Operação trocada. A nova execução já começou.')} />
                  </div>
                )}
              </div>
            ) : modo === 'iniciar' ? (
              <IlhaDestino rotuloConfirmar="Iniciar execução" ocupado={ocupado} aoCancelar={() => setModo(null)} aoFalhar={tratarFalha}
                aoConfirmar={(destino: Destino) => void executar(() => iniciarExecucao(operador.matricula, destino), 'Execução iniciada.')} />
            ) : (
              <div className="space-y-4">
                <p className="text-base text-muted">Nenhuma execução em aberto para este operador.</p>
                <button type="button" onClick={() => { setModo('iniciar'); setErro(''); setMensagem(''); }} className={`${botaoGrande} w-full bg-accent text-[#171b1f] hover:bg-[#ff8d40] sm:w-auto`}><Play aria-hidden="true" size={22} strokeWidth={2} />Iniciar execução</button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
