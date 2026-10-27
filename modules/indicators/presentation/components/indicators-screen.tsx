'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Download, LoaderCircle, Printer, RefreshCw } from 'lucide-react';
import { consultarIndicadores, ErroApiIndicadores, type RespostaIndicadores } from '../api-client';
import { conferirDatas, dataLocal, periodoDoAtalho, periodoEntreDatas, type Atalho, type Periodo } from '../periodo';
import { formatarDuracao, formatarInstante, formatarPercentual, formatarQuantidade, formatarSegundosPorUnidade, INDISPONIVEL } from '../formatacao';
import { descreverPendencias } from '../pendencias';
import { GraficoCargaPorPosto, GraficoTemposPorPosto } from './indicadores-graficos';
import { GraficoPorDia, GraficoQualidade } from './graficos-dia-qualidade';
import { gerarCsvIndicadores, nomeDoArquivo } from '../exportacao';
import { leituraDoPadrao, qualidadePorUnidade, resumirIndicadores, situacaoDaOrdem } from '../resumo';

type Escolha = Atalho | 'personalizado';
const ATALHOS: { valor: Escolha; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' }, { valor: '7dias', rotulo: 'Últimos 7 dias' },
  { valor: '30dias', rotulo: 'Últimos 30 dias' }, { valor: 'personalizado', rotulo: 'Personalizado' },
];
const campoData = 'h-11 rounded-lg border border-[#3b454e] bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 [color-scheme:dark]';
const botaoSecundario = 'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const celula = 'px-4 py-3';
const numero = 'px-4 py-3 text-right tabular-nums';

function dataDoInstante(iso: string, fimExclusivo = false) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(Date.parse(iso) - (fimExclusivo ? 1 : 0)));
}

