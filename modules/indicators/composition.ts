import { IndicadoresService } from './application/indicadores.ts';
import { PrismaIndicadoresRepository } from './infrastructure/prisma-indicadores-repository.ts';

export const indicadoresService = new IndicadoresService(new PrismaIndicadoresRepository());
