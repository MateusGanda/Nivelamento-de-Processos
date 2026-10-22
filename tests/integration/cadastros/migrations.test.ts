import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gerarCodigoSetor } from '../../../modules/sectors/domain/codigo-setor.ts';

// PostgreSQL embarcado opcional, instalado fora das dependências da aplicação.
// GUNP_PGLITE_MODULE aponta ao módulo local; este teste nunca usa DATABASE_URL.
const modulo = process.env.GUNP_PGLITE_MODULE;
type Banco = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};
type Operacao = { id: string; operationClass: string; precheck?: { sql: string; params?: unknown[] }[]; execute: { sql: string; params?: unknown[] }[]; postcheck?: { sql: string; params?: unknown[] }[] };

test('migrations: PostgreSQL isolado preserva cadastros e aplica códigos antes de NOT NULL/UNIQUE', { skip: !modulo }, async () => {
  const { PGlite } = await import(pathToFileURL(modulo!).href) as { PGlite: new () => Banco };
  const db = new PGlite();
  const raiz = new URL('../../../migrations/app/', import.meta.url);
  async function aplicar(pasta: string) {
    const ops = JSON.parse(await readFile(new URL(`${pasta}/ops.json`, raiz), 'utf8')) as Operacao[];
    for (const op of ops) {
      assert.ok(op.operationClass !== 'destructive' || op.id === 'alterNullability.setNotNull.Setor.codigo', 'Somente NOT NULL após backfill pode estreitar o schema: ' + op.id);
      const pre = await Promise.all((op.precheck ?? []).map(async (p) => (await db.query(p.sql, p.params)).rows));
      if (pre.every((rows) => Object.values(rows[0] ?? {}).every((v) => v === true))) {
        for (const passo of op.execute) await db.query(passo.sql, passo.params);
      }
      for (const p of op.postcheck ?? []) {
        const rows = (await db.query(p.sql, p.params)).rows;
        assert.ok(rows.length > 0 && Object.values(rows[0]).every((v) => v === true), p.sql);
      }
    }
  }
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  try {
    await aplicar('20261008T1833_init');
    await aplicar('20261012T2211_add_usuarios_administrativos');
    const nomes = ['Pesponto', 'Pesponto final', 'Pré-costura', 'TI', '123!', 'João', 'Á-ç ã'];
    for (const [n, nome] of nomes.entries()) {
      await db.query('INSERT INTO "Setor" (id, nome, "createdAt") VALUES ($1, $2, $3)', [id(n + 1), nome, '2026-10-01T12:00:00Z']);
    }
    await db.query('INSERT INTO "Operador" (id, matricula, nome, ativo) VALUES ($1, $2, $3, false)', [id(30), '0007', 'Operador Antigo']);
    await db.query('INSERT INTO "Posto" (id, "setorId", codigo, nome) VALUES ($1, $2, $3, $4)', [id(40), id(1), 'POSTO1', 'Posto antigo']);
    await db.query('INSERT INTO "Produto" (id, codigo, nome) VALUES ($1, $2, $3)', [id(50), 'PRD1', 'Produto antigo']);
    await db.query('INSERT INTO "Operacao" (id, nome) VALUES ($1, $2)', [id(51), 'Operação antiga']);
    await db.query('INSERT INTO "Roteiro" (id, nome, versao) VALUES ($1, $2, 1)', [id(52), 'Roteiro antigo']);
    await db.query('INSERT INTO "EtapaRoteiro" (id, "roteiroId", "operacaoId", ordem) VALUES ($1, $2, $3, 1)', [id(53), id(52), id(51)]);
    await db.query('INSERT INTO "PlanoProducao" (id, codigo) VALUES ($1, $2)', [id(54), 'PL1']);
    await db.query('INSERT INTO "OrdemProducao" (id, numero, "planoProducaoId", "produtoId", "roteiroId", quantidade, unidade) VALUES ($1, $2, $3, $4, $5, 10, $6)', [id(55), 'OP1', id(54), id(50), id(52), 'un']);
    await db.query('INSERT INTO "Execucao" (id, "ordemProducaoId", "etapaRoteiroId", "operadorId", "postoId", status) VALUES ($1, $2, $3, $4, $5, $6)', [id(56), id(55), id(53), id(30), id(40), 'EM_EXECUCAO']);
    await db.query('INSERT INTO "EventoTempo" (id, "execucaoId", tipo, "dataHora") VALUES ($1, $2, $3, $4)', [id(57), id(56), 'INICIO', '2026-10-01T12:00:00Z']);
    const antes = (await db.query('SELECT * FROM "Operador"')).rows;
    const execucoesAntes = (await db.query('SELECT * FROM "Execucao"')).rows;
    const eventosAntes = (await db.query('SELECT * FROM "EventoTempo"')).rows;
    const setoresAntes = (await db.query('SELECT * FROM "Setor" ORDER BY "createdAt", id')).rows;
    const novas = (await readdir(raiz)).filter((p) => p.endsWith('_add_setor_codigo') || p.endsWith('_add_operador_setor_funcao')).sort();
    for (const pasta of novas) await aplicar(pasta);
    const setores = (await db.query<{ id: string; nome: string; codigo: string }>('SELECT id, nome, codigo FROM "Setor" ORDER BY "createdAt", id')).rows;
    const reservados: string[] = [];
    for (const setor of setores) {
      assert.equal(setor.codigo, gerarCodigoSetor(setor.nome, reservados));
      reservados.push(setor.codigo);
    }
    const setoresDepois = (await db.query('SELECT * FROM "Setor" ORDER BY "createdAt", id')).rows.map((row) => Object.fromEntries(Object.entries(row).filter(([campo]) => campo !== 'codigo')));
    assert.deepEqual(setoresDepois, setoresAntes);
    const depois = (await db.query('SELECT * FROM "Operador"')).rows.map((row) => Object.fromEntries(Object.entries(row).filter(([campo]) => !['funcao', 'setorPrincipalId'].includes(campo))));
    assert.deepEqual(depois, antes);
    assert.deepEqual((await db.query('SELECT * FROM "Execucao"')).rows, execucoesAntes);
    assert.deepEqual((await db.query('SELECT * FROM "EventoTempo"')).rows, eventosAntes);
    assert.equal((await db.query('SELECT "setorId" FROM "Posto"')).rows[0].setorId, id(1));
    await assert.rejects(() => db.query('INSERT INTO "Setor" (id, nome) VALUES ($1, $2)', [id(80), 'Sem código']));
    await assert.rejects(() => db.query('INSERT INTO "Setor" (id, nome, codigo) VALUES ($1, $2, $3)', [id(81), 'Duplicado', 'PES1']));
    const colunas = (await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='Operador' AND column_name='setorPrincipalId'")).rows;
    if (colunas.length) {
      const legado = (await db.query('SELECT "setorPrincipalId", funcao FROM "Operador"')).rows[0];
      assert.deepEqual(legado, { setorPrincipalId: null, funcao: null });
      await assert.rejects(() => db.query('UPDATE "Operador" SET "setorPrincipalId"=$1 WHERE id=$2', [id(999), id(30)]));
      await db.query('UPDATE "Operador" SET "setorPrincipalId"=$1, funcao=$2 WHERE id=$3', [id(2), 'Costureiro', id(30)]);
      assert.equal((await db.query('SELECT matricula FROM "Operador"')).rows[0].matricula, '0007');
      await assert.rejects(() => db.query('INSERT INTO "Operador" (id, nome, matricula) VALUES ($1, $2, $3)', [id(90), 'Duplicado', '0007']));
      await assert.rejects(() => db.query('DELETE FROM "Setor" WHERE id=$1', [id(2)]));
    }
  } finally { await db.close(); }
});
