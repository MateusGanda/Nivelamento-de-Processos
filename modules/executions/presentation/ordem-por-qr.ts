import { idDaOrdemNoQr } from '../../production-orders/domain/identificacao-ordem.ts';
import { listarOrdensDisponiveis } from './api-client.ts';

export class ErroLeituraOrdem extends Error {}

export async function consultarOrdemPorQr(conteudo: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const id = idDaOrdemNoQr(conteudo);
  if (!id) throw new ErroLeituraOrdem('Leia o QR Code da ficha da ordem. Para buscar pelo número ou produto, use Pesquisar ordem manualmente.');
  const ordens = await listarOrdensDisponiveis(signal);
  signal.throwIfAborted();
  const ordem = ordens.find((item) => item.id.toLowerCase() === id);
  if (!ordem) throw new ErroLeituraOrdem('Esta ordem não foi encontrada entre as ordens disponíveis. Leia outra ficha ou pesquise manualmente.');
  return { ordens, ordemId: ordem.id };
}
