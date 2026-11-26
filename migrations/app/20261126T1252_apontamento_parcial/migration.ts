#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9f42c351fcf04e3cbcfc642f895a987a6ab4df2b77928e784c9f4375b3af94a4/contract';
import endContract from '../../snapshots/9f42c351fcf04e3cbcfc642f895a987a6ab4df2b77928e784c9f4375b3af94a4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c172ef842aedcf5daa623427d147d0d60dd89caa22dcc58ebb68edfe1011ba7a/contract';
import startContract from '../../snapshots/c172ef842aedcf5daa623427d147d0d60dd89caa22dcc58ebb68edfe1011ba7a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'Execucao',
        constraint: 'Execucao_quantidades_finalizacao_check_1fc31576',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'Execucao',
        constraint: 'Execucao_tipoFinalizacao_check_874252b2',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Execucao',
        constraint: 'Execucao_quantidades_finalizacao_check_5235167e',
        expression:
          '("tipoFinalizacao" IN (\'BAIXA\', \'ENCERRAMENTO_PARCIAL\') AND "quantidadeBoa" IS NOT NULL AND "quantidadeRetrabalho" IS NOT NULL AND "quantidadeRefugo" IS NOT NULL) OR ("tipoFinalizacao" = \'TROCA_OPERACAO\' AND "quantidadeBoa" IS NULL AND "quantidadeRetrabalho" IS NULL AND "quantidadeRefugo" IS NULL) OR ("tipoFinalizacao" IS NULL AND "quantidadeBoa" IS NULL AND "quantidadeRetrabalho" IS NULL AND "quantidadeRefugo" IS NULL)',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Execucao',
        constraint: 'Execucao_tipoFinalizacao_check_2b2a0d4a',
        expression: "\"tipoFinalizacao\" IN ('TROCA_OPERACAO', 'BAIXA', 'ENCERRAMENTO_PARCIAL')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
