// Registros fictícios usados pelos testes do caso de uso de indicadores.
import type { ExecucaoRegistrada, IndicadoresRepository, OrdemRegistrada, RegistrosDeProducao } from '../../../../modules/indicators/application/contracts.ts';
import type { EventoTempo } from '../../../../modules/indicators/domain/tempos.ts';

export const instante = (dia: string, hora: string) => Date.parse(`2026-10-${dia}T${hora}:00-03:00`);
export const evento = (tipo: EventoTempo['tipo'], dia: string, hora: string, motivoPausaId: string | null = null): EventoTempo => ({ tipo, instanteMs: instante(dia, hora), motivoPausaId });
export const DIA_06 = { inicioMs: instante('06', '08:00'), fimMs: instante('06', '18:00') };
export const semQuantidades = { quantidadeBoa: null, quantidadeRetrabalho: null, quantidadeRefugo: null };

export const ordem = (numero: string, quantidade: number, unidade = 'un'): OrdemRegistrada => ({
  id: `ordem-${numero}`, numero, quantidade, unidade, roteiroId: 'roteiro-1',
  produtoId: 'produto-a', produtoCodigo: 'P-100', produtoNome: 'Produto A', planoCodigo: 'PL-01',
});

// Posto em que cada etapa é apontada nos registros fictícios.
const postoDaEtapa: Record<string, string> = { 'etapa-1': 'posto-1', 'etapa-2': 'posto-2', 'etapa-3': 'posto-4' };

/** Execução finalizada por baixa, iniciada às 08:00 do dia e finalizada na hora indicada. */
export const baixa = (numero: string, etapa: string, boa: number, retrabalho: number, refugo: number, dia: string, hora: string): ExecucaoRegistrada => ({
  id: `exec-${numero}-${etapa}`, ordemProducaoId: `ordem-${numero}`, etapaRoteiroId: etapa, postoId: postoDaEtapa[etapa], tipoFinalizacao: 'BAIXA',
  quantidadeBoa: boa, quantidadeRetrabalho: retrabalho, quantidadeRefugo: refugo,
  eventos: [evento('INICIO', dia, '08:00'), evento('FINALIZACAO', dia, hora)],
});

// Roteiro com três etapas. A terceira não tem tempo padrão nem posto ligado a ela.
export const base = (): RegistrosDeProducao => ({
  ordens: [ordem('0002', 24), ordem('0001', 40), ordem('0003', 10), ordem('0004', 12.5)],
  etapas: [
    { id: 'etapa-2', roteiroId: 'roteiro-1', ordem: 2, operacaoNome: 'Montagem' },
    { id: 'etapa-1', roteiroId: 'roteiro-1', ordem: 1, operacaoNome: 'Corte' },
    { id: 'etapa-3', roteiroId: 'roteiro-1', ordem: 3, operacaoNome: 'Acabamento' },
  ],
  execucoes: [
    // 0001: corte baixado (08:00–08:30 no P01); na montagem, uma troca de operação
    // (09:00–09:20 no P02) e uma execução aberta no P03, com uma pausa de 10 min.
    baixa('0001', 'etapa-1', 38, 1, 1, '06', '08:30'),
    { id: 'exec-0001-troca', ordemProducaoId: 'ordem-0001', etapaRoteiroId: 'etapa-2', postoId: 'posto-2', tipoFinalizacao: 'TROCA_OPERACAO', ...semQuantidades,
      eventos: [evento('INICIO', '06', '09:00'), evento('FINALIZACAO', '06', '09:20')] },
    { id: 'exec-0001-aberta', ordemProducaoId: 'ordem-0001', etapaRoteiroId: 'etapa-2', postoId: 'posto-3', tipoFinalizacao: null, ...semQuantidades,
      eventos: [evento('INICIO', '06', '10:00'), evento('PAUSA', '06', '10:30', 'motivo-falta'), evento('RETOMADA', '06', '10:40')] },
    // 0003: as três etapas baixadas no dia 05.
    baixa('0003', 'etapa-1', 10, 0, 0, '05', '09:00'),
    baixa('0003', 'etapa-2', 10, 0, 0, '05', '11:00'),
    baixa('0003', 'etapa-3', 9, 1, 0, '05', '15:00'),
    // 0004: baixa com soma 12, diferente da quantidade da ordem (12,5), 08:00–09:00 no P01.
    baixa('0004', 'etapa-1', 10, 1, 1, '06', '09:00'),
  ],
  temposPadrao: [
    { produtoId: 'produto-a', etapaRoteiroId: 'etapa-1', tempoPadraoSegundos: 60 },
    { produtoId: 'produto-a', etapaRoteiroId: 'etapa-2', tempoPadraoSegundos: 100 },
  ],
  postos: [
    { id: 'posto-1', codigo: 'P01', nome: 'Corte 1', ativo: true, setorNome: 'Setor A' },
    { id: 'posto-2', codigo: 'P02', nome: 'Montagem 1', ativo: true, setorNome: 'Setor B' },
    { id: 'posto-3', codigo: 'P03', nome: 'Montagem 2', ativo: true, setorNome: 'Setor B' },
    { id: 'posto-4', codigo: 'P04', nome: 'Acabamento 1', ativo: true, setorNome: 'Setor C' },
  ],
  postosDasEtapas: [
    { etapaRoteiroId: 'etapa-1', postoId: 'posto-1' },
    { etapaRoteiroId: 'etapa-2', postoId: 'posto-3' },
    { etapaRoteiroId: 'etapa-2', postoId: 'posto-2' },
  ],
  motivosPausa: [{ id: 'motivo-falta', nome: 'Falta de material' }],
});

export class RepositorioEmMemoria implements IndicadoresRepository {
  leituras = 0;
  private readonly dados: RegistrosDeProducao;
  constructor(dados: RegistrosDeProducao) { this.dados = dados; }
  async carregarRegistrosDeProducao() { this.leituras += 1; return this.dados; }
}
