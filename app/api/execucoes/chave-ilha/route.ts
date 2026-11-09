import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { chaveIlhaService } from '@/modules/executions/composition';
import { criarHandlersChaveIlha } from '@/modules/executions/presentation/http-painel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersChaveIlha({ autorizar: exigirAdminDaSessao, chaves: chaveIlhaService });
export const GET = handlers.GET;
export const POST = handlers.POST;
