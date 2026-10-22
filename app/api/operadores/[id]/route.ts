import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { operadoresService } from '@/modules/operators/composition';
import { criarHandlersOperadores } from '@/modules/operators/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersOperadores({ autorizar: exigirAdminDaSessao, operadores: operadoresService });

export async function PATCH(request: Request, { params }: RouteContext<'/api/operadores/[id]'>): Promise<Response> {
  return handlers.PATCH(request, (await params).id);
}
