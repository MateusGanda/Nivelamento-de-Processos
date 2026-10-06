#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/19b624abd11aec698991afc8a69ddd614dd7df0f5684e31a4a669d5ee40353ce/contract';
import endContract from '../../snapshots/19b624abd11aec698991afc8a69ddd614dd7df0f5684e31a4a669d5ee40353ce/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'EtapaPosto',
        columns: [
          col('etapaRoteiroId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('postoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['etapaRoteiroId', 'postoId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'EtapaRoteiro',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('operacaoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ordem', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('roteiroId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'EventoTempo',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dataHora', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('execucaoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('motivoPausaId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('tipo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'EventoTempo_tipo_check_c655f9d0',
            "\"tipo\" IN ('INICIO', 'PAUSA', 'RETOMADA', 'FINALIZACAO')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Execucao',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('etapaRoteiroId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('operadorId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ordemProducaoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('postoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantidadeBoa', 'numeric(12,2)', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
          col('quantidadeRefugo', 'numeric(12,2)', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
          col('quantidadeRetrabalho', 'numeric(12,2)', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Execucao_status_check_03bbbb48',
            "\"status\" IN ('EM_EXECUCAO', 'PAUSADA', 'FINALIZADA')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'MotivoPausa',
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
          col('descricao', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Operacao',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('descricao', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Operador',
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
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('matricula', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'OrdemProducao',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('numero', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('planoProducaoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('produtoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantidade', 'numeric(12,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
          col('roteiroId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('unidade', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'PlanoProducao',
        columns: [
          col('codigo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dataFim', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('dataInicio', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('descricao', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Posto',
        columns: [
          col('ativo', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('codigo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('setorId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Produto',
        columns: [
          col('codigo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ProdutoEtapa',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('etapaRoteiroId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('produtoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('tempoPadrao', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ProdutoRoteiro',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('produtoId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('roteiroId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('vigente', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Roteiro',
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
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('versao', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Setor',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('descricao', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'EtapaRoteiro',
        constraint: 'EtapaRoteiro_roteiroId_ordem_key',
        columns: ['roteiroId', 'ordem'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'MotivoPausa',
        constraint: 'MotivoPausa_nome_key',
        columns: ['nome'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Operacao',
        constraint: 'Operacao_nome_key',
        columns: ['nome'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Operador',
        constraint: 'Operador_matricula_key',
        columns: ['matricula'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'OrdemProducao',
        constraint: 'OrdemProducao_numero_key',
        columns: ['numero'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'PlanoProducao',
        constraint: 'PlanoProducao_codigo_key',
        columns: ['codigo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Posto',
        constraint: 'Posto_codigo_key',
        columns: ['codigo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Produto',
        constraint: 'Produto_codigo_key',
        columns: ['codigo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ProdutoEtapa',
        constraint: 'ProdutoEtapa_produtoId_etapaRoteiroId_key',
        columns: ['produtoId', 'etapaRoteiroId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ProdutoRoteiro',
        constraint: 'ProdutoRoteiro_produtoId_roteiroId_key',
        columns: ['produtoId', 'roteiroId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Roteiro',
        constraint: 'Roteiro_nome_versao_key',
        columns: ['nome', 'versao'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Setor',
        constraint: 'Setor_nome_key',
        columns: ['nome'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EtapaPosto',
        index: 'EtapaPosto_etapaRoteiroId_idx_17d641ff',
        columns: ['etapaRoteiroId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EtapaPosto',
        index: 'EtapaPosto_postoId_idx_13be8f3c',
        columns: ['postoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EtapaRoteiro',
        index: 'EtapaRoteiro_operacaoId_idx_33359931',
        columns: ['operacaoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EtapaRoteiro',
        index: 'EtapaRoteiro_roteiroId_idx_1cd14ed6',
        columns: ['roteiroId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EventoTempo',
        index: 'EventoTempo_execucaoId_dataHora_idx_1b757161',
        columns: ['execucaoId', 'dataHora'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EventoTempo',
        index: 'EventoTempo_execucaoId_idx_a797c763',
        columns: ['execucaoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EventoTempo',
        index: 'EventoTempo_motivoPausaId_idx_82c69795',
        columns: ['motivoPausaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Execucao',
        index: 'Execucao_etapaRoteiroId_idx_17d641ff',
        columns: ['etapaRoteiroId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Execucao',
        index: 'Execucao_operadorId_idx_b7d31568',
        columns: ['operadorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Execucao',
        index: 'Execucao_ordemProducaoId_idx_422138c7',
        columns: ['ordemProducaoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Execucao',
        index: 'Execucao_postoId_idx_13be8f3c',
        columns: ['postoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Execucao',
        index: 'Execucao_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OrdemProducao',
        index: 'OrdemProducao_planoProducaoId_idx_d14976d3',
        columns: ['planoProducaoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OrdemProducao',
        index: 'OrdemProducao_produtoId_idx_eb62fdb9',
        columns: ['produtoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OrdemProducao',
        index: 'OrdemProducao_roteiroId_idx_1cd14ed6',
        columns: ['roteiroId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Posto',
        index: 'Posto_setorId_idx_e3349e5c',
        columns: ['setorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProdutoEtapa',
        index: 'ProdutoEtapa_etapaRoteiroId_idx_17d641ff',
        columns: ['etapaRoteiroId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProdutoEtapa',
        index: 'ProdutoEtapa_produtoId_idx_eb62fdb9',
        columns: ['produtoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProdutoRoteiro',
        index: 'ProdutoRoteiro_produtoId_idx_eb62fdb9',
        columns: ['produtoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProdutoRoteiro',
        index: 'ProdutoRoteiro_roteiroId_idx_1cd14ed6',
        columns: ['roteiroId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EtapaPosto',
        foreignKey: {
          name: 'EtapaPosto_etapaRoteiroId_fkey',
          columns: ['etapaRoteiroId'],
          references: { schema: 'public', table: 'EtapaRoteiro', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EtapaPosto',
        foreignKey: {
          name: 'EtapaPosto_postoId_fkey',
          columns: ['postoId'],
          references: { schema: 'public', table: 'Posto', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EtapaRoteiro',
        foreignKey: {
          name: 'EtapaRoteiro_roteiroId_fkey',
          columns: ['roteiroId'],
          references: { schema: 'public', table: 'Roteiro', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EtapaRoteiro',
        foreignKey: {
          name: 'EtapaRoteiro_operacaoId_fkey',
          columns: ['operacaoId'],
          references: { schema: 'public', table: 'Operacao', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EventoTempo',
        foreignKey: {
          name: 'EventoTempo_execucaoId_fkey',
          columns: ['execucaoId'],
          references: { schema: 'public', table: 'Execucao', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EventoTempo',
        foreignKey: {
          name: 'EventoTempo_motivoPausaId_fkey',
          columns: ['motivoPausaId'],
          references: { schema: 'public', table: 'MotivoPausa', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Execucao',
        foreignKey: {
          name: 'Execucao_ordemProducaoId_fkey',
          columns: ['ordemProducaoId'],
          references: { schema: 'public', table: 'OrdemProducao', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Execucao',
        foreignKey: {
          name: 'Execucao_etapaRoteiroId_fkey',
          columns: ['etapaRoteiroId'],
          references: { schema: 'public', table: 'EtapaRoteiro', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Execucao',
        foreignKey: {
          name: 'Execucao_operadorId_fkey',
          columns: ['operadorId'],
          references: { schema: 'public', table: 'Operador', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Execucao',
        foreignKey: {
          name: 'Execucao_postoId_fkey',
          columns: ['postoId'],
          references: { schema: 'public', table: 'Posto', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OrdemProducao',
        foreignKey: {
          name: 'OrdemProducao_planoProducaoId_fkey',
          columns: ['planoProducaoId'],
          references: { schema: 'public', table: 'PlanoProducao', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OrdemProducao',
        foreignKey: {
          name: 'OrdemProducao_produtoId_fkey',
          columns: ['produtoId'],
          references: { schema: 'public', table: 'Produto', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OrdemProducao',
        foreignKey: {
          name: 'OrdemProducao_roteiroId_fkey',
          columns: ['roteiroId'],
          references: { schema: 'public', table: 'Roteiro', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Posto',
        foreignKey: {
          name: 'Posto_setorId_fkey',
          columns: ['setorId'],
          references: { schema: 'public', table: 'Setor', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProdutoEtapa',
        foreignKey: {
          name: 'ProdutoEtapa_produtoId_fkey',
          columns: ['produtoId'],
          references: { schema: 'public', table: 'Produto', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProdutoEtapa',
        foreignKey: {
          name: 'ProdutoEtapa_etapaRoteiroId_fkey',
          columns: ['etapaRoteiroId'],
          references: { schema: 'public', table: 'EtapaRoteiro', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProdutoRoteiro',
        foreignKey: {
          name: 'ProdutoRoteiro_produtoId_fkey',
          columns: ['produtoId'],
          references: { schema: 'public', table: 'Produto', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProdutoRoteiro',
        foreignKey: {
          name: 'ProdutoRoteiro_roteiroId_fkey',
          columns: ['roteiroId'],
          references: { schema: 'public', table: 'Roteiro', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
