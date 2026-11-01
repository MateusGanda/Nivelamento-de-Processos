import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { setoresService } from '@/modules/sectors/composition';
import { criarHandlersSetores } from '@/modules/sectors/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersSetores({ autorizar: exigirAdminDaSessao, setores: setoresService });

export async function PATCH(request: Request, { params }: RouteContext<'/api/setores/[id]/status'>): Promise<Response> {
  return handlers.PATCH_STATUS(request, (await params).id);
}
