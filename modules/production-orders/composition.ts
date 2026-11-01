import { OrdensService } from './application/ordens.ts';
import { PrismaOrdemRepository } from './infrastructure/prisma-ordem-repository.ts';

export const ordensService = new OrdensService(new PrismaOrdemRepository());
