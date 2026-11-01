import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { motivosPausaService } from '@/modules/pause-reasons/composition';
import { criarHandlersMotivosPausa } from '@/modules/pause-reasons/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = criarHandlersMotivosPausa({ autorizar: exigirAdminDaSessao, motivosPausa: motivosPausaService });
export async function PATCH(request: Request, { params }: RouteContext<'/api/motivos-de-pausa/[id]/status'>): Promise<Response> {
  return handlers.PATCH_STATUS(request, (await params).id);
}
