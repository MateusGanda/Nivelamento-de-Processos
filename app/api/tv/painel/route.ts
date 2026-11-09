import { dispositivosService, fontesDoPainel } from '@/modules/devices/composition';
import { criarHandlersTv } from '@/modules/devices/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersTv({ dispositivos: dispositivosService, fontes: fontesDoPainel });
export const GET = handlers.PAINEL_GET;
