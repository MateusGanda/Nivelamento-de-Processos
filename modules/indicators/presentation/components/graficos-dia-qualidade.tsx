import type { DiaDoPeriodo } from '../../application/indicadores';
import { formatarDuracao, formatarPercentual, formatarQuantidade, passoDoEixo } from '../formatacao';
import { COR_PAUSA, COR_PRODUTIVO } from './indicadores-graficos';

// Linha de referência em tom neutro, para não competir com as colunas.
const COR_PADRAO = '#e6e9ec';
const SUPERFICIE = '#171e23';
const ALTURA_PX = 224;
export const MAXIMO_DE_COLUNAS = 62;

const rotuloDoEixo = (s: number) => (s === 0 ? '0' : s < 3600 ? `${s / 60} min` : `${s / 3600} h`);
const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

function LinhaDaDica({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <p className="flex items-center gap-2 py-0.5">
      {cor && <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: cor }} />}
      <strong className="font-semibold text-foreground">{valor}</strong><span className="text-muted">{rotulo}</span>
    </p>
  );
}

/** Colunas por dia (produtivo + pausa) e a linha do tempo padrão das peças baixadas, na mesma escala. */
export function GraficoPorDia({ dias }: { dias: DiaDoPeriodo[] }) {
  if (dias.length > MAXIMO_DE_COLUNAS) {
    return <p className="py-6 text-center text-sm text-muted">Escolha um período de até {MAXIMO_DE_COLUNAS} dias para ver o gráfico por dia. A tabela abaixo continua com todos os dias.</p>;
  }
  const maior = Math.max(60, ...dias.map((d) => Math.max(d.produtivoSegundos + d.pausaSegundos, d.tempoPadraoDasBaixasSegundos ?? 0)));
  const passo = passoDoEixo(maior);
  const topo = Math.ceil(maior / passo) * passo;
  const marcas = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const n = dias.length;
  // Menos datas no eixo em tela estreita, para os rótulos não se sobreporem.
  const cadaRotuloTela = Math.max(1, Math.ceil(n / 12));
  const cadaRotuloCelular = Math.max(1, Math.ceil(n / 5));
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const altura = (segundos: number) => (segundos / topo) * ALTURA_PX;
  // A linha se interrompe nos dias em que o tempo padrão é indisponível.
  const trechos: { x: number; y: number }[][] = [[]];
  dias.forEach((d, i) => {
    if (d.tempoPadraoDasBaixasSegundos === null) trechos.push([]);
    else trechos[trechos.length - 1].push({ x: x(i), y: 100 - (d.tempoPadraoDasBaixasSegundos / topo) * 100 });
  });

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-4 text-xs text-muted" aria-label="Legenda">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_PRODUTIVO }} />Tempo produtivo</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_PAUSA }} />Tempo em pausa</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: COR_PADRAO }} />Tempo padrão das peças baixadas</li>
      </ul>
      <div className="grid grid-cols-[3.25rem_1fr] gap-2">
        <div className="relative text-right text-[11px] tabular-nums text-muted" style={{ height: ALTURA_PX }} aria-hidden="true">
          {marcas.map((m) => <span key={m} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (m / topo) * 100}%` }}>{rotuloDoEixo(m)}</span>)}
        </div>
        <div className="min-w-0">
          <div className="relative" style={{ height: ALTURA_PX }}>
            {marcas.map((m) => <div key={m} aria-hidden="true" className="absolute inset-x-0 h-px bg-white/10" style={{ top: `${100 - (m / topo) * 100}%` }} />)}
            <ul className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
              {dias.map((d, i) => {
                const dica = `dica-dia-${d.data}`;
                const padrao = d.tempoPadraoDasBaixasSegundos;
                return (
                  <li key={d.data} tabIndex={0} aria-describedby={dica}
                    aria-label={`${diaMes(d.data)}: ${formatarDuracao(d.produtivoSegundos)} produtivo, ${formatarDuracao(d.pausaSegundos)} em pausa, tempo padrão das baixas ${padrao === null ? 'indisponível' : formatarDuracao(padrao)}`}
                    className="group relative flex h-full flex-col items-center justify-end rounded-sm outline-none hover:bg-white/[0.03] focus:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-accent">
                    <div className="flex w-3/5 max-w-6 flex-col items-stretch gap-[2px]">
                      {d.pausaSegundos > 0 && <span style={{ height: `max(2px, ${altura(d.pausaSegundos)}px)`, backgroundColor: COR_PAUSA, borderRadius: '4px 4px 0 0' }} />}
                      {d.produtivoSegundos > 0 && <span style={{ height: `max(2px, ${altura(d.produtivoSegundos)}px)`, backgroundColor: COR_PRODUTIVO, borderRadius: d.pausaSegundos > 0 ? 0 : '4px 4px 0 0' }} />}
                    </div>
                    <div id={dica} role="tooltip" className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden min-w-56 rounded-lg border border-white/10 bg-[#0f1418] px-3 py-2 text-xs shadow-lg group-hover:block group-focus:block ${i < n / 2 ? 'left-0' : 'right-0'}`}>
                      <p className="mb-1 font-semibold text-foreground">{diaMes(d.data)}</p>
                      <LinhaDaDica valor={formatarDuracao(d.produtivoSegundos)} rotulo="produtivo" cor={COR_PRODUTIVO} />
                      <LinhaDaDica valor={formatarDuracao(d.pausaSegundos)} rotulo="em pausa" cor={COR_PAUSA} />
                      <LinhaDaDica valor={padrao === null ? 'Indisponível' : formatarDuracao(padrao)} rotulo="tempo padrão das baixas" cor={COR_PADRAO} />
                      <LinhaDaDica valor={String(d.baixas)} rotulo={d.baixas === 1 ? 'baixa no dia' : 'baixas no dia'} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              {trechos.filter((t) => t.length > 1).map((t, k) => (
                <polyline key={k} points={t.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={COR_PADRAO} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            {/* Marcador só nos dias com baixa; nos outros a linha passa pelo zero medido. */}
            {dias.map((d, i) => d.tempoPadraoDasBaixasSegundos === null || d.baixas === 0 ? null : (
              <span key={d.data} aria-hidden="true" className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full"
                style={{ left: `${x(i)}%`, bottom: `${(d.tempoPadraoDasBaixasSegundos / topo) * 100}%`, backgroundColor: COR_PADRAO, boxShadow: `0 0 0 2px ${SUPERFICIE}` }} />
            ))}
          </div>
          <div className="mt-2 grid text-center text-[11px] tabular-nums text-muted" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {dias.map((d, i) => {
              const tela = i % cadaRotuloTela === 0;
              const celular = i % cadaRotuloCelular === 0;
              if (!tela && !celular) return <span key={d.data} />;
              return <span key={d.data} className={`whitespace-nowrap ${tela && celular ? '' : tela ? 'hidden sm:inline' : 'sm:hidden'}`}>{diaMes(d.data)}</span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Validadas juntas para daltonismo: as três fatias ficam vizinhas no anel.
const COR_BOA = '#199e70';
const COR_RETRABALHO = '#c98500';
const COR_REFUGO = '#9085e9';
export type Qualidade = { unidade: string; boa: number; retrabalho: number; refugo: number };

/** Anel com a composição da última etapa: boa, retrabalho e refugo. */
export function GraficoQualidade({ qualidade }: { qualidade: Qualidade }) {
  const total = qualidade.boa + qualidade.retrabalho + qualidade.refugo;
  const fatias = [
    { rotulo: 'Boa', valor: qualidade.boa, cor: COR_BOA },
    { rotulo: 'Retrabalho', valor: qualidade.retrabalho, cor: COR_RETRABALHO },
    { rotulo: 'Refugo', valor: qualidade.refugo, cor: COR_REFUGO },
  ];
  const raio = 62;
  const circunferencia = 2 * Math.PI * raio;
  const visiveis = fatias.filter((f) => f.valor > 0);
  // 2px de superfície entre as fatias, quando há mais de uma.
  const folga = visiveis.length > 1 ? 2 : 0;
  const percentual = (valor: number) => (total > 0 ? (valor / total) * 100 : 0);
  const inicios = visiveis.map((_, i) => visiveis.slice(0, i).reduce((soma, f) => soma + (f.valor / total) * circunferencia, 0));
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg width="168" height="168" viewBox="0 0 168 168" role="img" className="shrink-0"
        aria-label={`${formatarPercentual(percentual(qualidade.boa))} de peças boas em ${formatarQuantidade(total, qualidade.unidade)}`}>
        <circle cx="84" cy="84" r={raio} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
        {visiveis.map((f, i) => (
          <circle key={f.rotulo} cx="84" cy="84" r={raio} fill="none" stroke={f.cor} strokeWidth="18" transform="rotate(-90 84 84)"
            strokeDasharray={`${Math.max((f.valor / total) * circunferencia - folga, 0.5)} ${circunferencia}`} strokeDashoffset={-inicios[i]} />
        ))}
        <text x="84" y="82" textAnchor="middle" fontSize="22" fontWeight="600" fill="#f5f6f7">{formatarPercentual(percentual(qualidade.boa))}</text>
        <text x="84" y="102" textAnchor="middle" fontSize="11" fill="#a7b0ba">peças boas</text>
      </svg>
      <ul className="w-full min-w-0 space-y-2 text-sm">
        {fatias.map((f) => (
          <li key={f.rotulo} className="flex items-center gap-3">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: f.cor }} />
            <span className="flex-1 text-muted">{f.rotulo}</span>
            <strong className="font-semibold tabular-nums">{formatarQuantidade(f.valor, qualidade.unidade)}</strong>
            <span className="w-14 text-right text-xs tabular-nums text-muted">{formatarPercentual(percentual(f.valor))}</span>
          </li>
        ))}
        <li className="flex items-center gap-3 border-t border-white/10 pt-2 text-xs text-muted">
          <span className="flex-1">Total na última etapa</span><span className="tabular-nums">{formatarQuantidade(total, qualidade.unidade)}</span>
        </li>
      </ul>
    </div>
  );
}
