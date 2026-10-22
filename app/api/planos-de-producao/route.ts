import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { planosService } from '@/modules/production-plans/composition';
import { criarHandlersPlanos } from '@/modules/production-plans/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersPlanos({ autorizar: exigirAdminDaSessao, planos: planosService });

export const GET = handlers.GET;
export const POST = handlers.POST;
