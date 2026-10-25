import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { ordensService } from '@/modules/production-orders/composition';
import { criarHandlersOrdens } from '@/modules/production-orders/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersOrdens({ autorizar: exigirAdminDaSessao, ordens: ordensService });

export const GET = handlers.GET;
export const POST = handlers.POST;
