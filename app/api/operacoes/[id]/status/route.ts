import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { operacoesService } from '@/modules/operations/composition';
import { criarHandlersOperacoes } from '@/modules/operations/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersOperacoes({ autorizar: exigirAdminDaSessao, operacoes: operacoesService });

export async function PATCH(request: Request, { params }: RouteContext<'/api/operacoes/[id]/status'>): Promise<Response> {
  return handlers.PATCH_STATUS(request, (await params).id);
}
