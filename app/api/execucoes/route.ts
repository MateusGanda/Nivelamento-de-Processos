import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { execucoesService } from '@/modules/executions/composition';
import { criarHandlersAcompanhamento } from '@/modules/executions/presentation/http-painel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersAcompanhamento({ autorizar: exigirAdminDaSessao, execucoes: execucoesService });
export const GET = handlers.GET;
