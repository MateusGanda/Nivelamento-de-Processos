import { Box, Building2, CalendarDays, ChartColumnIncreasing, ClipboardList, Clock3, Cog, Factory, House, Play, Route, UsersRound, type LucideIcon } from 'lucide-react';
import type { IconePainel } from '../painel-navigation';

const icones: Record<IconePainel, LucideIcon> = {
  inicio: House,
  produtos: Box,
  operacoes: Cog,
  setores: Building2,
  postos: Factory,
  operadores: UsersRound,
  pausas: Clock3,
  roteiros: Route,
  planos: CalendarDays,
  ordens: ClipboardList,
  execucoes: Play,
  indicadores: ChartColumnIncreasing,
};

export function PainelIcon({ icone, size = 22, className }: { icone: IconePainel; size?: number; className?: string }) {
  const Icone = icones[icone];
  return <Icone aria-hidden="true" size={size} strokeWidth={2} className={className} />;
}
