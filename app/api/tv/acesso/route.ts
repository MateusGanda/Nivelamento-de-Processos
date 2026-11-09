import { dispositivosService, fontesDoPainel } from '@/modules/devices/composition';
import { criarHandlersTv } from '@/modules/devices/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A TV não usa a sessão administrativa: é liberada pelo código de acesso dela.
const handlers = criarHandlersTv({ dispositivos: dispositivosService, fontes: fontesDoPainel });
export const POST = handlers.ACESSO_POST;
export const DELETE = handlers.ACESSO_DELETE;
