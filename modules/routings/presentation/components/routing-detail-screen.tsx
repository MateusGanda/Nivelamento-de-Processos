'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, CopyPlus, Factory, Info, LoaderCircle, Lock, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import type { OperacaoDoRoteiro, RoteiroDetalhe } from '../../domain/roteiro';
import { buscarRoteiro, criarVersaoRoteiro, definirPostosEtapa, definirStatusRoteiro, ErroApiRoteiros, salvarEtapasRoteiro } from '../api-client';
import { etapasAlteradas, moverEtapa, paraEdicao, type EtapaEmEdicao } from '../listing';
import { EtapaPostosDialog, type PedidoPostosEtapa } from './etapa-postos-dialog';
import { RoteiroProdutosSection } from './roteiro-produtos-section';

const botao = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-wait aria-disabled:opacity-60';
const botaoIcone = 'inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border border-[#3b454e] hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

export function RoutingDetailScreen({ id, operacoes, versaoCriada }: { id: string; operacoes: OperacaoDoRoteiro[]; versaoCriada: boolean }) {
  const router = useRouter();
  const [roteiro, setRoteiro] = useState<RoteiroDetalhe | null>(null);
  const [erroCarga, setErroCarga] = useState('');
  const [mensagem, setMensagem] = useState(versaoCriada ? 'Nova versão criada com as mesmas etapas, postos, produtos e tempos padrão. A versão vigente de cada produto não mudou, e as ordens da versão anterior também não.' : '');
  const [erro, setErro] = useState('');
  const [edicao, setEdicao] = useState<EtapaEmEdicao[]>([]);
  const [operacaoNova, setOperacaoNova] = useState('');
  const [ocupado, setOcupado] = useState<'etapas' | 'status' | 'versao' | 'produto' | null>(null);
  const [pedidoPostos, setPedidoPostos] = useState<PedidoPostosEtapa | null>(null);
  const dialogPostosRef = useRef<HTMLDialogElement>(null);
  const origemFoco = useRef<HTMLButtonElement | null>(null);
  const novas = useRef(0);

  const tratarFalha = useCallback((falha: unknown, padrao: string): string | null => {
    if (falha instanceof ErroApiRoteiros && (falha.status === 401 || falha.status === 403)) {
      router.replace('/login');
      router.refresh();
      return null;
    }
    return falha instanceof ErroApiRoteiros ? falha.message : padrao;
  }, [router]);

  const aplicar = useCallback((dados: RoteiroDetalhe) => {
    setRoteiro(dados);
    setEdicao(paraEdicao(dados.etapas));
  }, []);

  const carregar = useCallback((signal?: AbortSignal) => {
    buscarRoteiro(id, signal).then((dados) => { if (!signal?.aborted) { aplicar(dados); setErroCarga(''); } })
      .catch((falha: unknown) => {
        if (signal?.aborted) return;
        setErroCarga(tratarFalha(falha, 'Não foi possível carregar o roteiro. Verifique sua conexão e tente novamente.') ?? '');
      });
  }, [id, aplicar, tratarFalha]);

  useEffect(() => {
    const controller = new AbortController();
    carregar(controller.signal);
    return () => controller.abort();
  }, [carregar]);

  async function executar(tipo: 'etapas' | 'status' | 'versao' | 'produto', acao: () => Promise<RoteiroDetalhe>, sucesso: string, padrao: string) {
    if (ocupado) return;
    setOcupado(tipo);
    setErro('');
    setMensagem('');
    try {
      const dados = await acao();
      if (tipo === 'versao') {
        router.push(`/painel/roteiros/${dados.id}?versao=criada`);
        return;
      }
      aplicar(dados);
      setMensagem(sucesso);
    } catch (falha) {
      const texto = tratarFalha(falha, padrao);
      if (texto) setErro(texto);
    } finally {
      setOcupado(null);
    }
  }

  // Gravações feitas dentro de um formulário: o erro volta para o formulário, que continua aberto.
  async function gravarNoFormulario(acao: () => Promise<RoteiroDetalhe>, sucesso: string, padrao: string): Promise<string | null> {
    try {
      aplicar(await acao());
      setErro('');
      setMensagem(sucesso);
      return null;
    } catch (falha) {
      return tratarFalha(falha, padrao) ?? '';
    }
  }

  const salvarPostos = (etapaId: string, postoIds: string[]) => gravarNoFormulario(() => definirPostosEtapa(id, etapaId, postoIds),
    'Postos da etapa salvos com sucesso.', 'Não foi possível salvar os postos. Verifique sua conexão e tente novamente.');

  if (erroCarga) {
    return (
      <div className="mx-auto w-full max-w-[1440px]">
        <Link href="/painel/roteiros" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-foreground"><ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />Roteiros</Link>
        <div className="mt-6 flex flex-col items-start gap-4 rounded-xl border border-[#2b353e] bg-[#192128]/65 p-6">
          <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erroCarga}</p>
          <button type="button" onClick={() => { setErroCarga(''); carregar(); }} className={botao}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!roteiro) {
    return <p role="status" className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando roteiro…</p>;
  }

  const alterado = etapasAlteradas(roteiro.etapas, edicao);
  const salvas = new Map(roteiro.etapas.map((etapa) => [etapa.id, etapa]));

  function adicionarEtapa() {
    const operacao = operacoes.find((item) => item.id === operacaoNova);
    if (!operacao) return;
    setEdicao((atual) => [...atual, { chave: `nova-${++novas.current}`, operacao }]);
    setOperacaoNova('');
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <Link href="/painel/roteiros" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"><ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />Roteiros</Link>

      <header className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight break-words [overflow-wrap:anywhere]">{roteiro.nome}</h1>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${roteiro.ativo ? 'border-[#7bcba5]/20 bg-[#7bcba5]/10 text-[#a6dfbf]' : 'border-white/10 bg-white/5 text-muted'}`}>{roteiro.ativo ? 'Ativo' : 'Inativo'}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">Versão {roteiro.versao} · {roteiro.etapas.length} {roteiro.etapas.length === 1 ? 'etapa' : 'etapas'} · {roteiro.quantidadeOrdens} {roteiro.quantidadeOrdens === 1 ? 'ordem de produção' : 'ordens de produção'}</p>
          {roteiro.versoes.length > 1 && (
            <nav aria-label="Versões deste roteiro" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Versões:</span>
              {roteiro.versoes.map((versao) => versao.id === roteiro.id
                ? <span key={versao.id} aria-current="page" className="rounded-md bg-white/10 px-2 py-0.5 font-medium">v{versao.versao}</span>
                : <Link key={versao.id} href={`/painel/roteiros/${versao.id}`} className="rounded-md px-2 py-0.5 text-[#c1c8cf] underline-offset-4 hover:underline">v{versao.versao}{versao.ativo ? '' : ' (inativa)'}</Link>)}
            </nav>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" aria-disabled={ocupado !== null} onClick={() => void executar('versao', () => criarVersaoRoteiro(roteiro.id), '', 'Não foi possível criar a nova versão. Tente novamente.')} className={botao}>
            {ocupado === 'versao' ? <LoaderCircle aria-hidden="true" size={18} strokeWidth={2} className="motion-safe:animate-spin" /> : <CopyPlus aria-hidden="true" size={18} strokeWidth={2} />}Nova versão
          </button>
          <button type="button" aria-disabled={ocupado !== null} onClick={() => void executar('status', () => definirStatusRoteiro(roteiro.id, !roteiro.ativo), roteiro.ativo ? 'Roteiro inativado com sucesso.' : 'Roteiro ativado com sucesso.', 'Não foi possível alterar o status. Tente novamente.')} className={botao}>
            {ocupado === 'status' ? <LoaderCircle aria-hidden="true" size={18} strokeWidth={2} className="motion-safe:animate-spin" /> : roteiro.ativo ? <PowerOff aria-hidden="true" size={18} strokeWidth={2} /> : <Power aria-hidden="true" size={18} strokeWidth={2} />}{roteiro.ativo ? 'Inativar' : 'Ativar'}
          </button>
        </div>
      </header>

      {mensagem && <p role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-[#7bcba5]/25 bg-[#7bcba5]/5 p-4 text-sm leading-6 text-[#a6dfbf]"><CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{mensagem}</p>}
      {erro && <p role="alert" className="mt-6 flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-4 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}
      {roteiro.travado && (
        <p className="mt-6 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-[#c1c8cf]">
          <Lock aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />
          Este roteiro já é usado por ordens de produção, por isso as etapas estão travadas. Para mudar as etapas, use Nova versão. Os postos de cada etapa continuam podendo ser alterados.
        </p>
      )}

      <section aria-labelledby="etapas-titulo" className="mt-7 min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <h2 id="etapas-titulo" className="text-lg font-semibold">Etapas</h2>
          <p className="mt-1 text-sm leading-6 text-muted">A ordem das etapas é a sequência do processo. Ela não bloqueia nem libera etapas automaticamente.</p>
        </div>

        {edicao.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Nenhuma etapa. {roteiro.travado ? '' : 'Adicione a primeira etapa abaixo.'}</p>
        ) : (
          <ol aria-label="Etapas do roteiro" className="divide-y divide-white/5">
            {edicao.map((etapa, indice) => {
              const salva = etapa.id ? salvas.get(etapa.id) : undefined;
              return (
                <li key={etapa.chave} className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-semibold">{indice + 1}</span>
                    <div className="min-w-0">
                      <p className="font-medium break-words"><span className="sr-only">Etapa {indice + 1}: </span>{etapa.operacao.nome}{!salva && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">nova, não salva</span>}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
                        {!salva ? 'Os postos podem ser escolhidos depois de salvar as etapas.'
                          : salva.postos.length === 0 ? <span className="text-[#ffcf99]">Nenhum posto compatível.</span>
                          : salva.postos.map((posto) => <span key={posto.id} className={`rounded-md border px-2 py-0.5 ${posto.ativo ? 'border-white/10 text-[#c1c8cf]' : 'border-white/5 text-muted line-through'}`} title={`${posto.nome} (${posto.setorNome})${posto.ativo ? '' : ', inativo'}`}>{posto.codigo}</span>)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-13 lg:pl-0">
                    {salva && (
                      <button type="button" aria-haspopup="dialog" aria-controls="postos-etapa" disabled={alterado} title={alterado ? 'Salve ou descarte as alterações das etapas antes de mudar os postos.' : undefined}
                        aria-label={`Postos da etapa ${indice + 1}, ${etapa.operacao.nome}`}
                        onClick={(event) => { origemFoco.current = event.currentTarget; setPedidoPostos((atual) => ({ etapa: salva, seq: (atual?.seq ?? 0) + 1 })); }}
                        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
                      ><Factory aria-hidden="true" size={16} strokeWidth={2} />Postos</button>
                    )}
                    {!roteiro.travado && <>
                      <button type="button" aria-label={`Mover etapa ${indice + 1} para cima`} disabled={indice === 0 || ocupado !== null} onClick={() => setEdicao((atual) => moverEtapa(atual, indice, -1))} className={botaoIcone}><ArrowUp aria-hidden="true" size={16} strokeWidth={2} /></button>
                      <button type="button" aria-label={`Mover etapa ${indice + 1} para baixo`} disabled={indice === edicao.length - 1 || ocupado !== null} onClick={() => setEdicao((atual) => moverEtapa(atual, indice, 1))} className={botaoIcone}><ArrowDown aria-hidden="true" size={16} strokeWidth={2} /></button>
                      <button type="button" aria-label={`Remover etapa ${indice + 1}, ${etapa.operacao.nome}`} disabled={ocupado !== null} onClick={() => setEdicao((atual) => atual.filter((item) => item.chave !== etapa.chave))} className={botaoIcone}><Trash2 aria-hidden="true" size={16} strokeWidth={2} /></button>
                    </>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!roteiro.travado && (
          <div className="flex flex-col gap-4 border-t border-white/10 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 sm:max-w-md">
                <label htmlFor="etapa-operacao" className="mb-2 block text-sm font-medium">Operação da nova etapa</label>
                <select id="etapa-operacao" value={operacaoNova} onChange={(event) => setOperacaoNova(event.target.value)} disabled={operacoes.length === 0 || ocupado !== null} className="h-11 w-full rounded-lg border border-[#3b454e] bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60">
                  <option value="">{operacoes.length === 0 ? 'Nenhuma operação cadastrada' : 'Selecione a operação'}</option>
                  {operacoes.map((operacao) => <option key={operacao.id} value={operacao.id}>{operacao.nome}</option>)}
                </select>
              </div>
              <button type="button" onClick={adicionarEtapa} disabled={!operacaoNova || ocupado !== null} className={`${botao} disabled:cursor-not-allowed disabled:opacity-50`}><Plus aria-hidden="true" size={18} strokeWidth={2} />Adicionar etapa</button>
            </div>
            {operacoes.length === 0 && <p className="text-xs text-muted">Cadastre as operações antes de montar as etapas.</p>}
            {alterado && (
              <div className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-sm text-[#ffcf99]"><Info aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0" />Há alterações nas etapas que ainda não foram salvas.{edicao.length === 0 ? ' O roteiro precisa de pelo menos uma etapa.' : ''}</p>
                <div className="flex gap-3">
                  <button type="button" disabled={ocupado !== null} onClick={() => { setEdicao(paraEdicao(roteiro.etapas)); setErro(''); }} className={`${botao} disabled:opacity-50`}>Descartar</button>
                  <button type="button" aria-disabled={ocupado !== null || edicao.length === 0}
                    onClick={() => { if (edicao.length > 0) void executar('etapas', () => salvarEtapasRoteiro(roteiro.id, edicao.map((etapa) => etapa.id ? { id: etapa.id, operacaoId: etapa.operacao.id } : { operacaoId: etapa.operacao.id })), 'Etapas salvas com sucesso.', 'Não foi possível salvar as etapas. Tente novamente.'); }}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                  >{ocupado === 'etapas' && <LoaderCircle aria-hidden="true" size={18} strokeWidth={2} className="motion-safe:animate-spin" />}Salvar etapas</button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      <RoteiroProdutosSection
        roteiro={roteiro} etapasPendentes={alterado} ocupado={ocupado !== null}
        executar={(acao, sucesso, padrao) => executar('produto', acao, sucesso, padrao)}
        salvarTempos={(acao) => gravarNoFormulario(acao, 'Tempos padrão salvos com sucesso.', 'Não foi possível salvar os tempos padrão. Verifique sua conexão e tente novamente.')}
      />
      <EtapaPostosDialog dialogRef={dialogPostosRef} pedido={pedidoPostos} salvar={salvarPostos} aoFechar={() => origemFoco.current?.focus()} />
    </div>
  );
}
