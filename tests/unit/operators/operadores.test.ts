import test from 'node:test';
import assert from 'node:assert/strict';
import { OperadoresService } from '../../../modules/operators/application/operadores.ts';
import type { OperadorRepository } from '../../../modules/operators/application/contracts.ts';
import { ErroDeOperador, type CadastroOperador, type Operador } from '../../../modules/operators/domain/operador.ts';
import { traduzirErroCriacaoOperador } from '../../../modules/operators/infrastructure/persistence-errors.ts';
import { criarHandlersOperadores } from '../../../modules/operators/presentation/http.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';
import { filtrarOrdenarOperadores, formatarDataCadastro } from '../../../modules/operators/presentation/listing.ts';

class RepositorioEmMemoria implements OperadorRepository {
  operadores: Operador[] = [];
  async listar() { return [...this.operadores]; }
  async buscarPorMatricula(matricula: string) { return this.operadores.find((operador) => operador.matricula === matricula) ?? null; }
  async criar(dados: CadastroOperador) {
    // Simula a constraint atômica: pode falhar mesmo após uma consulta prévia.
    if (this.operadores.some((operador) => operador.matricula === dados.matricula)) {
      return traduzirErroCriacaoOperador({ sqlState: '23505', constraint: 'Operador_matricula_key' });
    }
    const operador: Operador = { id: String(this.operadores.length + 1), ...dados, ativo: true, createdAt: '2026-10-13T12:00:00Z', updatedAt: '2026-10-13T12:00:00Z' };
    this.operadores.push(operador);
    return operador;
  }
}

const post = (corpo: unknown) => new Request('http://localhost/api/operadores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const conflito = (erro: unknown) => erro instanceof ErroDeOperador && erro.codigo === 'CONFLITO';

test('cria ativo, remove só espaços externos e preserva caixa, espaços internos e zeros', async () => {
  const service = new OperadoresService(new RepositorioEmMemoria());
  const operador = await service.criar({ nome: '  João  Silva  ', matricula: '  op-001  ' });
  assert.equal(operador.nome, 'João  Silva');
  assert.equal(operador.matricula, 'op-001');
  assert.equal(operador.ativo, true);
  assert.deepEqual(Object.keys(operador).sort(), ['ativo', 'createdAt', 'id', 'matricula', 'nome', 'updatedAt']);
  await service.criar({ nome: 'João  Silva', matricula: 'OP-001' });
  assert.equal((await service.listar()).length, 2);
});

test('rejeita dados vazios e tipos inválidos, sem impor limites de tamanho novos', async () => {
  const service = new OperadoresService(new RepositorioEmMemoria());
  for (const dados of [{ nome: '', matricula: '01' }, { nome: '  ', matricula: '01' }, { nome: 'Ana', matricula: '\t' }, { nome: 1, matricula: '01' }, { nome: 'Ana', matricula: 1 }]) {
    await assert.rejects(() => service.criar(dados as CadastroOperador), (erro: unknown) => erro instanceof ErroDeOperador && erro.codigo === 'ENTRADA_INVALIDA');
  }
  assert.equal((await service.criar({ nome: 'A'.repeat(200), matricula: '0'.repeat(200) })).matricula.length, 200);
});

test('matrícula de operador inativo continua reservada', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperadoresService(repo);
  const operador = await service.criar({ nome: 'Ana', matricula: '001' });
  operador.ativo = false;
  await assert.rejects(() => service.criar({ nome: 'Bia', matricula: ' 001 ' }), conflito);
  assert.equal((await service.listar()).length, 1);
});

test('duas criações concorrentes da mesma matrícula geram um sucesso e um conflito', async () => {
  const service = new OperadoresService(new RepositorioEmMemoria());
  const resultados = await Promise.allSettled([service.criar({ nome: 'Ana', matricula: '01' }), service.criar({ nome: 'Bia', matricula: '01' })]);
  assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 1);
  const rejeitado = resultados.find((resultado) => resultado.status === 'rejected');
  assert.ok(rejeitado?.status === 'rejected' && conflito(rejeitado.reason));
  assert.equal((await service.listar()).length, 1);
});

test('traduz somente a violação da constraint de matrícula, inclusive na cadeia cause', () => {
  assert.throws(() => traduzirErroCriacaoOperador({ cause: { sqlState: '23505', constraint: 'Operador_matricula_key' } }), conflito);
  assert.throws(() => traduzirErroCriacaoOperador({ code: '23505', constraint: 'Operador_matricula_key' }), conflito);
  for (const erro of [{ sqlState: '23505', constraint: 'Operador_pkey' }, { sqlState: '23503', constraint: 'Operador_matricula_key' }, new Error('Conexão indisponível')]) {
    assert.throws(() => traduzirErroCriacaoOperador(erro), (recebido: unknown) => recebido === erro);
  }
  const ciclo: { cause?: unknown } = {};
  ciclo.cause = ciclo;
  assert.throws(() => traduzirErroCriacaoOperador(ciclo), (recebido: unknown) => recebido === ciclo);
});

