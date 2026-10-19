import { exigirAdminDaSessao } from '@/modules/access/presentation/http';
import { produtosService } from '@/modules/products/composition';
import { criarHandlersProdutos } from '@/modules/products/presentation/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = criarHandlersProdutos({ autorizar: exigirAdminDaSessao, produtos: produtosService });
export const GET = handlers.GET;
export const POST = handlers.POST;
