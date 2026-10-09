-- Script de criação do banco de dados do GUNP (PostgreSQL)
--
-- Gerado a partir da migração migrations/app/20261008T1833_init (2026-10-08).
-- A migração do Prisma continua sendo a fonte oficial; este arquivo reúne os
-- mesmos comandos SQL, na mesma ordem, para consulta e para criar o banco
-- manualmente em um PostgreSQL vazio.

BEGIN;

-- ============================================================
-- Esquema
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "public";

-- ============================================================
-- Tabelas
-- ============================================================

CREATE TABLE "public"."EtapaPosto" (
  "etapaRoteiroId" uuid NOT NULL,
  "postoId" uuid NOT NULL,
  PRIMARY KEY ("etapaRoteiroId", "postoId")
);

CREATE TABLE "public"."EtapaRoteiro" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "id" uuid NOT NULL,
  "operacaoId" uuid NOT NULL,
  "ordem" int4 NOT NULL,
  "roteiroId" uuid NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."EventoTempo" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "dataHora" timestamptz NOT NULL,
  "execucaoId" uuid NOT NULL,
  "id" uuid NOT NULL,
  "motivoPausaId" uuid,
  "tipo" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "EventoTempo_pausa_motivo_check_f24c7449" CHECK (("tipo" <> 'PAUSA' OR "motivoPausaId" IS NOT NULL)),
  CONSTRAINT "EventoTempo_tipo_check_c655f9d0" CHECK ("tipo" IN ('INICIO', 'PAUSA', 'RETOMADA', 'FINALIZACAO'))
);

CREATE TABLE "public"."Execucao" (
  "criadoEm" timestamptz DEFAULT (now()) NOT NULL,
  "etapaRoteiroId" uuid NOT NULL,
  "id" uuid NOT NULL,
  "operadorId" uuid NOT NULL,
  "ordemProducaoId" uuid NOT NULL,
  "postoId" uuid NOT NULL,
  "quantidadeBoa" numeric(12,2),
  "quantidadeRefugo" numeric(12,2),
  "quantidadeRetrabalho" numeric(12,2),
  "status" text NOT NULL,
  "tipoFinalizacao" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "Execucao_quantidades_finalizacao_check_1fc31576" CHECK (("tipoFinalizacao" = 'BAIXA' AND "quantidadeBoa" IS NOT NULL AND "quantidadeRetrabalho" IS NOT NULL AND "quantidadeRefugo" IS NOT NULL) OR ("tipoFinalizacao" = 'TROCA_OPERACAO' AND "quantidadeBoa" IS NULL AND "quantidadeRetrabalho" IS NULL AND "quantidadeRefugo" IS NULL) OR ("tipoFinalizacao" IS NULL AND "quantidadeBoa" IS NULL AND "quantidadeRetrabalho" IS NULL AND "quantidadeRefugo" IS NULL)),
  CONSTRAINT "Execucao_status_check_03bbbb48" CHECK ("status" IN ('EM_EXECUCAO', 'PAUSADA', 'FINALIZADA')),
  CONSTRAINT "Execucao_status_finalizacao_check_491cacf7" CHECK (("status" = 'FINALIZADA' AND "tipoFinalizacao" IS NOT NULL) OR ("status" IN ('EM_EXECUCAO', 'PAUSADA') AND "tipoFinalizacao" IS NULL)),
  CONSTRAINT "Execucao_tipoFinalizacao_check_874252b2" CHECK ("tipoFinalizacao" IN ('TROCA_OPERACAO', 'BAIXA'))
);

