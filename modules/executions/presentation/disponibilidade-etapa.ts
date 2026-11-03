import type { Destino, EtapaDisponivel } from '../domain/execucao.ts';

// A mesma etapa de roteiro pode aparecer em várias ordens de produção.
// A indicação de etapa atual pertence à combinação ordem + etapa.
export function motivoIndisponibilidadeEtapa(
  ordemId: string,
  etapa: EtapaDisponivel,
  atual?: Pick<Destino, 'ordemId' | 'etapaId'>,
): string | null {
  if (etapa.baixada) return 'Já teve baixa';
  if (ordemId === atual?.ordemId && etapa.id === atual.etapaId) return 'Etapa atual';
  if (etapa.postos.length === 0) return 'Sem posto ativo';
  return null;
}