test('handlers autorizados criam com 201, listam, negam extras e retornam 409', async () => {
  const handlers = criarHandlersOperadores({ autorizar: async () => ({ id: 'admin' }), operadores: new OperadoresService(new RepositorioEmMemoria()) });
  assert.deepEqual(await (await handlers.GET()).json(), []);
  const criado = await handlers.POST(post({ nome: 'Ana', matricula: '001' }));
  assert.equal(criado.status, 201);
  assert.equal((await criado.json()).ativo, true);
  const lista = await handlers.GET();
  assert.equal(lista.status, 200);
  assert.equal(lista.headers.get('Cache-Control'), 'no-store');
  assert.equal((await lista.json()).length, 1);
  assert.equal((await handlers.POST(post({ nome: 'Ana', matricula: '001' }))).status, 409);
  for (const corpo of [null, [], 'texto', {}, { nome: 10, matricula: '02' }, { nome: 'Bia', matricula: 2 }, { nome: 'Bia', matricula: '' }]) {
    assert.equal((await handlers.POST(post(corpo))).status, 400);
  }
  for (const campo of ['ativo', 'id', 'email', 'senha', 'papel', 'operadorId', 'qr']) {
    assert.equal((await handlers.POST(post({ nome: 'Bia', matricula: '02', [campo]: 'não permitido' }))).status, 400);
  }
  assert.equal((await handlers.POST(new Request('http://localhost/api/operadores', { method: 'POST', body: '{' }))).status, 400);
});

test('handlers bloqueiam sessão ausente/inválida e ADMIN inativo antes da ação', async () => {
  let acessos = 0;
  for (const codigo of ['NAO_AUTENTICADO', 'SEM_AUTORIZACAO'] as const) {
    const handlers = criarHandlersOperadores({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, operadores: { listar: async () => { acessos++; return []; }, criar: async () => { acessos++; throw new Error('Não deve executar'); } } });
    assert.equal((await handlers.GET()).status, codigo === 'NAO_AUTENTICADO' ? 401 : 403);
    assert.equal((await handlers.POST(post({ matricula: 'QR-01', senha: 'credencial-falsa' }))).status, codigo === 'NAO_AUTENTICADO' ? 401 : 403);
  }
  assert.equal(acessos, 0);
});

test('falha inesperada retorna 500 sem expor mensagem de infraestrutura', async () => {
  const handlers = criarHandlersOperadores({ autorizar: async () => undefined, operadores: { listar: async () => { throw new Error('detalhe-interno-nao-publico'); }, criar: async () => { throw new Error('detalhe-interno-nao-publico'); } } });
  for (const resposta of [await handlers.GET(), await handlers.POST(post({ nome: 'Ana', matricula: '01' }))]) {
    assert.equal(resposta.status, 500);
    assert.ok(!(await resposta.text()).includes('detalhe-interno-nao-publico'));
  }
});

test('busca ignora caixa e acentos, filtra status, ordena e não altera a entrada', () => {
  const base = { ativo: true, createdAt: '2026-10-13T12:00:00Z', updatedAt: '2026-10-13T12:00:00Z' };
  const operadores: Operador[] = [{ ...base, id: '1', nome: 'João', matricula: 'op-010' }, { ...base, id: '2', nome: 'Ana', matricula: 'OP-002', ativo: false, createdAt: '2026-10-12T12:00:00Z' }];
  const original = structuredClone(operadores);
  assert.equal(filtrarOrdenarOperadores(operadores, 'JOAO', 'todos', { coluna: 'nome', direcao: 'asc' })[0].id, '1');
  assert.equal(filtrarOrdenarOperadores(operadores, 'op-002', 'inativos', { coluna: 'nome', direcao: 'asc' })[0].id, '2');
  assert.equal(filtrarOrdenarOperadores(operadores, 'inexistente', 'todos', { coluna: 'nome', direcao: 'asc' }).length, 0);
  assert.deepEqual(filtrarOrdenarOperadores(operadores, '', 'todos', { coluna: 'matricula', direcao: 'asc' }).map((item) => item.id), ['2', '1']);
  assert.deepEqual(filtrarOrdenarOperadores(operadores, '', 'todos', { coluna: 'createdAt', direcao: 'desc' }).map((item) => item.id), ['1', '2']);
  assert.deepEqual(filtrarOrdenarOperadores(operadores, '', 'todos', { coluna: 'ativo', direcao: 'asc' }).map((item) => item.id), ['1', '2']);
  assert.deepEqual(operadores, original);
  assert.ok(formatarDataCadastro('2026-10-13T01:00:00Z').includes('12/10/2026'));
});
