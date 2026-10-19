import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { ProductsScreen } from '@/modules/products/presentation/components/products-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Produtos' };

export default async function ProdutosPage() {
  if (!await obterAdminParaPagina()) redirect('/login');
  return <ProductsScreen />;
}
