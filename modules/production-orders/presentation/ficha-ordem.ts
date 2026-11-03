import type { Ordem } from '../domain/ordem.ts';
import { ehIdentificadorValido } from '../domain/ordem.ts';
import { codigoQrDaOrdem } from '../domain/identificacao-ordem.ts';
import { listarOrdens } from './api-client.ts';
import { buscarRoteiro } from '../../routings/presentation/api-client.ts';
import { gerarQrPng } from '../../../shared/presentation/qr-code.ts';

export type EtapaDaFicha = { id: string; ordem: number; operacao: string };
export type FichaOrdem = { ordem: Ordem; etapas: EtapaDaFicha[]; codigoQr: string; qrPng: string; nomeArquivo: string };
export class ErroFichaOrdem extends Error {}

const incompativel = () => new ErroFichaOrdem('Os dados da ordem ou do roteiro estão incompletos ou incompatíveis. Atualize e tente novamente.');

export async function prepararFichaOrdem(
  id: string,
  signal: AbortSignal,
  gerarQr: (conteudo: string) => Promise<string> = gerarQrPng,
): Promise<FichaOrdem> {
  signal.throwIfAborted();
  if (!ehIdentificadorValido(id)) throw new ErroFichaOrdem('Ordem de produção inválida. Atualize a listagem.');
  const ordens = await listarOrdens(signal);
  signal.throwIfAborted();
  const ordem = ordens.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!ordem) throw new ErroFichaOrdem('A ordem não está mais disponível. Atualize a listagem.');
  if (!ordem.numero.trim() || !ordem.produto.codigo.trim() || !ordem.produto.nome.trim() ||
    !ordem.plano.codigo.trim() || !ordem.unidade.trim() || !Number.isFinite(ordem.quantidade) || ordem.quantidade <= 0 ||
    !ehIdentificadorValido(ordem.roteiro.id) || !Number.isInteger(ordem.roteiro.versao) || ordem.roteiro.versao <= 0) throw incompativel();

  // Sempre a versão gravada na ordem, inclusive se já houver outra versão vigente.
  const roteiro = await buscarRoteiro(ordem.roteiro.id, signal);
  signal.throwIfAborted();
  if (roteiro.id.toLowerCase() !== ordem.roteiro.id.toLowerCase() || roteiro.versao !== ordem.roteiro.versao ||
    !roteiro.nome.trim() || roteiro.etapas.length === 0 || roteiro.quantidadeEtapas !== roteiro.etapas.length) throw incompativel();

  const ids = new Set<string>();
  const sequencias = new Set<number>();
  const etapas = roteiro.etapas.map((etapa) => {
    const etapaId = etapa.id.toLowerCase();
    if (!ehIdentificadorValido(etapa.id) || ids.has(etapaId) || !Number.isInteger(etapa.ordem) || etapa.ordem <= 0 ||
      sequencias.has(etapa.ordem) || !etapa.operacao.nome.trim()) throw incompativel();
    ids.add(etapaId); sequencias.add(etapa.ordem);
    return { id: etapa.id, ordem: etapa.ordem, operacao: etapa.operacao.nome };
  }).sort((a, b) => a.ordem - b.ordem);

  const codigoQr = codigoQrDaOrdem(ordem.id);
  let qrPng: string;
  try { qrPng = await gerarQr(codigoQr); }
  catch {
    signal.throwIfAborted();
    throw new ErroFichaOrdem('Não foi possível gerar o QR Code da ordem. Tente novamente.');
  }
  signal.throwIfAborted();
  return {
    ordem: { ...ordem, roteiro: { ...ordem.roteiro, nome: roteiro.nome } }, etapas, codigoQr, qrPng,
    nomeArquivo: `qr-ordem-${ordem.id.toLowerCase()}.png`,
  };
}
