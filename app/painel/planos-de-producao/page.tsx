import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { PlansScreen } from '@/modules/production-plans/presentation/components/plans-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Planos de Produção' };

export default async function PlanosPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <PlansScreen />;
}
