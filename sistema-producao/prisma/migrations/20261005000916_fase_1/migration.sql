-- CreateEnum
CREATE TYPE "StatusProducao" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Linha" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Linha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "linhaId" INTEGER NOT NULL,

    CONSTRAINT "Posto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operacao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Operacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacaoProduto" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "operacaoId" INTEGER NOT NULL,
    "postoId" INTEGER NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "tempoPrevistoSegundos" INTEGER NOT NULL,

    CONSTRAINT "OperacaoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "status" "StatusProducao" NOT NULL DEFAULT 'PENDENTE',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazo" TIMESTAMP(3),
    "observacao" TEXT,

    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ficha" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "ordemServicoId" INTEGER NOT NULL,
    "status" "StatusProducao" NOT NULL DEFAULT 'PENDENTE',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "Ficha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichaEtapa" (
    "id" SERIAL NOT NULL,
    "fichaId" INTEGER NOT NULL,
    "operacaoProdutoId" INTEGER NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "nomeOperacao" TEXT NOT NULL,
    "codigoPosto" TEXT NOT NULL,
    "tempoPrevistoSegundos" INTEGER NOT NULL,
    "status" "StatusProducao" NOT NULL DEFAULT 'PENDENTE',
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "observacao" TEXT,

    CONSTRAINT "FichaEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Linha_codigo_key" ON "Linha"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Posto_codigo_key" ON "Posto"("codigo");

-- CreateIndex
CREATE INDEX "Posto_linhaId_idx" ON "Posto"("linhaId");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigo_key" ON "Produto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Operacao_codigo_key" ON "Operacao"("codigo");

-- CreateIndex
CREATE INDEX "OperacaoProduto_operacaoId_idx" ON "OperacaoProduto"("operacaoId");

-- CreateIndex
CREATE INDEX "OperacaoProduto_postoId_idx" ON "OperacaoProduto"("postoId");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoProduto_produtoId_sequencia_key" ON "OperacaoProduto"("produtoId", "sequencia");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_numero_key" ON "OrdemServico"("numero");

-- CreateIndex
CREATE INDEX "OrdemServico_produtoId_idx" ON "OrdemServico"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "Ficha_codigo_key" ON "Ficha"("codigo");

-- CreateIndex
CREATE INDEX "Ficha_ordemServicoId_idx" ON "Ficha"("ordemServicoId");

-- CreateIndex
CREATE INDEX "FichaEtapa_operacaoProdutoId_idx" ON "FichaEtapa"("operacaoProdutoId");

-- CreateIndex
CREATE UNIQUE INDEX "FichaEtapa_fichaId_sequencia_key" ON "FichaEtapa"("fichaId", "sequencia");

-- AddForeignKey
ALTER TABLE "Posto" ADD CONSTRAINT "Posto_linhaId_fkey" FOREIGN KEY ("linhaId") REFERENCES "Linha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoProduto" ADD CONSTRAINT "OperacaoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoProduto" ADD CONSTRAINT "OperacaoProduto_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoProduto" ADD CONSTRAINT "OperacaoProduto_postoId_fkey" FOREIGN KEY ("postoId") REFERENCES "Posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ficha" ADD CONSTRAINT "Ficha_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "OrdemServico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaEtapa" ADD CONSTRAINT "FichaEtapa_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "Ficha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaEtapa" ADD CONSTRAINT "FichaEtapa_operacaoProdutoId_fkey" FOREIGN KEY ("operacaoProdutoId") REFERENCES "OperacaoProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
