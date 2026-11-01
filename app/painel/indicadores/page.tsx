import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { IndicatorsScreen } from '@/modules/indicators/presentation/components/indicators-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Indicadores' };

export default async function IndicadoresPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <IndicatorsScreen />;
}
