import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { roteirosService } from '@/modules/routings/composition';
import { criarHandlersRoteiros } from '@/modules/routings/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersRoteiros({ autorizar: exigirAdminDaSessao, roteiros: roteirosService });

export async function PATCH(request: Request, { params }: RouteContext<'/api/roteiros/[id]/status'>): Promise<Response> {
  return handlers.PATCH_STATUS(request, (await params).id);
}
