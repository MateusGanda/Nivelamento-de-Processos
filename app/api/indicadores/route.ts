import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { indicadoresService } from '@/modules/indicators/composition';
import { criarHandlersIndicadores } from '@/modules/indicators/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersIndicadores({ autorizar: exigirAdminDaSessao, indicadores: indicadoresService });
export const GET = handlers.GET;
