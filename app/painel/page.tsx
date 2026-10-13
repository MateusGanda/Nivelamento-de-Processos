import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { PainelHome } from '@/modules/access/presentation/components/painel-home';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Início' };

export default async function PainelPage() {
  const usuario = await obterAdminParaPagina();
  if (!usuario) redirect('/login');
  return <PainelHome nome={usuario.nome} />;
}
