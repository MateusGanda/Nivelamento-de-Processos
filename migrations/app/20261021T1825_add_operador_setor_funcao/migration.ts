#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6507e3fa65abcbf7b1dc0bd72285c300577ac65f833cd0606497475ffe88b1a1/contract';
import endContract from '../../snapshots/6507e3fa65abcbf7b1dc0bd72285c300577ac65f833cd0606497475ffe88b1a1/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d72a468e7b876086cad3a2dc20a65b021a740aa45bf9ac28706cc01f19a6a54d/contract';
import startContract from '../../snapshots/d72a468e7b876086cad3a2dc20a65b021a740aa45bf9ac28706cc01f19a6a54d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Operador',
        column: col('funcao', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Operador',
        column: col('setorPrincipalId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Operador',
        index: 'Operador_setorPrincipalId_idx_80dd2e96',
        columns: ['setorPrincipalId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Operador',
        foreignKey: {
          name: 'Operador_setorPrincipalId_fkey',
          columns: ['setorPrincipalId'],
          references: { schema: 'public', table: 'Setor', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
