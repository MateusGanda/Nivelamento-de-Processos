import { OperacoesService } from './application/operacoes.ts';
import { PrismaOperacaoRepository } from './infrastructure/prisma-operacao-repository.ts';

export const operacoesService = new OperacoesService(new PrismaOperacaoRepository());
