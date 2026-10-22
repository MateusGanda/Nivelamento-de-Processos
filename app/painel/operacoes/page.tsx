import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { OperationsScreen } from '@/modules/operations/presentation/components/operations-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Operações' };

export default async function OperacoesPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <OperationsScreen />;
}
