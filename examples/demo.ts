import { calcularTempos, calcularCarga, calcularTempoMedioPorPar, calcularProducao } from '../src/indicadores.ts';
const ms = (h: string) => Date.parse(`2026-09-29T${h}:00-03:00`);
console.log('DEMONSTRAÇÃO — DADOS FICTÍCIOS. Sem banco, API ou apontamento real.');
console.log(JSON.stringify({
  tempos: calcularTempos([
    { inicioMs: ms('08:00'), fimMs: ms('08:40'), categoria: 'PRODUTIVO' },
    { inicioMs: ms('08:40'), fimMs: ms('08:50'), categoria: 'INTERRUPCAO' },
    { inicioMs: ms('08:50'), fimMs: ms('09:30'), categoria: 'PRODUTIVO' },
  ], [{ inicioMs: ms('08:00'), fimMs: ms('10:00') }]),
  mediaSegundosPorPar: calcularTempoMedioPorPar([{ produtivoSegundos: 4800, paresBons: 40 }]),
  producao: calcularProducao(100, 40),
  carga: calcularCarga([{ quantidadePlanejada: 240, tempoReferenciaSegundosPorPar: 120 }], 25200),
}, null, 2));
