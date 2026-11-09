import { ChaveIlhaService } from './application/chave-ilha.ts';
import { ExecucoesService } from './application/execucoes.ts';
import { criarChaveIlha, criarChaveIlhaDoPainel, gerarChavePainel, normalizarChavePainel, resumoChavePainel } from './infrastructure/chave-ilha.ts';
import { PrismaChaveIlhaRepository } from './infrastructure/prisma-chave-ilha-repository.ts';
import { PrismaExecucaoRepository } from './infrastructure/prisma-execucao-repository.ts';

export const execucoesService = new ExecucoesService(new PrismaExecucaoRepository());

// Lida a cada pedido: gerar uma chave pelo painel (ou trocar ILHA_CHAVE, enquanto não houver chave no painel)
// bloqueia os terminais já liberados.
export const chaveIlhaService = new ChaveIlhaService(new PrismaChaveIlhaRepository(), {
  doAmbiente: () => criarChaveIlha(process.env.ILHA_CHAVE),
  doPainel: (chaveHash) => criarChaveIlhaDoPainel(chaveHash, process.env.NEXTAUTH_SECRET),
  gerar: () => {
    const chave = gerarChavePainel();
    return { chave, chaveHash: resumoChavePainel(normalizarChavePainel(chave)!) };
  },
});

export const chaveIlha = () => chaveIlhaService.atual();
