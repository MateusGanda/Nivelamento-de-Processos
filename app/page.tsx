import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Home() {
  const usuario = await obterAdminParaPagina();
  redirect(usuario ? '/painel' : '/login');
}
