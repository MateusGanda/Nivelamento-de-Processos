import { ProdutosService } from './application/produtos.ts';
import { PrismaProdutoRepository } from './infrastructure/prisma-produto-repository.ts';

export const produtosService = new ProdutosService(new PrismaProdutoRepository());
