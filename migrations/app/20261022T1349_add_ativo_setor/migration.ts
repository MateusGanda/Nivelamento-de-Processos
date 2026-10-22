#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/72bd4da3a9b4a2614d957d6d0d4ea57a813fa4bfe40252f50103c1fc89ad7428/contract';
import startContract from '../../snapshots/72bd4da3a9b4a2614d957d6d0d4ea57a813fa4bfe40252f50103c1fc89ad7428/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dae99b37a9f2e5d95a706ae93d1b64e94f15f1f4b19b0e67000805a5579000c4/contract';
import endContract from '../../snapshots/dae99b37a9f2e5d95a706ae93d1b64e94f15f1f4b19b0e67000805a5579000c4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Setor',
        column: col('ativo', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
