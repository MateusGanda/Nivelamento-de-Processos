#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/346d135fd2c61440707aa3a6a6a6469962920b7ff24fbc740767858b6eea69bd/contract';
import startContract from '../../snapshots/346d135fd2c61440707aa3a6a6a6469962920b7ff24fbc740767858b6eea69bd/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c172ef842aedcf5daa623427d147d0d60dd89caa22dcc58ebb68edfe1011ba7a/contract';
import endContract from '../../snapshots/c172ef842aedcf5daa623427d147d0d60dd89caa22dcc58ebb68edfe1011ba7a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ChaveIlha',
        columns: [
          col('chaveHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('criadaEm', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('criadaPorId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ChaveIlha',
        constraint: 'ChaveIlha_chaveHash_key',
        columns: ['chaveHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChaveIlha',
        index: 'ChaveIlha_criadaEm_idx_f45975f7',
        columns: ['criadaEm'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChaveIlha',
        index: 'ChaveIlha_criadaPorId_idx_27579ca1',
        columns: ['criadaPorId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChaveIlha',
        foreignKey: {
          name: 'ChaveIlha_criadaPorId_fkey',
          columns: ['criadaPorId'],
          references: { schema: 'public', table: 'Usuario', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
