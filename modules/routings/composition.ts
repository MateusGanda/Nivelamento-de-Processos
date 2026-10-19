import { RoteirosService } from './application/roteiros.ts';
import { PrismaRoteiroRepository } from './infrastructure/prisma-roteiro-repository.ts';

export const roteirosService = new RoteirosService(new PrismaRoteiroRepository());
