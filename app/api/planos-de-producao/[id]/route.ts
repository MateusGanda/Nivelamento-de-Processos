import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { planosService } from '@/modules/production-plans/composition';
import { criarHandlersPlanos } from '@/modules/production-plans/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersPlanos({ autorizar: exigirAdminDaSessao, planos: planosService });

export async function PATCH(request: Request, { params }: RouteContext<'/api/planos-de-producao/[id]'>): Promise<Response> {
  return handlers.PATCH(request, (await params).id);
}
