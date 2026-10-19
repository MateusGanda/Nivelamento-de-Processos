import { PostosService } from './application/postos.ts';
import { PrismaPostoRepository } from './infrastructure/prisma-posto-repository.ts';

export const postosService = new PostosService(new PrismaPostoRepository());
