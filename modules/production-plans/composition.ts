import { PlanosService } from './application/planos.ts';
import { PrismaPlanoRepository } from './infrastructure/prisma-plano-repository.ts';

export const planosService = new PlanosService(new PrismaPlanoRepository());
