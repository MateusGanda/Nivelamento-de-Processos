import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { obterAdminParaPagina } from '@/modules/access/presentation/session';
import { obterModuloPainel } from '@/modules/access/presentation/painel-navigation';
import { PainelPlaceholder } from '@/modules/access/presentation/components/painel-placeholder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/painel/[modulo]'>): Promise<Metadata> {
  const modulo = obterModuloPainel((await params).modulo);
  return { title: modulo?.titulo ?? 'Módulo não encontrado' };
}

export default async function ModuloPage({ params }: PageProps<'/painel/[modulo]'>) {
  const modulo = obterModuloPainel((await params).modulo);
  if (!modulo) notFound();
  // Layouts são reutilizados na navegação; esta página também revalida o acesso.
  if (!await obterAdminParaPagina()) redirect('/login');
  return <PainelPlaceholder modulo={modulo} />;
}
