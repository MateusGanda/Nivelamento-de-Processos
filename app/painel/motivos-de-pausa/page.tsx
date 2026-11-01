import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { PauseReasonsScreen } from '@/modules/pause-reasons/presentation/components/pause-reasons-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Motivos de Pausa' };

export default async function MotivosDePausaPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <PauseReasonsScreen />;
}
