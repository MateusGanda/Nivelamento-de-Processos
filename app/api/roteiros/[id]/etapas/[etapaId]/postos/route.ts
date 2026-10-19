import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { roteirosService } from '@/modules/routings/composition';
import { criarHandlersRoteiros } from '@/modules/routings/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersRoteiros({ autorizar: exigirAdminDaSessao, roteiros: roteirosService });

export async function PUT(request: Request, { params }: RouteContext<'/api/roteiros/[id]/etapas/[etapaId]/postos'>): Promise<Response> {
  const { id, etapaId } = await params;
  return handlers.PUT_POSTOS(request, id, etapaId);
}