function Secao({ id, titulo, tipo, descricao, children }: { id: string; titulo: string; tipo: 'periodo' | 'agora'; descricao: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
      <header className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={id} className="text-lg font-semibold">{titulo}</h2>
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-muted">{tipo === 'periodo' ? 'No período' : 'Situação agora'}</span>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-muted">{descricao}</p>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

function Tabela({ legenda, cabecalho, children, minimo = 720 }: { legenda: string; cabecalho: { titulo: string; direita?: boolean }[]; children: ReactNode; minimo?: number }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: minimo }}>
        <caption className="sr-only">{legenda}</caption>
        <thead className="border-b border-white/10 text-muted"><tr>
          {cabecalho.map((coluna) => <th key={coluna.titulo} scope="col" className={`px-4 py-2.5 font-medium ${coluna.direita ? 'text-right' : ''}`}>{coluna.titulo}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

function Resumo({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65 p-4 sm:p-5">
      <p className="text-sm text-muted">{rotulo}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{valor}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{detalhe}</p>
    </div>
  );
}

export function IndicatorsScreen() {
  const router = useRouter();
  const [escolha, setEscolha] = useState<Escolha>('7dias');
  // O período só aparece na tela depois da resposta, então calcular "hoje" aqui não diverge da renderização no servidor.
  const [datas, setDatas] = useState(() => ({ primeiro: dataLocal(Date.now()), ultimo: dataLocal(Date.now()) }));
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDoAtalho('7dias', Date.now()));
  const [erroDatas, setErroDatas] = useState('');
  const [dados, setDados] = useState<RespostaIndicadores | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    consultarIndicadores(periodo, controller.signal).then((resposta) => {
      if (controller.signal.aborted) return;
      setDados(resposta);
      setErro('');
    }).catch((falha: unknown) => {
      if (controller.signal.aborted) return;
      if (falha instanceof ErroApiIndicadores && (falha.status === 401 || falha.status === 403)) {
        router.replace('/login');
        router.refresh();
        return;
      }
      setErro(falha instanceof ErroApiIndicadores ? falha.message : 'Não foi possível carregar os indicadores. Verifique sua conexão e tente novamente.');
    }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [periodo, versao, router]);

  // Quem pede uma consulta liga o indicador de carregamento; o efeito só busca.
  const consultar = useCallback((novo?: Periodo) => {
    setCarregando(true);
    if (novo) setPeriodo(novo);
    setVersao((v) => v + 1);
  }, []);

  const escolher = useCallback((valor: Escolha) => {
    setEscolha(valor);
    setErroDatas('');
    if (valor !== 'personalizado') consultar(periodoDoAtalho(valor, Date.now()));
  }, [consultar]);

  function aplicarDatas() {
    const problema = conferirDatas(datas.primeiro, datas.ultimo);
    setErroDatas(problema ?? '');
    if (!problema) consultar(periodoEntreDatas(datas.primeiro, datas.ultimo));
  }

  const resumo = useMemo(() => dados && { ...resumirIndicadores(dados), pendencias: descreverPendencias(dados) }, [dados]);
  const qualidade = useMemo(() => (dados ? qualidadePorUnidade(dados) : []), [dados]);

  // Na impressão, as tabelas recolhidas também saem no papel; depois voltam como estavam.
  useEffect(() => {
    const abertos = new Map<HTMLDetailsElement, boolean>();
    // Guarda só o estado de antes da primeira impressão, mesmo se o evento vier repetido.
    const antes = () => document.querySelectorAll<HTMLDetailsElement>('.relatorio-indicadores details').forEach((d) => { if (!abertos.has(d)) abertos.set(d, d.open); d.open = true; });
    const depois = () => { abertos.forEach((aberto, d) => { d.open = aberto; }); abertos.clear(); };
    window.addEventListener('beforeprint', antes);
    window.addEventListener('afterprint', depois);
    return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', depois); };
  }, []);

  function baixarPlanilha() {
    if (!dados) return;
    const url = URL.createObjectURL(new Blob([gerarCsvIndicadores(dados)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeDoArquivo(dados);
    link.click();
    URL.revokeObjectURL(url);
  }

  const pausasDetalhadas = useMemo(() => (dados?.tempos ?? []).flatMap((t) => t.pausasPorMotivo.map((m) => ({ posto: t.posto.codigo, ...m }))), [dados]);

  return (
    <div className="relatorio-indicadores mx-auto w-full min-w-0 max-w-[1440px]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Indicadores</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Produção, tempos e carga calculados a partir dos apontamentos da ilha. Os indicadores apoiam a análise da distribuição de carga; o tempo é da execução, não mede o desempenho de uma pessoa.</p>
      </header>

      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-[#2b353e] bg-[#192128]/65 p-4 sm:p-5">
        <fieldset className="flex flex-wrap items-center gap-2 print:hidden">
          <legend className="sr-only">Período</legend>
          {ATALHOS.map((atalho) => (
            <button key={atalho.valor} type="button" aria-pressed={escolha === atalho.valor} onClick={() => escolher(atalho.valor)}
              className={`min-h-10 cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${escolha === atalho.valor ? 'border-accent bg-accent/10 font-semibold' : 'border-[#3b454e] hover:border-accent'}`}>
              {atalho.rotulo}
            </button>
          ))}
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button type="button" onClick={() => consultar()} className={botaoSecundario}>
              <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />Atualizar
            </button>
            <button type="button" onClick={baixarPlanilha} disabled={!dados} className={`${botaoSecundario} disabled:cursor-not-allowed disabled:opacity-50`}>
              <Download aria-hidden="true" size={16} strokeWidth={2} />Baixar planilha
            </button>
            <button type="button" onClick={() => window.print()} disabled={!dados} className={`${botaoSecundario} disabled:cursor-not-allowed disabled:opacity-50`}>
              <Printer aria-hidden="true" size={16} strokeWidth={2} />Imprimir
            </button>
          </div>
        </fieldset>
        {escolha === 'personalizado' && (
          <form className="flex flex-wrap items-end gap-3 print:hidden" onSubmit={(event) => { event.preventDefault(); aplicarDatas(); }}>
            <div><label htmlFor="indicadores-de" className="mb-1.5 block text-sm font-medium">De</label>
              <input id="indicadores-de" type="date" value={datas.primeiro} onChange={(event) => setDatas({ ...datas, primeiro: event.target.value })} className={campoData} /></div>
            <div><label htmlFor="indicadores-ate" className="mb-1.5 block text-sm font-medium">Até</label>
              <input id="indicadores-ate" type="date" value={datas.ultimo} onChange={(event) => setDatas({ ...datas, ultimo: event.target.value })} className={campoData} /></div>
            <button type="submit" className="min-h-11 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Aplicar</button>
            {erroDatas && <p role="alert" className="flex w-full items-center gap-2 text-sm text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={18} strokeWidth={2} />{erroDatas}</p>}
          </form>
        )}
        <p aria-live="polite" className="flex items-center gap-2 text-xs text-muted">
          {carregando && <LoaderCircle aria-hidden="true" size={14} strokeWidth={2} className="motion-safe:animate-spin" />}
          {dados ? `Período de ${dataDoInstante(dados.meta.filtros.inicio)} a ${dataDoInstante(dados.meta.filtros.fim, true)} · consultado em ${formatarInstante(dados.meta.consultadoEm)}` : 'Carregando indicadores…'}
        </p>
      </div>

      {erro && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-[#ffb4a5]/25 bg-[#ffb4a5]/5 p-4 sm:flex-row sm:items-center">
          <p role="alert" className="flex flex-1 items-start gap-2 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>
          <button type="button" onClick={() => consultar()} className={botaoSecundario}>Tentar novamente</button>
        </div>
      )}

      {!dados && !erro && (
        <p role="status" className="mt-6 flex min-h-48 items-center justify-center gap-3 rounded-xl border border-[#2b353e] text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} strokeWidth={2} className="motion-safe:animate-spin" />Carregando indicadores…</p>
      )}

      {dados && resumo && (
        // Ao trocar o período, os números anteriores ficam visíveis e esmaecidos até a resposta chegar.
        <div aria-busy={carregando} className={`mt-6 space-y-6 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          {resumo.pendencias.length > 0 && (
            <section aria-labelledby="indicadores-atencao" className="rounded-xl border border-[#fab219]/30 bg-[#fab219]/5 p-4 sm:p-5">
              <h2 id="indicadores-atencao" className="flex items-center gap-2 text-sm font-semibold text-[#ffd77a]"><AlertTriangle aria-hidden="true" size={18} strokeWidth={2} />Atenção aos dados</h2>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-[#e6e9ec]">{resumo.pendencias.map((texto) => <li key={texto}>{texto}</li>)}</ul>
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Resumo rotulo="Peças boas na última etapa" valor={resumo.producaoPorUnidade.length ? resumo.producaoPorUnidade.map((p) => formatarQuantidade(p.quantidade, p.unidade)).join(' · ') : 'Nenhuma baixa'} detalhe="Baixas da última etapa de cada roteiro no período." />
            <Resumo rotulo="Ordens em andamento" valor={resumo.emAndamento} detalhe={resumo.emExecucao === 1 ? '1 em execução agora.' : `${resumo.emExecucao} em execução agora.`} />
            <Resumo rotulo="Tempo produtivo" valor={formatarDuracao(resumo.produtivoSegundos)} detalhe="Soma dos postos no período; execuções abertas ainda não entram." />
            <Resumo rotulo="Tempo em pausa" valor={formatarDuracao(resumo.pausaSegundos)} detalhe={resumo.maiorMotivoDePausa ? `Maior motivo: ${resumo.maiorMotivoDePausa}.` : 'Nenhuma pausa no período.'} />
          </div>

          <Secao id="indicadores-por-dia" titulo="Tempo por dia" tipo="periodo" descricao="Tempo produtivo e de pausa apontado em cada dia, com a linha do tempo padrão das peças que tiveram baixa no dia (quantidade da ordem vezes o tempo padrão). A comparação é aproximada: uma execução que passa de um dia para outro conta o tempo em cada dia, e o tempo padrão entra no dia da baixa.">
            {dados.porDia.length === 0 ? <Vazio>O período é longo demais para a série por dia.</Vazio> : (
              <div className="space-y-6">
                <GraficoPorDia dias={dados.porDia} />
                <details>
                  <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Ver em tabela, por dia</summary>
                  <div className="mt-3">
                    <Tabela legenda="Tempo por dia" minimo={560} cabecalho={[{ titulo: 'Dia' }, { titulo: 'Produtivo', direita: true }, { titulo: 'Pausa', direita: true }, { titulo: 'Baixas', direita: true }, { titulo: 'Tempo padrão das baixas', direita: true }]}>
                      {dados.porDia.map((d) => (
                        <tr key={d.data}>
                          <td className={`${celula} font-medium`}>{d.data.slice(8, 10)}/{d.data.slice(5, 7)}/{d.data.slice(0, 4)}</td>
                          <td className={numero}>{formatarDuracao(d.produtivoSegundos)}</td>
                          <td className={numero}>{formatarDuracao(d.pausaSegundos)}</td>
                          <td className={numero}>{d.baixas}</td>
                          <td className={numero}>{d.tempoPadraoDasBaixasSegundos === null ? 'Sem tempo padrão' : formatarDuracao(d.tempoPadraoDasBaixasSegundos)}</td>
                        </tr>
                      ))}
                    </Tabela>
                  </div>
                </details>
              </div>
            )}
          </Secao>

          <Secao id="indicadores-ordens" titulo="Posição das ordens" tipo="agora" descricao="Ordens com etapa sem baixa ou com baixa no período. A etapa atual é a primeira sem baixa; a sequência é só nominal.">
            {dados.ordens.length === 0 ? <Vazio>Nenhuma ordem em andamento ou com baixa no período.</Vazio> : (
              <Tabela legenda="Posição das ordens de produção" cabecalho={[{ titulo: 'Ordem' }, { titulo: 'Produto' }, { titulo: 'Plano' }, { titulo: 'Quantidade', direita: true }, { titulo: 'Etapas com baixa', direita: true }, { titulo: 'Situação' }, { titulo: 'Última baixa' }]}>
                {dados.ordens.map((ordem) => (
                  <tr key={ordem.ordemId}>
                    <td className={`${celula} font-medium`}>{ordem.numero}</td>
                    <td className={celula}>{ordem.produtoCodigo} <span className="text-muted">– {ordem.produtoNome}</span></td>
                    <td className={`${celula} text-muted`}>{ordem.planoCodigo}</td>
                    <td className={numero}>{formatarQuantidade(ordem.quantidade, ordem.unidade)}</td>
                    <td className={numero}>{ordem.etapasBaixadas} de {ordem.etapasTotal}{ordem.etapasInconsistentes > 0 && <span className="block text-xs text-[#ffd77a]">{ordem.etapasInconsistentes} com baixa inconsistente</span>}</td>
                    <td className={celula}>{situacaoDaOrdem(ordem)}</td>
                    <td className={`${celula} whitespace-nowrap text-muted`}>{formatarInstante(ordem.ultimaBaixaEm)}</td>
                  </tr>
                ))}
              </Tabela>
            )}
          </Secao>

          <Secao id="indicadores-qualidade" titulo="Qualidade na última etapa" tipo="periodo" descricao="Composição das baixas da última etapa de cada roteiro no período: peças boas, retrabalho e refugo. O índice de peças boas é boa dividido pelo total baixado.">
            {qualidade.length === 0 ? <Vazio>Nenhuma baixa da última etapa no período.</Vazio> : (
              <div className={`grid gap-6 ${qualidade.length > 1 ? 'lg:grid-cols-2' : ''}`}>
                {qualidade.map((q) => <GraficoQualidade key={q.unidade} qualidade={q} />)}
              </div>
            )}
          </Secao>

          <Secao id="indicadores-producao" titulo="Produção no período" tipo="periodo" descricao="Baixas por produto e etapa. Cada etapa informa o mesmo lote, então as etapas não são somadas entre si; a produção final é a da última etapa.">
            {dados.producao.length === 0 ? <Vazio>Nenhuma baixa no período.</Vazio> : (
              <Tabela legenda="Produção do período por produto e etapa" cabecalho={[{ titulo: 'Produto' }, { titulo: 'Etapa' }, { titulo: 'Ordens', direita: true }, { titulo: 'Boa', direita: true }, { titulo: 'Retrabalho', direita: true }, { titulo: 'Refugo', direita: true }]}>
                {dados.producao.map((item) => (
                  <tr key={item.produtoCodigo + item.etapaRoteiroId}>
                    <td className={`${celula} font-medium`}>{item.produtoCodigo}</td>
                    <td className={celula}>{item.ordem}. {item.operacaoNome}{item.ultimaEtapa && <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-xs text-muted">última etapa</span>}</td>
                    <td className={numero}>{item.ordensBaixadas}</td>
                    <td className={numero}>{formatarQuantidade(item.quantidadeBoa, item.unidade)}</td>
                    <td className={numero}>{formatarQuantidade(item.quantidadeRetrabalho, item.unidade)}</td>
                    <td className={numero}>{formatarQuantidade(item.quantidadeRefugo, item.unidade)}</td>
                  </tr>
                ))}
              </Tabela>
            )}
          </Secao>

          <Secao id="indicadores-tempos" titulo="Tempos por posto" tipo="periodo" descricao="Tempo das execuções em cada posto, recortado ao período. Execuções simultâneas no mesmo posto somam tempo; ausência de apontamento não significa posto parado.">
            {dados.tempos.length === 0 ? <Vazio>Nenhuma execução no período.</Vazio> : (
              <div className="space-y-6">
                <GraficoTemposPorPosto tempos={dados.tempos} />
                <details>
                  <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Ver em tabela, com as pausas por motivo</summary>
                  <div className="mt-3 space-y-4">
                    <Tabela legenda="Tempos por posto" cabecalho={[{ titulo: 'Posto' }, { titulo: 'Setor' }, { titulo: 'Produtivo', direita: true }, { titulo: 'Pausa', direita: true }, { titulo: 'Total', direita: true }, { titulo: 'Finalizadas', direita: true }, { titulo: 'Em aberto', direita: true }]}>
                      {dados.tempos.map((t) => (
                        <tr key={t.posto.id}>
                          <td className={`${celula} font-medium`}>{t.posto.codigo} <span className="text-muted">– {t.posto.nome}</span></td>
                          <td className={`${celula} text-muted`}>{t.posto.setorNome}</td>
                          <td className={numero}>{formatarDuracao(t.produtivoSegundos)}</td>
                          <td className={numero}>{formatarDuracao(t.pausaSegundos)}</td>
                          <td className={numero}>{formatarDuracao(t.totalSegundos)}</td>
                          <td className={numero}>{t.execucoesFinalizadas}</td>
                          <td className={numero}>{t.execucoesAbertas}</td>
                        </tr>
                      ))}
                    </Tabela>
                    {pausasDetalhadas.length > 0 && (
                      <Tabela legenda="Pausas por motivo em cada posto" minimo={480} cabecalho={[{ titulo: 'Posto' }, { titulo: 'Motivo' }, { titulo: 'Tempo', direita: true }, { titulo: 'Ocorrências', direita: true }]}>
                        {pausasDetalhadas.map((pausa) => (
                          <tr key={pausa.posto + (pausa.motivoNome ?? '')}>
                            <td className={`${celula} font-medium`}>{pausa.posto}</td>
                            <td className={celula}>{pausa.motivoNome ?? 'Sem motivo'}</td>
                            <td className={numero}>{formatarDuracao(pausa.segundos)}</td>
                            <td className={numero}>{pausa.ocorrencias}</td>
                          </tr>
                        ))}
                      </Tabela>
                    )}
                  </div>
                </details>
              </div>
            )}
          </Secao>

          <Secao id="indicadores-tempo-medio" titulo="Tempo por unidade e tempo padrão" tipo="periodo" descricao="Tempo produtivo das execuções com baixa no período dividido pelas peças boas, comparado com o tempo padrão. Inclui o tempo gasto em retrabalho e refugo.">
            {dados.tempoMedio.length === 0 ? <Vazio>Nenhuma baixa com tempo medido no período.</Vazio> : (
              <Tabela legenda="Tempo por unidade comparado ao tempo padrão" cabecalho={[{ titulo: 'Produto' }, { titulo: 'Etapa' }, { titulo: 'Execuções', direita: true }, { titulo: 'Tempo por unidade', direita: true }, { titulo: 'Tempo padrão', direita: true }, { titulo: '% do padrão', direita: true }, { titulo: 'Leitura' }]}>
                {dados.tempoMedio.map((item) => (
                  <tr key={item.produtoCodigo + item.etapaRoteiroId}>
                    <td className={`${celula} font-medium`}>{item.produtoCodigo}</td>
                    <td className={celula}>{item.operacaoNome}</td>
                    <td className={numero}>{item.execucoesConsideradas}</td>
                    <td className={numero}>{formatarSegundosPorUnidade(item.segundosPorUnidade, item.unidade)}</td>
                    <td className={numero}>{formatarSegundosPorUnidade(item.tempoPadraoSegundos, item.unidade)}</td>
                    <td className={numero}>{formatarPercentual(item.percentualDoPadrao)}</td>
                    <td className={`${celula} text-muted`}>{leituraDoPadrao(item)}</td>
                  </tr>
                ))}
              </Tabela>
            )}
          </Secao>

          <Secao id="indicadores-carga" titulo="Carga pendente" tipo="agora" descricao="Trabalho ainda sem baixa, estimado pela quantidade vezes o tempo padrão. Quando uma etapa pode ser feita em mais de um posto, a carga é dividida em partes iguais entre eles: é uma estimativa e não comprova gargalo.">
            {dados.cargaPorPosto.length === 0 && dados.cargaPendente.length === 0 ? <Vazio>Nenhum trabalho pendente.</Vazio> : (
              <div className="space-y-6">
                {dados.cargaPorPosto.length > 0 && <GraficoCargaPorPosto carga={dados.cargaPorPosto} />}
                <details>
                  <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Ver em tabela, por etapa</summary>
                  <div className="mt-3 space-y-4">
                    <Tabela legenda="Carga pendente por posto" minimo={480} cabecalho={[{ titulo: 'Posto' }, { titulo: 'Carga pendente', direita: true }, { titulo: '% da carga', direita: true }]}>
                      {dados.cargaPorPosto.map((c) => (
                        <tr key={c.posto.id}>
                          <td className={`${celula} font-medium`}>{c.posto.codigo} <span className="text-muted">– {c.posto.nome}</span></td>
                          <td className={numero}>{c.cargaPendenteSegundos === null ? 'Sem tempo padrão' : formatarDuracao(c.cargaPendenteSegundos)}</td>
                          <td className={numero}>{formatarPercentual(c.percentualDaCarga)}</td>
                        </tr>
                      ))}
                    </Tabela>
                    <Tabela legenda="Carga pendente por etapa" cabecalho={[{ titulo: 'Produto' }, { titulo: 'Etapa' }, { titulo: 'Ordens', direita: true }, { titulo: 'Quantidade', direita: true }, { titulo: 'Tempo padrão', direita: true }, { titulo: 'Carga', direita: true }, { titulo: 'Postos' }]}>
                      {dados.cargaPendente.map((c) => (
                        <tr key={c.produtoCodigo + c.etapaRoteiroId}>
                          <td className={`${celula} font-medium`}>{c.produtoCodigo}</td>
                          <td className={celula}>{c.ordem}. {c.operacaoNome}</td>
                          <td className={numero}>{c.ordensPendentes}</td>
                          <td className={numero}>{formatarQuantidade(c.quantidadePendente, c.unidade)}</td>
                          <td className={numero}>{formatarSegundosPorUnidade(c.tempoPadraoSegundos, c.unidade)}</td>
                          <td className={numero}>{c.cargaPendenteSegundos === null ? INDISPONIVEL : formatarDuracao(c.cargaPendenteSegundos)}</td>
                          <td className={`${celula} text-muted`}>{c.postosCompativeis.length ? c.postosCompativeis.map((p) => p.codigo).join(', ') : 'Nenhum posto ativo'}</td>
                        </tr>
                      ))}
                    </Tabela>
                  </div>
                </details>
              </div>
            )}
          </Secao>
        </div>
      )}
    </div>
  );
}
