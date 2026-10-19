import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { WorkstationsScreen } from '@/modules/workstations/presentation/components/workstations-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Postos' };

export default async function PostosPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <WorkstationsScreen />;
}