CREATE TABLE "public"."MotivoPausa" (
  "ativo" bool DEFAULT true NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "descricao" text,
  "id" uuid NOT NULL,
  "nome" text NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."Operacao" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "descricao" text,
  "id" uuid NOT NULL,
  "nome" text NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."Operador" (
  "ativo" bool DEFAULT true NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "id" uuid NOT NULL,
  "matricula" text NOT NULL,
  "nome" text NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."OrdemProducao" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "id" uuid NOT NULL,
  "numero" text NOT NULL,
  "planoProducaoId" uuid NOT NULL,
  "produtoId" uuid NOT NULL,
  "quantidade" numeric(12,2) NOT NULL,
  "roteiroId" uuid NOT NULL,
  "unidade" text NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."PlanoProducao" (
  "codigo" text NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "dataFim" date,
  "dataInicio" date,
  "descricao" text,
  "id" uuid NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."Posto" (
  "ativo" bool DEFAULT true NOT NULL,
  "codigo" text NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "id" uuid NOT NULL,
  "nome" text NOT NULL,
  "setorId" uuid NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."Produto" (
  "codigo" text NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "id" uuid NOT NULL,
  "nome" text NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."ProdutoEtapa" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "etapaRoteiroId" uuid NOT NULL,
  "id" uuid NOT NULL,
  "produtoId" uuid NOT NULL,
  "tempoPadrao" numeric(10,2) NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."ProdutoRoteiro" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "id" uuid NOT NULL,
  "produtoId" uuid NOT NULL,
  "roteiroId" uuid NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  "vigente" bool DEFAULT false NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."Roteiro" (
  "ativo" bool DEFAULT true NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "id" uuid NOT NULL,
  "nome" text NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  "versao" int4 NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."Setor" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "descricao" text,
  "id" uuid NOT NULL,
  "nome" text NOT NULL,
  "updatedAt" timestamptz DEFAULT (now()) NOT NULL,
  PRIMARY KEY ("id")
);

-- ============================================================
-- Restrições de unicidade
-- ============================================================

ALTER TABLE "public"."EtapaRoteiro" ADD CONSTRAINT "EtapaRoteiro_roteiroId_ordem_key" UNIQUE ("roteiroId", "ordem");

ALTER TABLE "public"."MotivoPausa" ADD CONSTRAINT "MotivoPausa_nome_key" UNIQUE ("nome");

ALTER TABLE "public"."Operacao" ADD CONSTRAINT "Operacao_nome_key" UNIQUE ("nome");

ALTER TABLE "public"."Operador" ADD CONSTRAINT "Operador_matricula_key" UNIQUE ("matricula");

ALTER TABLE "public"."OrdemProducao" ADD CONSTRAINT "OrdemProducao_numero_key" UNIQUE ("numero");

ALTER TABLE "public"."PlanoProducao" ADD CONSTRAINT "PlanoProducao_codigo_key" UNIQUE ("codigo");

ALTER TABLE "public"."Posto" ADD CONSTRAINT "Posto_codigo_key" UNIQUE ("codigo");

ALTER TABLE "public"."Produto" ADD CONSTRAINT "Produto_codigo_key" UNIQUE ("codigo");

ALTER TABLE "public"."ProdutoEtapa" ADD CONSTRAINT "ProdutoEtapa_produtoId_etapaRoteiroId_key" UNIQUE ("produtoId", "etapaRoteiroId");

ALTER TABLE "public"."ProdutoRoteiro" ADD CONSTRAINT "ProdutoRoteiro_produtoId_roteiroId_key" UNIQUE ("produtoId", "roteiroId");

ALTER TABLE "public"."Roteiro" ADD CONSTRAINT "Roteiro_nome_versao_key" UNIQUE ("nome", "versao");

ALTER TABLE "public"."Setor" ADD CONSTRAINT "Setor_nome_key" UNIQUE ("nome");

-- ============================================================
-- Índices
-- ============================================================

CREATE INDEX "EtapaPosto_etapaRoteiroId_idx_17d641ff" ON "public"."EtapaPosto" ("etapaRoteiroId");

CREATE INDEX "EtapaPosto_postoId_idx_13be8f3c" ON "public"."EtapaPosto" ("postoId");

CREATE INDEX "EtapaRoteiro_operacaoId_idx_33359931" ON "public"."EtapaRoteiro" ("operacaoId");

CREATE INDEX "EtapaRoteiro_roteiroId_idx_1cd14ed6" ON "public"."EtapaRoteiro" ("roteiroId");

CREATE INDEX "EventoTempo_execucaoId_dataHora_idx_1b757161" ON "public"."EventoTempo" ("execucaoId", "dataHora");

CREATE INDEX "EventoTempo_execucaoId_idx_a797c763" ON "public"."EventoTempo" ("execucaoId");

CREATE INDEX "EventoTempo_motivoPausaId_idx_82c69795" ON "public"."EventoTempo" ("motivoPausaId");

CREATE UNIQUE INDEX "Execucao_baixa_unica_d8d722ee" ON "public"."Execucao" ("ordemProducaoId", "etapaRoteiroId") WHERE (("tipoFinalizacao" = 'BAIXA'));

CREATE INDEX "Execucao_etapaRoteiroId_idx_17d641ff" ON "public"."Execucao" ("etapaRoteiroId");

CREATE INDEX "Execucao_operadorId_idx_b7d31568" ON "public"."Execucao" ("operadorId");

CREATE INDEX "Execucao_ordemProducaoId_idx_422138c7" ON "public"."Execucao" ("ordemProducaoId");

CREATE INDEX "Execucao_postoId_idx_13be8f3c" ON "public"."Execucao" ("postoId");

CREATE INDEX "OrdemProducao_planoProducaoId_idx_d14976d3" ON "public"."OrdemProducao" ("planoProducaoId");

CREATE INDEX "OrdemProducao_produtoId_idx_eb62fdb9" ON "public"."OrdemProducao" ("produtoId");

CREATE INDEX "OrdemProducao_roteiroId_idx_1cd14ed6" ON "public"."OrdemProducao" ("roteiroId");

CREATE INDEX "Posto_setorId_idx_e3349e5c" ON "public"."Posto" ("setorId");

CREATE INDEX "ProdutoEtapa_etapaRoteiroId_idx_17d641ff" ON "public"."ProdutoEtapa" ("etapaRoteiroId");

CREATE INDEX "ProdutoEtapa_produtoId_idx_eb62fdb9" ON "public"."ProdutoEtapa" ("produtoId");

CREATE INDEX "ProdutoRoteiro_produtoId_idx_eb62fdb9" ON "public"."ProdutoRoteiro" ("produtoId");

CREATE INDEX "ProdutoRoteiro_roteiroId_idx_1cd14ed6" ON "public"."ProdutoRoteiro" ("roteiroId");

CREATE UNIQUE INDEX "ProdutoRoteiro_vigente_unica_c7c5c582" ON "public"."ProdutoRoteiro" ("produtoId") WHERE (("vigente" = true));

-- ============================================================
-- Chaves estrangeiras
-- ============================================================

ALTER TABLE "public"."EtapaPosto"
ADD CONSTRAINT "EtapaPosto_etapaRoteiroId_fkey"
FOREIGN KEY ("etapaRoteiroId")
REFERENCES "public"."EtapaRoteiro" ("id");

ALTER TABLE "public"."EtapaPosto"
ADD CONSTRAINT "EtapaPosto_postoId_fkey"
FOREIGN KEY ("postoId")
REFERENCES "public"."Posto" ("id");

ALTER TABLE "public"."EtapaRoteiro"
ADD CONSTRAINT "EtapaRoteiro_roteiroId_fkey"
FOREIGN KEY ("roteiroId")
REFERENCES "public"."Roteiro" ("id");

ALTER TABLE "public"."EtapaRoteiro"
ADD CONSTRAINT "EtapaRoteiro_operacaoId_fkey"
FOREIGN KEY ("operacaoId")
REFERENCES "public"."Operacao" ("id");

ALTER TABLE "public"."EventoTempo"
ADD CONSTRAINT "EventoTempo_execucaoId_fkey"
FOREIGN KEY ("execucaoId")
REFERENCES "public"."Execucao" ("id");

ALTER TABLE "public"."EventoTempo"
ADD CONSTRAINT "EventoTempo_motivoPausaId_fkey"
FOREIGN KEY ("motivoPausaId")
REFERENCES "public"."MotivoPausa" ("id");

ALTER TABLE "public"."Execucao"
ADD CONSTRAINT "Execucao_ordemProducaoId_fkey"
FOREIGN KEY ("ordemProducaoId")
REFERENCES "public"."OrdemProducao" ("id");

ALTER TABLE "public"."Execucao"
ADD CONSTRAINT "Execucao_etapaRoteiroId_fkey"
FOREIGN KEY ("etapaRoteiroId")
REFERENCES "public"."EtapaRoteiro" ("id");

ALTER TABLE "public"."Execucao"
ADD CONSTRAINT "Execucao_operadorId_fkey"
FOREIGN KEY ("operadorId")
REFERENCES "public"."Operador" ("id");

ALTER TABLE "public"."Execucao"
ADD CONSTRAINT "Execucao_postoId_fkey"
FOREIGN KEY ("postoId")
REFERENCES "public"."Posto" ("id");

ALTER TABLE "public"."OrdemProducao"
ADD CONSTRAINT "OrdemProducao_planoProducaoId_fkey"
FOREIGN KEY ("planoProducaoId")
REFERENCES "public"."PlanoProducao" ("id");

ALTER TABLE "public"."OrdemProducao"
ADD CONSTRAINT "OrdemProducao_produtoId_fkey"
FOREIGN KEY ("produtoId")
REFERENCES "public"."Produto" ("id");

ALTER TABLE "public"."OrdemProducao"
ADD CONSTRAINT "OrdemProducao_roteiroId_fkey"
FOREIGN KEY ("roteiroId")
REFERENCES "public"."Roteiro" ("id");

ALTER TABLE "public"."Posto"
ADD CONSTRAINT "Posto_setorId_fkey"
FOREIGN KEY ("setorId")
REFERENCES "public"."Setor" ("id");

ALTER TABLE "public"."ProdutoEtapa"
ADD CONSTRAINT "ProdutoEtapa_produtoId_fkey"
FOREIGN KEY ("produtoId")
REFERENCES "public"."Produto" ("id");

ALTER TABLE "public"."ProdutoEtapa"
ADD CONSTRAINT "ProdutoEtapa_etapaRoteiroId_fkey"
FOREIGN KEY ("etapaRoteiroId")
REFERENCES "public"."EtapaRoteiro" ("id");

ALTER TABLE "public"."ProdutoRoteiro"
ADD CONSTRAINT "ProdutoRoteiro_produtoId_fkey"
FOREIGN KEY ("produtoId")
REFERENCES "public"."Produto" ("id");

ALTER TABLE "public"."ProdutoRoteiro"
ADD CONSTRAINT "ProdutoRoteiro_roteiroId_fkey"
FOREIGN KEY ("roteiroId")
REFERENCES "public"."Roteiro" ("id");

COMMIT;
