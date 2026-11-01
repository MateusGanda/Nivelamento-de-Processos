import type { CargaDoPosto, TemposDoPosto } from '../../application/indicadores';
import { formatarDuracao, formatarPercentual } from '../formatacao';

// Cores validadas contra a superfície dos cartões (#171e23) para daltonismo e contraste.
// O texto nunca usa essas cores: a identidade vem da marca ao lado.
export const COR_PRODUTIVO = '#3987e5';
export const COR_PAUSA = '#d95926';

// Valor diferente de zero sempre aparece, mesmo muito menor que o maior.
const largura = (valor: number, maximo: number) => (valor <= 0 || maximo <= 0 ? '0%' : `max(3px, ${(valor / maximo) * 100}%)`);

function Dica({ id, linhas }: { id: string; linhas: { valor: string; rotulo: string; cor?: string }[] }) {
  return (
    <div id={id} role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden min-w-48 rounded-lg border border-white/10 bg-[#0f1418] px-3 py-2 text-xs shadow-lg group-hover:block group-focus:block">
      {linhas.map((linha) => (
        <p key={linha.rotulo} className="flex items-center gap-2 py-0.5">
          {linha.cor && <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: linha.cor }} />}
          <strong className="font-semibold text-foreground">{linha.valor}</strong>
          <span className="text-muted">{linha.rotulo}</span>
        </p>
      ))}
    </div>
  );
}

function Legenda({ itens }: { itens: { cor: string; rotulo: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted" aria-label="Legenda">
      {itens.map((item) => (
        <li key={item.rotulo} className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.cor }} />{item.rotulo}</li>
      ))}
    </ul>
  );
}

function RotuloPosto({ codigo, nome }: { codigo: string; nome: string }) {
  return <span className="min-w-0 text-sm"><span className="block font-medium">{codigo}</span><span className="block truncate text-xs text-muted">{nome}</span></span>;
}

export function GraficoTemposPorPosto({ tempos }: { tempos: TemposDoPosto[] }) {
  const maximo = Math.max(0, ...tempos.map((t) => t.totalSegundos));
  return (
    <div className="space-y-4">
      <Legenda itens={[{ cor: COR_PRODUTIVO, rotulo: 'Tempo produtivo' }, { cor: COR_PAUSA, rotulo: 'Tempo em pausa' }]} />
      <ul className="space-y-3">
        {tempos.map((t) => {
          const dica = `dica-tempo-${t.posto.id}`;
          return (
            <li key={t.posto.id} tabIndex={0} aria-describedby={dica}
              aria-label={`${t.posto.codigo}: ${formatarDuracao(t.produtivoSegundos)} produtivo, ${formatarDuracao(t.pausaSegundos)} em pausa`}
              className="group relative grid grid-cols-1 items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent sm:grid-cols-[10rem_1fr] sm:gap-3">
              <RotuloPosto codigo={t.posto.codigo} nome={t.posto.nome} />
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-4 min-w-0 flex-1 items-center gap-[2px]">
                  <span className="h-full" style={{ width: largura(t.produtivoSegundos, maximo), backgroundColor: COR_PRODUTIVO, borderRadius: t.pausaSegundos > 0 ? 0 : '0 4px 4px 0' }} />
                  {t.pausaSegundos > 0 && <span className="h-full" style={{ width: largura(t.pausaSegundos, maximo), backgroundColor: COR_PAUSA, borderRadius: '0 4px 4px 0' }} />}
                </div>
                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-[#c1c8cf]">{formatarDuracao(t.totalSegundos)}</span>
              </div>
              <Dica id={dica} linhas={[
                { valor: formatarDuracao(t.produtivoSegundos), rotulo: 'produtivo', cor: COR_PRODUTIVO },
                { valor: formatarDuracao(t.pausaSegundos), rotulo: 'em pausa', cor: COR_PAUSA },
                { valor: String(t.execucoesFinalizadas), rotulo: t.execucoesFinalizadas === 1 ? 'execução finalizada' : 'execuções finalizadas' },
                ...(t.execucoesAbertas > 0 ? [{ valor: String(t.execucoesAbertas), rotulo: 'em aberto, ainda fora dos totais' }] : []),
              ]} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GraficoCargaPorPosto({ carga }: { carga: CargaDoPosto[] }) {
  const maximo = Math.max(0, ...carga.map((c) => c.cargaPendenteSegundos ?? 0));
  return (
    <ul className="space-y-3">
      {carga.map((c) => {
        const dica = `dica-carga-${c.posto.id}`;
        const valor = c.cargaPendenteSegundos === null ? 'sem tempo padrão' : `${formatarDuracao(c.cargaPendenteSegundos)} · ${formatarPercentual(c.percentualDaCarga)}`;
        return (
          <li key={c.posto.id} tabIndex={0} aria-describedby={dica} aria-label={`${c.posto.codigo}: ${valor}`}
            className="group relative grid grid-cols-1 items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent sm:grid-cols-[10rem_1fr] sm:gap-3">
            <RotuloPosto codigo={c.posto.codigo} nome={c.posto.nome} />
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-4 min-w-0 flex-1 items-center">
                {c.cargaPendenteSegundos !== null && <span className="h-full" style={{ width: largura(c.cargaPendenteSegundos, maximo), backgroundColor: COR_PRODUTIVO, borderRadius: '0 4px 4px 0' }} />}
              </div>
              <span className="w-32 shrink-0 text-right text-xs tabular-nums text-[#c1c8cf]">{valor}</span>
            </div>
            <Dica id={dica} linhas={c.cargaPendenteSegundos === null
              ? [{ valor: 'Indisponível', rotulo: 'falta tempo padrão em alguma etapa' }]
              : [{ valor: formatarDuracao(c.cargaPendenteSegundos), rotulo: 'de carga pendente' }, { valor: formatarPercentual(c.percentualDaCarga), rotulo: 'da carga de todos os postos' }]} />
          </li>
        );
      })}
    </ul>
  );
}
