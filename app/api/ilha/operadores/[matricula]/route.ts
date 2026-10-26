import { chaveIlha, execucoesService } from '@/modules/executions/composition';
import { criarHandlersIlha } from '@/modules/executions/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersIlha({ chave: chaveIlha, execucoes: execucoesService });

export async function GET(request: Request, { params }: RouteContext<'/api/ilha/operadores/[matricula]'>): Promise<Response> {
  return handlers.OPERADOR_GET(request, decodeURIComponent((await params).matricula));
}
