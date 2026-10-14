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
  id: string;
  ordemProducaoId: string;
  etapaRoteiroId: string;
  postoId: string;
  eventos: readonly EventoTempo[];
};

/** Tempo padrão em segundos por unidade produzida (ProdutoEtapa.tempoPadrao). */
export type TempoPadraoRegistrado = { produtoId: string; etapaRoteiroId: string; tempoPadraoSegundos: number };

/** Posto com o nome do seu setor. */
export type PostoRegistrado = { id: string; codigo: string; nome: string; ativo: boolean; setorNome: string };

/** Posto em que a etapa pode ser feita (EtapaPosto). */
export type PostoDaEtapa = { etapaRoteiroId: string; postoId: string };

export type MotivoPausaRegistrado = { id: string; nome: string };

export type RegistrosDeProducao = {
  ordens: readonly OrdemRegistrada[];
  etapas: readonly EtapaRegistrada[];
  execucoes: readonly ExecucaoRegistrada[];
  temposPadrao: readonly TempoPadraoRegistrado[];
  postos: readonly PostoRegistrado[];
  postosDasEtapas: readonly PostoDaEtapa[];
  motivosPausa: readonly MotivoPausaRegistrado[];
};

export interface IndicadoresRepository {
  carregarRegistrosDeProducao(): Promise<RegistrosDeProducao>;
}
