import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { SectorsScreen } from '@/modules/sectors/presentation/components/sectors-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Setores' };

export default async function SetoresPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <SectorsScreen />;
}
