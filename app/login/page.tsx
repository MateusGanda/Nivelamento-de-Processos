import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { LoginScreen } from '@/modules/access/presentation/components/login-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage() {
  if (await obterAdminParaPagina()) redirect('/painel');
  return <LoginScreen />;
}
