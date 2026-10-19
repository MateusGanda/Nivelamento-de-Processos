import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { postosService } from '@/modules/workstations/composition';
import { criarHandlersPostos } from '@/modules/workstations/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersPostos({ autorizar: exigirAdminDaSessao, postos: postosService });
export const GET = handlers.GET;
export const POST = handlers.POST;
