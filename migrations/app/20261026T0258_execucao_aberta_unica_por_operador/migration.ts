#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0cd2f58a0afa8654847c19a3cfa7990e8b80882d93262714b6646ca1951b699e/contract';
import startContract from '../../snapshots/0cd2f58a0afa8654847c19a3cfa7990e8b80882d93262714b6646ca1951b699e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f3205b33a13d5e1ae51bf72ce1037c0bf6b9ba5d058610e405835df987b5eea4/contract';
import endContract from '../../snapshots/f3205b33a13d5e1ae51bf72ce1037c0bf6b9ba5d058610e405835df987b5eea4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'Execucao',
        index: 'Execucao_operador_aberta_unica_6ac54f96',
        columns: ['operadorId'],
        extras: { where: '("status" <> \'FINALIZADA\')', unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
