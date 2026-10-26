import type { EventoDaExecucao, ExecucaoAberta } from '../domain/execucao.ts';
import { calcularTempos, derivarIntervalos, type EventoTempo } from '../../indicators/domain/tempos.ts';

// Tempo da execução aberta até agora, com a mesma regra dos indicadores: produtivo são os
// intervalos ativos e pausa são os intervalos pausados. O trecho em andamento termina "agora".
export function tempoDecorrido(eventos: readonly EventoDaExecucao[], status: ExecucaoAberta['status'], agoraMs: number) {
  const registrados: EventoTempo[] = eventos.map((evento) => ({ tipo: evento.tipo, instanteMs: Date.parse(evento.dataHora), motivoPausaId: null }));
  const ultimo = Math.max(...registrados.map((evento) => evento.instanteMs));
  // Relógio do terminal um pouco atrás do servidor não deve gerar tempo negativo.
  const fimMs = Math.max(agoraMs, ultimo);
  const fechamento: EventoTempo = { tipo: status === 'PAUSADA' ? 'RETOMADA' : 'FINALIZACAO', instanteMs: fimMs, motivoPausaId: null };
  const { intervalos } = derivarIntervalos([...registrados, fechamento]);
  const { produtivoSegundos, pausaSegundos } = calcularTempos(intervalos, { inicioMs: registrados[0]?.instanteMs ?? fimMs, fimMs: fimMs + 1 });
  return { produtivoSegundos, pausaSegundos };
}

export function formatarDuracao(totalSegundos: number): string {
  const s = Math.max(0, Math.floor(totalSegundos));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const segundos = s % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return horas > 0 ? `${horas}:${dois(minutos)}:${dois(segundos)}` : `${dois(minutos)}:${dois(segundos)}`;
}

// Lê a quantidade digitada aceitando vírgula ou ponto; vazio vale zero; undefined indica valor inválido.
export function lerQuantidade(texto: string): number | undefined {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return undefined;
  return Number(limpo);
}
