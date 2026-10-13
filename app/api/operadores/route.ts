import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { operadoresService } from '@/modules/operators/composition';
import { criarHandlersOperadores } from '@/modules/operators/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersOperadores({ autorizar: exigirAdminDaSessao, operadores: operadoresService });
export const GET = handlers.GET;
export const POST = handlers.POST;
