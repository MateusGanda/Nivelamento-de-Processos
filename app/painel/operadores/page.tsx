import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { OperatorsScreen } from '@/modules/operators/presentation/components/operators-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Operadores' };

export default async function OperadoresPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <OperatorsScreen />;
}
