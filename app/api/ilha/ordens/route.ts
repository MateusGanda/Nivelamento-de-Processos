import { chaveIlha, execucoesService } from '@/modules/executions/composition';
import { criarHandlersIlha } from '@/modules/executions/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersIlha({ chave: chaveIlha, execucoes: execucoesService });

export const GET = handlers.ORDENS_GET;
