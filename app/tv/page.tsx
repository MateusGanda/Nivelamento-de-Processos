import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { dispositivosService } from '@/modules/devices/composition';
import { COOKIE_TV } from '@/modules/devices/presentation/http';
import { TvAcesso } from '@/modules/devices/presentation/components/tv-acesso';
import { TvScreen } from '@/modules/devices/presentation/components/tv-screen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Painel de TV' };

// A TV não usa a sessão administrativa: é liberada pelo código de acesso cadastrado em TVs.
export default async function TvPage() {
  const valor = (await cookies()).get(COOKIE_TV)?.value;
  const liberada = await dispositivosService.identificar(valor ? decodeURIComponent(valor) : undefined);
  return liberada ? <TvScreen /> : <TvAcesso />;
}
