#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5fde7334195dc549b10382e9f435e10755efc5ea2f95c99ec17771f9bbe59d9d/contract';
import endContract from '../../snapshots/5fde7334195dc549b10382e9f435e10755efc5ea2f95c99ec17771f9bbe59d9d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b88199d5c182ccd303fcf495e7d223401d7695642a802ebbd1ed1cac8b7c4125/contract';
import startContract from '../../snapshots/b88199d5c182ccd303fcf495e7d223401d7695642a802ebbd1ed1cac8b7c4125/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Usuario',
        columns: [
          col('ativo', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('matricula', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('papel', 'text', {
            notNull: true,
            default: lit('ADMIN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('senhaHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Usuario_papel_check_fd4d17a3', '"papel" IN (\'ADMIN\')'),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Usuario',
        constraint: 'Usuario_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Usuario',
        constraint: 'Usuario_matricula_key',
        columns: ['matricula'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
