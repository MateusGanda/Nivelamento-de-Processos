import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { chaveIlha } from '@/modules/executions/composition';
import { COOKIE_ILHA } from '@/modules/executions/presentation/http';
import { IlhaAcesso } from '@/modules/executions/presentation/components/ilha-acesso';
import { IlhaScreen } from '@/modules/executions/presentation/components/ilha-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ilha de apontamento' };

// A ilha não usa a sessão administrativa: o terminal é liberado pela chave da ilha.
export default async function IlhaPage() {
  const chave = chaveIlha();
  const liberado = chave.credencialValida((await cookies()).get(COOKIE_ILHA)?.value);
  return liberado ? <IlhaScreen /> : <IlhaAcesso configurada={chave.configurada} />;
}
