import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { dispositivosService } from '@/modules/devices/composition';
import { criarHandlersDispositivos } from '@/modules/devices/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = criarHandlersDispositivos({ autorizar: exigirAdminDaSessao, dispositivos: dispositivosService });
export async function POST(_request: Request, { params }: RouteContext<'/api/dispositivos/[id]/codigo'>): Promise<Response> {
  return handlers.POST_CODIGO((await params).id);
}
