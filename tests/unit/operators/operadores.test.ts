import test from 'node:test';
import assert from 'node:assert/strict';
import { OperadoresService } from '../../../modules/operators/application/operadores.ts';
import type { OperadorRepository } from '../../../modules/operators/application/contracts.ts';
import { ErroDeOperador, ErroMatriculaReservada, type AlteracaoOperador, type CadastroOperador, type NovoOperador, type Operador, type SetorPrincipal } from '../../../modules/operators/domain/operador.ts';
import { gerarMatriculaOperador, iniciaisOperador } from '../../../modules/operators/domain/matricula.ts';
import { traduzirErroCriacaoOperador } from '../../../modules/operators/infrastructure/persistence-errors.ts';
import { criarHandlersOperadores } from '../../../modules/operators/presentation/http.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';
import { filtrarOrdenarOperadores, formatarDataCadastro } from '../../../modules/operators/presentation/listing.ts';

const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const setores: SetorPrincipal[] = [{ id: id(1), codigo: 'PES1', nome: 'Pesponto' }, { id: id(2), codigo: 'COS1', nome: 'Costura' }, { id: id(3), codigo: 'ANT1', nome: 'Antigo' }];
const setoresInativos = new Set([id(3)]);
const entrada = (nome = 'Luis Gustavo Nunes dos Santos'): CadastroOperador => ({ nome, setorPrincipalId: id(1) });
const linha = (nome: string, matricula: string, extras: Partial<Operador> = {}): Operador => ({
  id: id(200), nome, matricula, ativo: true, funcao: null, setorPrincipal: null,
  createdAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z', ...extras,
});
class RepositorioEmMemoria implements OperadorRepository {
  operadores: Operador[] = [];
  leituras = 0;
  escritas = 0;
  async listar() { this.leituras++; return [...this.operadores]; }
  async buscarPorId(id: string) { this.leituras++; return this.operadores.find((o) => o.id === id) ?? null; }
  async buscarSetorPrincipal(id: string) { this.leituras++; const setor = setores.find((s) => s.id === id); return setor ? { ...setor, ativo: !setoresInativos.has(id) } : null; }
  async matriculasReservadas() { this.leituras++; return this.operadores.map((o) => o.matricula); }
  async criar(dados: NovoOperador) {
    if (this.operadores.some((o) => o.matricula === dados.matricula)) {
      return traduzirErroCriacaoOperador({ sqlState: '23505', constraint: 'Operador_matricula_key' });
    }
    const operador = linha(dados.nome, dados.matricula, {
      id: id(this.operadores.length + 100), funcao: dados.funcao,
      setorPrincipal: setores.find((s) => s.id === dados.setorPrincipalId) ?? null,
    });
    this.escritas++;
    this.operadores.push(operador);
    return operador;
  }
  async alterar(id: string, dados: AlteracaoOperador) {
    const indice = this.operadores.findIndex((o) => o.id === id);
    if (indice < 0) return null;
    const antigo = this.operadores[indice];
    const alterado = { ...antigo, updatedAt: '2026-10-21T12:00:00Z' };
    if (dados.nome !== undefined) alterado.nome = dados.nome;
    if (dados.funcao !== undefined) alterado.funcao = dados.funcao;
    if (dados.setorPrincipalId !== undefined) alterado.setorPrincipal = setores.find((s) => s.id === dados.setorPrincipalId) ?? null;
    this.operadores[indice] = alterado;
    this.escritas++;
    return alterado;
  }
  comExecucaoAberta = new Set<string>();
  async definirAtivo(id: string, ativo: boolean) {
    const operador = this.operadores.find((o) => o.id === id);
    if (!operador) return null;
    this.escritas++;
    Object.assign(operador, { ativo, updatedAt: '2026-10-22T12:00:00Z' });
    return operador;
  }
  async temExecucaoAberta(id: string) { this.leituras++; return this.comExecucaoAberta.has(id); }
}
const pedido = (method: 'POST' | 'PATCH', corpo: unknown) => new Request('http://localhost/api/operadores', { method, body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } });
const erroCom = (codigo: ErroDeOperador['codigo']) => (erro: unknown) => erro instanceof ErroDeOperador && erro.codigo === codigo;

