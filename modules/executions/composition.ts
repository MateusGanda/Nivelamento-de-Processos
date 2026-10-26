import { ExecucoesService } from './application/execucoes.ts';
import { criarChaveIlha } from './infrastructure/chave-ilha.ts';
import { PrismaExecucaoRepository } from './infrastructure/prisma-execucao-repository.ts';

export const execucoesService = new ExecucoesService(new PrismaExecucaoRepository());

// Lida a cada pedido: trocar ILHA_CHAVE no ambiente bloqueia os terminais já liberados.
export const chaveIlha = () => criarChaveIlha(process.env.ILHA_CHAVE);
