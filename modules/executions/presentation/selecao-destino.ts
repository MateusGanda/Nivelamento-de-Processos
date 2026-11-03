import type { Destino, OrdemDisponivel } from '../domain/execucao.ts';
import { motivoIndisponibilidadeEtapa } from './disponibilidade-etapa.ts';

export type EntradaDestino = 'qr' | 'manual';
export type EstadoSelecaoDestino = {
  entrada: EntradaDestino; ordens: OrdemDisponivel[] | null; carregando: boolean; erro: string;
  ordemId: string; etapaId: string; postoId: string;
};
type ContextoAtual = Pick<Destino, 'ordemId' | 'etapaId'>;
export type AcaoSelecaoDestino =
  | { tipo: 'mudarEntrada'; entrada: EntradaDestino }
  | { tipo: 'iniciarConsulta' }
  | { tipo: 'receberOrdens'; ordens: OrdemDisponivel[]; ordemId?: string }
  | { tipo: 'falharConsulta'; mensagem: string }
  | { tipo: 'finalizarConsulta' }
  | { tipo: 'selecionarOrdem'; id: string }
  | { tipo: 'selecionarEtapa'; id: string; atual?: ContextoAtual }
  | { tipo: 'selecionarPosto'; id: string };

export const selecaoDestinoInicial: EstadoSelecaoDestino = {
  entrada: 'qr', ordens: null, carregando: false, erro: '', ordemId: '', etapaId: '', postoId: '',
};

export function reduzirSelecaoDestino(estado: EstadoSelecaoDestino, acao: AcaoSelecaoDestino): EstadoSelecaoDestino {
  switch (acao.tipo) {
    case 'mudarEntrada': return { ...selecaoDestinoInicial, entrada: acao.entrada };
    case 'iniciarConsulta': return { ...estado, ordens: null, ordemId: '', etapaId: '', postoId: '', erro: '', carregando: true };
    case 'receberOrdens': return {
      ...estado, ordens: acao.ordens, erro: '', etapaId: '', postoId: '',
      ordemId: acao.ordens.find((ordem) => ordem.id === acao.ordemId)?.id ?? '',
    };
    case 'falharConsulta': return { ...estado, ordens: null, ordemId: '', etapaId: '', postoId: '', erro: acao.mensagem };
    case 'finalizarConsulta': return { ...estado, carregando: false };
    case 'selecionarOrdem': {
      if (estado.carregando || !estado.ordens?.some((ordem) => ordem.id === acao.id)) return estado;
      return { ...estado, ordemId: acao.id, etapaId: '', postoId: '' };
    }
    case 'selecionarEtapa': {
      const ordem = estado.ordens?.find((item) => item.id === estado.ordemId);
      const etapa = ordem?.etapas.find((item) => item.id === acao.id);
      if (estado.carregando || !ordem || !etapa || motivoIndisponibilidadeEtapa(ordem.id, etapa, acao.atual)) return estado;
      return { ...estado, etapaId: etapa.id, postoId: etapa.postos.length === 1 ? etapa.postos[0].id : '' };
    }
    case 'selecionarPosto': {
      const etapa = estado.ordens?.find((item) => item.id === estado.ordemId)?.etapas.find((item) => item.id === estado.etapaId);
      if (estado.carregando || !etapa?.postos.some((posto) => posto.id === acao.id)) return estado;
      return { ...estado, postoId: acao.id };
    }
  }
}

export function destinoSelecionado(estado: EstadoSelecaoDestino, atual?: ContextoAtual, ocupado = false): Destino | null {
  if (ocupado || estado.carregando || estado.erro) return null;
  const ordem = estado.ordens?.find((item) => item.id === estado.ordemId);
  const etapa = ordem?.etapas.find((item) => item.id === estado.etapaId);
  if (!ordem || !etapa || motivoIndisponibilidadeEtapa(ordem.id, etapa, atual) || !etapa.postos.some((posto) => posto.id === estado.postoId)) return null;
  return { ordemId: ordem.id, etapaId: etapa.id, postoId: estado.postoId };
}

export function filtrarOrdensManuais(ordens: OrdemDisponivel[] | null, busca: string): OrdemDisponivel[] {
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
  const termo = normalizar(busca.trim());
  return (ordens ?? []).filter((ordem) => !termo || [ordem.numero, ordem.produto.codigo, ordem.produto.nome].some((campo) => normalizar(campo).includes(termo)));
}