test('matrícula: iniciais disponíveis, partículas, acentos, quatro palavras e fallback', () => {
  for (const [nome, esperado] of [
    ['Luis Gustavo Nunes Dos Santos', 'LGNS'], ['Ana Silva', 'AS'], ['Ana', 'A'],
    ['João da Silva', 'JS'], ['Álvaro de Sá', 'AS'], ['Ana Beatriz Clara Diana Elisa', 'ABCD'],
    ['de da dos e do', 'DDDE'], ['123!', 'OP'], ['Ana-Maria Silva', 'AMS'],
  ]) assert.equal(iniciaisOperador(nome), esperado);
  assert.equal(gerarMatriculaOperador('Ana Silva', 'PES1', []), 'AS-PES1');
});

test('matrícula: grupos separados por setor e sequência sem limite de três dígitos', () => {
  const nome = 'Luis Gustavo Nunes dos Santos';
  assert.equal(gerarMatriculaOperador(nome, 'PES1', ['LGNS-PES1', 'LGNS3-PES1', 'LGNS99-COS1', 'LGNSX-PES1']), 'LGNS4-PES1');
  assert.equal(gerarMatriculaOperador(nome, 'COS1', ['LGNS-PES1']), 'LGNS-COS1');
  assert.equal(gerarMatriculaOperador(nome, 'PES1', ['LGNS99999999999999999999-PES1']), 'LGNS100000000000000000000-PES1');
});

test('operador: cria ativo com setor, função normalizada e matrícula gerada pelo servidor', async () => {
  const service = new OperadoresService(new RepositorioEmMemoria());
  const o = await service.criar({ nome: '  João  da Silva  ', setorPrincipalId: ' ' + id(1) + ' ', funcao: '  Auxiliar  de produção  ' });
  assert.equal(o.nome, 'João  da Silva');
  assert.equal(o.matricula, 'JS-PES1');
  assert.equal(o.ativo, true);
  assert.equal(o.funcao, 'Auxiliar  de produção');
  assert.deepEqual(o.setorPrincipal, setores[0]);
  assert.deepEqual(Object.keys(o).sort(), ['ativo', 'createdAt', 'funcao', 'id', 'matricula', 'nome', 'setorPrincipal', 'updatedAt']);
});

test('operador: função ausente/vazia/nula é null e nomes não têm novo limite', async () => {
  const service = new OperadoresService(new RepositorioEmMemoria());
  for (const funcao of [undefined, null, '', ' \t ']) assert.equal((await service.criar({ ...entrada(), funcao })).funcao, null);
  assert.equal((await service.criar(entrada('A'.repeat(200)))).nome.length, 200);
});

test('operador: rejeita dados inválidos, setor ausente/nulo/inexistente sem gravar', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperadoresService(repo);
  for (const input of [{}, { ...entrada(), nome: '' }, { ...entrada(), nome: 1 }, { nome: 'Ana' }, { ...entrada(), setorPrincipalId: null }, { ...entrada(), setorPrincipalId: 'PES1' }, { ...entrada(), setorPrincipalId: id(99) }, { ...entrada(), funcao: 2 }]) {
    await assert.rejects(() => service.criar(input as CadastroOperador), erroCom('ENTRADA_INVALIDA'));
  }
  assert.equal(repo.escritas, 0);
});

test('operador: matrícula antiga e de inativo permanecem reservadas; nomes repetidos são permitidos', async () => {
  const repo = new RepositorioEmMemoria();
  repo.operadores.push(linha('Antigo', 'LGNS-PES1', { ativo: false }));
  const service = new OperadoresService(repo);
  assert.equal((await service.criar(entrada())).matricula, 'LGNS2-PES1');
  assert.equal((await service.criar(entrada())).matricula, 'LGNS3-PES1');
  assert.equal(repo.operadores[0].matricula, 'LGNS-PES1');
});

test('operador: duas criações concorrentes com iniciais iguais recalculam a matrícula', async () => {
  const repo = new RepositorioEmMemoria();
  const resultados = await Promise.all([new OperadoresService(repo).criar(entrada()), new OperadoresService(repo).criar(entrada())]);
  assert.deepEqual(resultados.map((o) => o.matricula).sort(), ['LGNS-PES1', 'LGNS2-PES1']);
  assert.equal(repo.escritas, 2);
});

