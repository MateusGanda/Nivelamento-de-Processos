import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { motivosPausaService } from '@/modules/pause-reasons/composition';
import { criarHandlersMotivosPausa } from '@/modules/pause-reasons/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = criarHandlersMotivosPausa({ autorizar: exigirAdminDaSessao, motivosPausa: motivosPausaService });
export const GET = handlers.GET;
export const POST = handlers.POST;
