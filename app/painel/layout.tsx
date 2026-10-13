import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { AdminShell } from '@/modules/access/presentation/components/admin-shell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PainelLayout({ children }: LayoutProps<'/painel'>) {
  const usuario = await obterAdminParaPagina();
  if (!usuario) redirect('/login');

  return <AdminShell usuario={{ nome: usuario.nome, matricula: usuario.matricula }}>{children}</AdminShell>;
}