test('operador: limite de dez colisões e falha inesperada não se confundem', async () => {
  const repo = new RepositorioEmMemoria();
  let tentativas = 0;
  repo.criar = async () => { tentativas++; throw new ErroMatriculaReservada(); };
  await assert.rejects(() => new OperadoresService(repo).criar(entrada()), erroCom('CONFLITO'));
  assert.equal(tentativas, 10);
  repo.criar = async () => { tentativas++; throw new Error('Falha de conexão'); };
  await assert.rejects(() => new OperadoresService(repo).criar(entrada()), /Falha de conexão/);
  assert.equal(tentativas, 11);
});

test('operador: transferência e mudança de nome preservam matrícula, criação, status e reserva na origem', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperadoresService(repo);
  const criado = await service.criar(entrada());
  criado.ativo = false;
  const alterado = await service.alterar(criado.id, { nome: ' Outro  Nome ', setorPrincipalId: id(2), funcao: ' Costureiro ' });
  assert.deepEqual([alterado.id, alterado.matricula, alterado.createdAt, alterado.ativo], [criado.id, 'LGNS-PES1', criado.createdAt, false]);
  assert.deepEqual([alterado.nome, alterado.funcao, alterado.setorPrincipal], ['Outro  Nome', 'Costureiro', setores[1]]);
  assert.notEqual(alterado.updatedAt, criado.updatedAt);
  assert.equal((await service.criar(entrada())).matricula, 'LGNS2-PES1');
});

test('operador: cadastro antigo continua sem setor ao editar outros campos e pode ser regularizado', async () => {
  const repo = new RepositorioEmMemoria();
  const antigo = linha('Antigo', 'op-0007', { funcao: 'Antiga' });
  repo.operadores.push(antigo);
  const service = new OperadoresService(repo);
  assert.equal((await service.alterar(antigo.id, { nome: 'Renomeado' })).setorPrincipal, null);
  for (const funcao of [null, '', '  ']) assert.equal((await service.alterar(antigo.id, { funcao })).funcao, null);
  const regularizado = await service.alterar(antigo.id, { setorPrincipalId: id(1) });
  assert.equal(regularizado.matricula, 'op-0007');
  assert.deepEqual(regularizado.setorPrincipal, setores[0]);
});

test('operador: edição rejeita vazio, remoção de setor e inexistência', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperadoresService(repo);
  const criado = await service.criar(entrada());
  for (const dados of [{}, { nome: ' ' }, { setorPrincipalId: null }, { setorPrincipalId: id(99) }, { funcao: false }]) {
    await assert.rejects(() => service.alterar(criado.id, dados as AlteracaoOperador), erroCom('ENTRADA_INVALIDA'));
  }
  for (const idAusente of [id(90), 'invalido']) await assert.rejects(() => service.alterar(idAusente, { nome: 'Outro' }), erroCom('NAO_ENCONTRADO'));
  repo.alterar = async () => null;
  await assert.rejects(() => service.alterar(criado.id, { nome: 'Outro' }), erroCom('NAO_ENCONTRADO'));
});

test('operador: traduz constraints de matrícula e FK, preserva falhas desconhecidas e ciclos', () => {
  assert.throws(() => traduzirErroCriacaoOperador({ cause: { sqlState: '23505', constraint: 'Operador_matricula_key' } }), (e: unknown) => e instanceof ErroMatriculaReservada);
  assert.throws(() => traduzirErroCriacaoOperador({ code: '23505', constraint: 'Operador_matricula_key' }), erroCom('CONFLITO'));
  assert.throws(() => traduzirErroCriacaoOperador({ code: '23503', constraint: 'Operador_setorPrincipalId_fkey' }), erroCom('ENTRADA_INVALIDA'));
  const ciclo: { cause?: unknown } = {}; ciclo.cause = ciclo;
  for (const erro of [ciclo, { sqlState: '23505', constraint: 'Operador_pkey' }, new Error('Conexão indisponível')]) {
    assert.throws(() => traduzirErroCriacaoOperador(erro), (recebido: unknown) => recebido === erro);
  }
});

