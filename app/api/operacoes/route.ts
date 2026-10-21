import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { operacoesService } from '@/modules/operations/composition';
import { criarHandlersOperacoes } from '@/modules/operations/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersOperacoes({ autorizar: exigirAdminDaSessao, operacoes: operacoesService });
export const GET = handlers.GET;
export const POST = handlers.POST;
