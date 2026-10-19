import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { roteirosService } from '@/modules/routings/composition';
import { criarHandlersRoteiros } from '@/modules/routings/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersRoteiros({ autorizar: exigirAdminDaSessao, roteiros: roteirosService });

export async function DELETE(_: Request, { params }: RouteContext<'/api/roteiros/[id]/produtos/[produtoId]'>): Promise<Response> {
  const { id, produtoId } = await params;
  return handlers.DELETE_PRODUTO(id, produtoId);
}
