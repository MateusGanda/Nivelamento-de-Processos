import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { RoutingsScreen } from '@/modules/routings/presentation/components/routings-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Roteiros' };

export default async function RoteirosPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <RoutingsScreen />;
}
