import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { ordensService } from '@/modules/production-orders/composition';
import { OrdersScreen } from '@/modules/production-orders/presentation/components/orders-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ordens de Produção' };

export default async function OrdensPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  // Produtos ativos com as versões de roteiro e os planos alimentam o formulário da ordem.
  return <OrdersScreen opcoes={await ordensService.listarOpcoes()} />;
}