test('operador: handlers retornam 201/200/404 e rejeitam matrícula/status manual ou JSON inválido', async () => {
  const repo = new RepositorioEmMemoria();
  const handlers = criarHandlersOperadores({ autorizar: async () => ({}), operadores: new OperadoresService(repo) });
  const criado = await handlers.POST(pedido('POST', entrada()));
  assert.equal(criado.status, 201);
  const { id: operadorId, matricula } = await criado.json();
  assert.equal(matricula, 'LGNS-PES1');
  const lista = await handlers.GET();
  assert.equal(lista.headers.get('Cache-Control'), 'no-store');
  assert.equal((await lista.json()).length, 1);
  assert.equal((await handlers.PATCH(pedido('PATCH', { nome: 'Outro' }), operadorId)).status, 200);
  assert.equal((await handlers.PATCH(pedido('PATCH', { nome: 'Outro' }), id(99))).status, 404);
  for (const method of ['POST', 'PATCH'] as const) {
    for (const campo of ['matricula', 'ativo', 'id', 'email', 'senha', 'papel', 'postoId']) {
      const req = pedido(method, { ...entrada(), [campo]: 'proibido' });
      assert.equal((await (method === 'POST' ? handlers.POST(req) : handlers.PATCH(req, operadorId))).status, 400);
    }
    for (const corpo of [null, [], 'texto', {}, { nome: 10 }, { ...entrada(), funcao: 2 }, { ...entrada(), setorPrincipalId: null }]) {
      const req = pedido(method, corpo);
      assert.equal((await (method === 'POST' ? handlers.POST(req) : handlers.PATCH(req, operadorId))).status, 400);
    }
    const invalido = new Request('http://localhost/api/operadores', { method, body: '{' });
    assert.equal((await (method === 'POST' ? handlers.POST(invalido) : handlers.PATCH(invalido, operadorId))).status, 400);
  }
  assert.equal(repo.escritas, 2);
});

test('operador: autorização vem antes de parsing, leitura e escrita em todas as ações', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403], ['NAO_ENCONTRADO', 404]] as const) {
    const repo = new RepositorioEmMemoria();
    const handlers = criarHandlersOperadores({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Negado'); }, operadores: new OperadoresService(repo) });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(pedido('POST', {}))).status, status);
    assert.equal((await handlers.PATCH(pedido('PATCH', {}), id(99))).status, status);
    assert.equal((await handlers.PATCH_STATUS(pedido('PATCH', { ativo: false }), id(99))).status, status);
    assert.equal(repo.leituras + repo.escritas, 0);
  }
});

test('operador: falhas de infraestrutura na autorização ou serviço retornam 500 genérico', async () => {
  const falha = async (): Promise<never> => { throw new Error('detalhe-interno'); };
  for (const autorizar of [falha, async () => ({})]) {
    const handlers = criarHandlersOperadores({ autorizar, operadores: { listar: falha, criar: falha, alterar: falha, definirStatus: falha } });
    for (const resposta of [await handlers.GET(), await handlers.POST(pedido('POST', entrada())), await handlers.PATCH(pedido('PATCH', { funcao: null }), id(99)), await handlers.PATCH_STATUS(pedido('PATCH', { ativo: false }), id(99))]) {
      assert.equal(resposta.status, 500);
      assert.ok(!(await resposta.text()).includes('detalhe-interno'));
    }
  }
});

test('operador: busca por função/setor/código, status e ordenação tratam legado sem alterar entrada', () => {
  const operadores = [
    linha('João', 'JS-PES1', { id: id(1), setorPrincipal: setores[0], funcao: 'Revisão' }),
    linha('Ana', 'op-0007', { id: id(2), ativo: false, createdAt: '2026-10-19T12:00:00Z' }),
  ];
  const copia = structuredClone(operadores);
  for (const busca of ['JOAO', 'revisao', 'Pesponto', 'PES1']) assert.equal(filtrarOrdenarOperadores(operadores, busca, 'todos', { coluna: 'nome', direcao: 'asc' })[0].nome, 'João');
  assert.equal(filtrarOrdenarOperadores(operadores, 'op-0007', 'inativos', { coluna: 'nome', direcao: 'asc' })[0].nome, 'Ana');
  for (const coluna of ['setor', 'funcao', 'createdAt'] as const) assert.equal(filtrarOrdenarOperadores(operadores, '', 'todos', { coluna, direcao: 'asc' })[0].nome, 'Ana');
  assert.equal(filtrarOrdenarOperadores(operadores, '', 'todos', { coluna: 'ativo', direcao: 'asc' })[0].nome, 'João');
  assert.equal(filtrarOrdenarOperadores(operadores, 'inexistente', 'todos', { coluna: 'nome', direcao: 'asc' }).length, 0);
  assert.deepEqual(operadores, copia);
  assert.ok(formatarDataCadastro('2026-10-13T01:00:00Z').includes('12/10/2026'));
});

