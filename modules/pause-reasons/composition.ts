import { MotivosPausaService } from './application/motivos-pausa.ts';
import { PrismaMotivoPausaRepository } from './infrastructure/prisma-motivo-pausa-repository.ts';

export const motivosPausaService = new MotivosPausaService(new PrismaMotivoPausaRepository());
