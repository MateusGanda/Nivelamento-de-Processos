import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { roteirosService } from '@/modules/routings/composition';
import { criarHandlersRoteiros } from '@/modules/routings/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersRoteiros({ autorizar: exigirAdminDaSessao, roteiros: roteirosService });

export async function POST(request: Request, { params }: RouteContext<'/api/roteiros/[id]/produtos'>): Promise<Response> {
  return handlers.POST_PRODUTO(request, (await params).id);
}
