import type { ExecucaoDaEtapa } from '../domain/producao.ts';
import type { EventoTempo } from '../domain/tempos.ts';

/** Registros de produção como a consulta de indicadores precisa deles. A conversão
 * dos valores do banco (texto para número, data para milissegundos Unix) é da
 * infraestrutura; aqui as quantidades e o tempo padrão já são números.
 */
export type OrdemRegistrada = {
  id: string;
  numero: string;
  quantidade: number;
  unidade: string;
  roteiroId: string;
  produtoId: string;
  produtoCodigo: string;
  produtoNome: string;
  planoCodigo: string;
};

export type EtapaRegistrada = { id: string; roteiroId: string; ordem: number; operacaoNome: string };

export type ExecucaoRegistrada = ExecucaoDaEtapa & {
  ordemProducaoId: string;
  etapaRoteiroId: string;
  eventos: readonly EventoTempo[];
};

/** Tempo padrão em segundos por unidade produzida (ProdutoEtapa.tempoPadrao). */
export type TempoPadraoRegistrado = { produtoId: string; etapaRoteiroId: string; tempoPadraoSegundos: number };

/** Posto em que a etapa pode ser feita (EtapaPosto), com a situação do posto (Posto.ativo). */
export type PostoDaEtapa = { etapaRoteiroId: string; postoId: string; codigo: string; nome: string; ativo: boolean };

export type RegistrosDeProducao = {
  ordens: readonly OrdemRegistrada[];
  etapas: readonly EtapaRegistrada[];
  execucoes: readonly ExecucaoRegistrada[];
  temposPadrao: readonly TempoPadraoRegistrado[];
  postosDasEtapas: readonly PostoDaEtapa[];
};

export interface IndicadoresRepository {
  carregarRegistrosDeProducao(): Promise<RegistrosDeProducao>;
}
