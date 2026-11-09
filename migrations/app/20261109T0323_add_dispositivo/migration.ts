#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/346d135fd2c61440707aa3a6a6a6469962920b7ff24fbc740767858b6eea69bd/contract';
import endContract from '../../snapshots/346d135fd2c61440707aa3a6a6a6469962920b7ff24fbc740767858b6eea69bd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f3205b33a13d5e1ae51bf72ce1037c0bf6b9ba5d058610e405835df987b5eea4/contract';
import startContract from '../../snapshots/f3205b33a13d5e1ae51bf72ce1037c0bf6b9ba5d058610e405835df987b5eea4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Dispositivo',
        columns: [
          col('ativo', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('codigoHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('local', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('setorId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('ultimaConexaoEm', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Dispositivo',
        constraint: 'Dispositivo_nome_key',
        columns: ['nome'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Dispositivo',
        constraint: 'Dispositivo_codigoHash_key',
        columns: ['codigoHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Dispositivo',
        index: 'Dispositivo_setorId_idx_e3349e5c',
        columns: ['setorId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Dispositivo',
        foreignKey: {
          name: 'Dispositivo_setorId_fkey',
          columns: ['setorId'],
          references: { schema: 'public', table: 'Setor', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
