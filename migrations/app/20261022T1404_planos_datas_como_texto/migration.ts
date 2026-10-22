#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0cd2f58a0afa8654847c19a3cfa7990e8b80882d93262714b6646ca1951b699e/contract';
import endContract from '../../snapshots/0cd2f58a0afa8654847c19a3cfa7990e8b80882d93262714b6646ca1951b699e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dae99b37a9f2e5d95a706ae93d1b64e94f15f1f4b19b0e67000805a5579000c4/contract';
import startContract from '../../snapshots/dae99b37a9f2e5d95a706ae93d1b64e94f15f1f4b19b0e67000805a5579000c4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
