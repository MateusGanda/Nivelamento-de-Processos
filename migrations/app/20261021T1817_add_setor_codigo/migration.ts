#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5fde7334195dc549b10382e9f435e10755efc5ea2f95c99ec17771f9bbe59d9d/contract';
import startContract from '../../snapshots/5fde7334195dc549b10382e9f435e10755efc5ea2f95c99ec17771f9bbe59d9d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d72a468e7b876086cad3a2dc20a65b021a740aa45bf9ac28706cc01f19a6a54d/contract';
import endContract from '../../snapshots/d72a468e7b876086cad3a2dc20a65b021a740aa45bf9ac28706cc01f19a6a54d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

// Apenas constrói planos; emitir esta migration não abre conexão ao banco.
const { raw, contract } = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Setor',
        column: col('codigo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-Setor-codigo', {
        check: () => raw.sql`SELECT id FROM public."Setor" WHERE codigo IS NULL LIMIT 1`.returnsRow({ id: 'pg/uuid@1' }),
        run: () => raw.sql`
          WITH bases AS (
            SELECT id, "createdAt",
              COALESCE(NULLIF(left(regexp_replace(normalize(upper(nome), NFD), '[^[:alpha:]]', '', 'g'), 3), ''), 'SET') AS base
            FROM public."Setor"
          ), numerados AS (
            SELECT id, base || row_number() OVER (PARTITION BY base ORDER BY "createdAt", id)::text AS codigo
            FROM bases
          )
          UPDATE public."Setor" AS setor SET codigo = numerados.codigo
          FROM numerados WHERE setor.id = numerados.id AND setor.codigo IS NULL
        `.affectedCount(),
      }),
      this.setNotNull({ schema: 'public', table: 'Setor', column: 'codigo' }),
      this.addUnique({
        schema: 'public',
        table: 'Setor',
        constraint: 'Setor_codigo_key',
        columns: ['codigo'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
