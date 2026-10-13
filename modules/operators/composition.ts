import { OperadoresService } from './application/operadores.ts';
import { PrismaOperadorRepository } from './infrastructure/prisma-operador-repository.ts';

export const operadoresService = new OperadoresService(new PrismaOperadorRepository());
