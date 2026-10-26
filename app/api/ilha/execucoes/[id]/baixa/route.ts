import { chaveIlha, execucoesService } from '@/modules/executions/composition';
import { criarHandlersIlha } from '@/modules/executions/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersIlha({ chave: chaveIlha, execucoes: execucoesService });

export async function POST(request: Request, { params }: RouteContext<'/api/ilha/execucoes/[id]/baixa'>): Promise<Response> {
  return handlers.BAIXA_POST(request, (await params).id);
}
