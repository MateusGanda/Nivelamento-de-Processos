import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { roteirosService } from '@/modules/routings/composition';
import { RoutingDetailScreen } from '@/modules/routings/presentation/components/routing-detail-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Roteiro' };

export default async function RoteiroPage({ params, searchParams }: PageProps<'/painel/roteiros/[id]'>) {
  if (!await obterAdminParaPagina()) redirect('/login');
  const [{ id }, consulta] = await Promise.all([params, searchParams]);
  // As operações alimentam a escolha da etapa; o roteiro em si é carregado pela tela.
  const operacoes = await roteirosService.listarOperacoes();
  return <RoutingDetailScreen key={id} id={id} operacoes={operacoes} versaoCriada={consulta.versao === 'criada'} />;
}
