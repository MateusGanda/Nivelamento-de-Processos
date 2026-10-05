import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const resultado = config({
  path: process.env.ENV_FILE || ".env",
});

if (resultado.error) {
  throw new Error("Não foi possível carregar o arquivo de ambiente.");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Defina DATABASE_URL no arquivo .env.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$transaction(
    async (tx) => {
      const linha = await tx.linha.upsert({
        where: { codigo: "DEMO-LINHA-01" },
        update: {},
        create: {
          codigo: "DEMO-LINHA-01",
          nome: "Linha demonstrativa",
        },
      });

      const produto = await tx.produto.upsert({
        where: { codigo: "DEMO-PRODUTO-01" },
        update: {},
        create: {
          codigo: "DEMO-PRODUTO-01",
          nome: "Suporte metálico",
          descricao: "Produto fictício para testar o sistema.",
        },
      });

      const roteiro = [
        {
          sequencia: 1,
          codigoPosto: "DEMO-POSTO-01",
          nomePosto: "Posto de corte",
          codigoOperacao: "DEMO-OP-01",
          nomeOperacao: "Corte",
          tempoPrevistoSegundos: 120,
        },
        {
          sequencia: 2,
          codigoPosto: "DEMO-POSTO-02",
          nomePosto: "Posto de montagem",
          codigoOperacao: "DEMO-OP-02",
          nomeOperacao: "Montagem",
          tempoPrevistoSegundos: 180,
        },
        {
          sequencia: 3,
          codigoPosto: "DEMO-POSTO-03",
          nomePosto: "Posto de inspeção",
          codigoOperacao: "DEMO-OP-03",
          nomeOperacao: "Inspeção",
          tempoPrevistoSegundos: 60,
        },
      ];

      for (const item of roteiro) {
        await tx.posto.upsert({
          where: { codigo: item.codigoPosto },
          update: {},
          create: {
            codigo: item.codigoPosto,
            nome: item.nomePosto,
            linhaId: linha.id,
          },
        });

        await tx.operacao.upsert({
          where: { codigo: item.codigoOperacao },
          update: {},
          create: {
            codigo: item.codigoOperacao,
            nome: item.nomeOperacao,
          },
        });

        const posto = await tx.posto.findUniqueOrThrow({
          where: { codigo: item.codigoPosto },
        });

        const operacao = await tx.operacao.findUniqueOrThrow({
          where: { codigo: item.codigoOperacao },
        });

        await tx.operacaoProduto.upsert({
          where: {
            produtoId_sequencia: {
              produtoId: produto.id,
              sequencia: item.sequencia,
            },
          },
          update: {},
          create: {
            produtoId: produto.id,
            operacaoId: operacao.id,
            postoId: posto.id,
            sequencia: item.sequencia,
            tempoPrevistoSegundos: item.tempoPrevistoSegundos,
          },
        });
      }

      const ordem = await tx.ordemServico.upsert({
        where: { numero: "DEMO-OS-001" },
        update: {},
        create: {
          numero: "DEMO-OS-001",
          produtoId: produto.id,
          quantidade: 1,
          observacao: "Ordem fictícia para demonstração.",
        },
      });

      const ficha = await tx.ficha.upsert({
        where: { codigo: "DEMO-FICHA-001" },
        update: {},
        create: {
          codigo: "DEMO-FICHA-001",
          ordemServicoId: ordem.id,
        },
      });

      const etapasRoteiro = await tx.operacaoProduto.findMany({
        where: { produtoId: produto.id },
        include: {
          operacao: true,
          posto: true,
        },
        orderBy: { sequencia: "asc" },
      });

      for (const etapa of etapasRoteiro) {
        await tx.fichaEtapa.upsert({
          where: {
            fichaId_sequencia: {
              fichaId: ficha.id,
              sequencia: etapa.sequencia,
            },
          },
          update: {},
          create: {
            fichaId: ficha.id,
            operacaoProdutoId: etapa.id,
            sequencia: etapa.sequencia,
            nomeOperacao: etapa.operacao.nome,
            codigoPosto: etapa.posto.codigo,
            tempoPrevistoSegundos: etapa.tempoPrevistoSegundos,
          },
        });
      }
    },
    {
      timeout: 30000,
    },
  );

  const ficha = await prisma.ficha.findUniqueOrThrow({
    where: { codigo: "DEMO-FICHA-001" },
    include: {
      etapas: {
        orderBy: { sequencia: "asc" },
      },
    },
  });

  console.log("Seed concluído!");
  console.log(`Ficha: ${ficha.codigo}`);

  console.table(
    ficha.etapas.map((etapa) => ({
      sequencia: etapa.sequencia,
      operacao: etapa.nomeOperacao,
      posto: etapa.codigoPosto,
      tempoSegundos: etapa.tempoPrevistoSegundos,
      status: etapa.status,
    })),
  );
}

main()
  .catch(() => {
    console.error(
      "Falha no seed. Confira se o PostgreSQL está ativo, " +
        "se a DATABASE_URL está correta e se a migração foi aplicada.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
