import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { ExecucaoPainel } from '@/modules/executions/presentation/components/execucao-painel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Execuções' };

export default async function ExecucaoPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <ExecucaoPainel />;
}
