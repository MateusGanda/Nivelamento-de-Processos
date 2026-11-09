import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { DevicesScreen } from '@/modules/devices/presentation/components/devices-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'TVs' };

export default async function TvsPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <DevicesScreen />;
}
