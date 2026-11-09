import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { dispositivosService } from '@/modules/devices/composition';
import { criarHandlersDispositivos } from '@/modules/devices/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = criarHandlersDispositivos({ autorizar: exigirAdminDaSessao, dispositivos: dispositivosService });
export async function PATCH(request: Request, { params }: RouteContext<'/api/dispositivos/[id]'>): Promise<Response> {
  return handlers.PATCH(request, (await params).id);
}
