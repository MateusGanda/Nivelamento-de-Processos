import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { ordensService } from '@/modules/production-orders/composition';
import { criarHandlersOrdens } from '@/modules/production-orders/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersOrdens({ autorizar: exigirAdminDaSessao, ordens: ordensService });

export async function PATCH(request: Request, { params }: RouteContext<'/api/ordens-de-producao/[id]'>): Promise<Response> {
  return handlers.PATCH(request, (await params).id);
}