test('operador: setor inativo não pode ser escolhido, mas o operador que já está nele continua', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperadoresService(repo);
  await assert.rejects(() => service.criar({ nome: 'Ana Souza', setorPrincipalId: id(3) }), (erro: unknown) => erro instanceof ErroDeOperador && erro.codigo === 'ENTRADA_INVALIDA' && /inativo/.test(erro.message));
  repo.operadores.push(linha('Bia Lima', 'BL-ANT1', { id: id(50), setorPrincipal: setores[2] }));
  const mantido = await service.alterar(id(50), { nome: 'Bia Lima Souza', setorPrincipalId: id(3) });
  assert.deepEqual([mantido.nome, mantido.matricula, mantido.setorPrincipal?.id], ['Bia Lima Souza', 'BL-ANT1', id(3)]);
  const operador = await service.criar(entrada('Caio Reis'));
  await assert.rejects(() => service.alterar(operador.id, { setorPrincipalId: id(3) }), (erro: unknown) => erro instanceof ErroDeOperador && /inativo/.test(erro.message));
});

test('operador: inativa e reativa sem mudar matrícula, setor e função', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperadoresService(repo);
  const criado = await service.criar({ ...entrada(), funcao: 'Revisão' });
  const inativo = await service.definirStatus(criado.id, false);
  assert.deepEqual([inativo.ativo, inativo.matricula, inativo.setorPrincipal?.id, inativo.funcao], [false, 'LGNS-PES1', id(1), 'Revisão']);
  assert.equal((await service.definirStatus(criado.id, true)).ativo, true);
  await assert.rejects(() => service.definirStatus(id(99), false), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.definirStatus('abc', false), erroCom('NAO_ENCONTRADO'));
  await assert.rejects(() => service.definirStatus(criado.id, 'nao' as unknown as boolean), erroCom('ENTRADA_INVALIDA'));
});

test('operador: com execução aberta não é inativado, mas pode ser ativado', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new OperadoresService(repo);
  const criado = await service.criar(entrada());
  repo.comExecucaoAberta.add(criado.id);
  const escritas = repo.escritas;
  await assert.rejects(() => service.definirStatus(criado.id, false), (erro: unknown) => erroCom('CONFLITO')(erro) && (erro as Error).message.includes('execução aberta'));
  assert.equal(repo.escritas, escritas);
  assert.equal(repo.operadores[0].ativo, true);
  repo.operadores[0].ativo = false;
  assert.equal((await service.definirStatus(criado.id, true)).ativo, true);
});

test('operador: rota de status aceita somente o campo ativo booleano', async () => {
  const repo = new RepositorioEmMemoria();
  const handlers = criarHandlersOperadores({ autorizar: async () => ({}), operadores: new OperadoresService(repo) });
  const { id: operadorId } = await (await handlers.POST(pedido('POST', entrada()))).json();
  const resposta = await handlers.PATCH_STATUS(pedido('PATCH', { ativo: false }), operadorId);
  assert.equal(resposta.status, 200);
  assert.equal((await resposta.json()).ativo, false);
  for (const corpo of [{}, { ativo: 'false' }, { ativo: null }, { ativo: false, nome: 'X' }, [], null]) {
    assert.equal((await handlers.PATCH_STATUS(pedido('PATCH', corpo), operadorId)).status, 400);
  }
  assert.equal((await handlers.PATCH_STATUS(new Request('http://localhost/api/operadores', { method: 'PATCH', body: '{' }), operadorId)).status, 400);
  assert.equal((await handlers.PATCH_STATUS(pedido('PATCH', { ativo: true }), id(99))).status, 404);
  repo.comExecucaoAberta.add(operadorId);
  await handlers.PATCH_STATUS(pedido('PATCH', { ativo: true }), operadorId);
  const recusa = await handlers.PATCH_STATUS(pedido('PATCH', { ativo: false }), operadorId);
  assert.equal(recusa.status, 409);
  assert.equal((await recusa.json()).erro.codigo, 'CONFLITO');
});
