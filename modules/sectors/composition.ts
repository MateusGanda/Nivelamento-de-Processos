import { SetoresService } from './application/setores.ts';
import { PrismaSetorRepository } from './infrastructure/prisma-setor-repository.ts';

export const setoresService = new SetoresService(new PrismaSetorRepository());
