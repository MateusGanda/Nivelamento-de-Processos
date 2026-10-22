import test from 'node:test';
import assert from 'node:assert/strict';
import { SetoresService } from '../../../modules/sectors/application/setores.ts';
import type { SetorRepository } from '../../../modules/sectors/application/contracts.ts';
import { ErroDeSetor, type CadastroSetor, type NovoSetor, type Setor } from '../../../modules/sectors/domain/setor.ts';
import { traduzirErroCriacaoSetor } from '../../../modules/sectors/infrastructure/persistence-errors.ts';
import { criarHandlersSetores } from '../../../modules/sectors/presentation/http.ts';
import { ErroDeAcesso } from '../../../modules/access/domain/usuario.ts';
import { filtrarOrdenarSetores, formatarDataCadastro } from '../../../modules/sectors/presentation/listing.ts';

class RepositorioEmMemoria implements SetorRepository {
  setores: Setor[] = [];
  async listar() { return [...this.setores]; }
  async codigosReservados() { return this.setores.map((setor) => setor.codigo); }
  async buscarPorNome(nome: string) { return this.setores.find((setor) => setor.nome === nome) ?? null; }
  async criar(dados: NovoSetor) {
    // Simula a constraint atômica mesmo quando ambas as consultas prévias não encontram o nome.
    if (this.setores.some((setor) => setor.nome === dados.nome)) {
      return traduzirErroCriacaoSetor({ sqlState: '23505', constraint: 'Setor_nome_key' });
    }
    if (this.setores.some((setor) => setor.codigo === dados.codigo)) {
      return traduzirErroCriacaoSetor({ sqlState: '23505', constraint: 'Setor_codigo_key' });
    }
    const setor: Setor = { id: `00000000-0000-4000-8000-${String(this.setores.length + 1).padStart(12, '0')}`, ...dados, ativo: true, createdAt: '2026-10-13T12:00:00Z', updatedAt: '2026-10-13T12:00:00Z' };
    this.setores.push(setor);
    return setor;
  }
  async definirAtivo(id: string, ativo: boolean) {
    const setor = this.setores.find((item) => item.id === id);
    if (!setor) return null;
    Object.assign(setor, { ativo, updatedAt: '2026-10-22T12:00:00Z' });
    return setor;
  }
}

const post = (corpo: unknown) => new Request('http://localhost/api/setores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const patch = (corpo: unknown) => new Request('http://localhost/api/setores/id/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
const conflito = (erro: unknown) => erro instanceof ErroDeSetor && erro.codigo === 'CONFLITO';

test('setor: trim preserva caixa, acentos e espaços internos, retornando somente o contrato', async () => {
  const service = new SetoresService(new RepositorioEmMemoria());
  const setor = await service.criar({ nome: '  Produção  Final  ', descricao: '  Área  de montagem\nmanual  ' });
  assert.equal(setor.nome, 'Produção  Final');
  assert.equal(setor.descricao, 'Área  de montagem\nmanual');
  assert.deepEqual(Object.keys(setor).sort(), ['ativo', 'codigo', 'createdAt', 'descricao', 'id', 'nome', 'updatedAt']);
  assert.equal(setor.ativo, true);
  await service.criar({ nome: 'produção  Final' });
  assert.equal((await service.listar()).length, 2);
});

test('setor: descrição ausente, nula ou vazia é armazenada como null', async () => {
  const service = new SetoresService(new RepositorioEmMemoria());
  for (const [indice, descricao] of [undefined, null, '', ' \t\n '].entries()) {
    assert.equal((await service.criar({ nome: `Setor ${indice}`, descricao })).descricao, null);
  }
});

test('setor: nome obrigatório e tipos inválidos são rejeitados, sem novos limites de tamanho', async () => {
  const service = new SetoresService(new RepositorioEmMemoria());
  for (const dados of [{ nome: '' }, { nome: ' \t ' }, { nome: null }, { nome: 1 }, { nome: 'Costura', descricao: 1 }, { nome: 'Costura', descricao: false }]) {
    await assert.rejects(() => service.criar(dados as CadastroSetor), (erro: unknown) => erro instanceof ErroDeSetor && erro.codigo === 'ENTRADA_INVALIDA');
  }
  assert.equal((await service.criar({ nome: 'A'.repeat(200), descricao: 'B'.repeat(1000) })).descricao?.length, 1000);
});

test('setor: nome já usado gera conflito após trim, sem substituir sua descrição', async () => {
  const service = new SetoresService(new RepositorioEmMemoria());
  await service.criar({ nome: 'Costura', descricao: 'Original' });
  await assert.rejects(() => service.criar({ nome: ' Costura ', descricao: 'Outra' }), conflito);
  assert.equal((await service.listar())[0].descricao, 'Original');
});

test('setor: criações concorrentes do mesmo nome resultam em um cadastro e um conflito', async () => {
  const service = new SetoresService(new RepositorioEmMemoria());
  const resultados = await Promise.allSettled([service.criar({ nome: 'Costura' }), service.criar({ nome: 'Costura' })]);
  assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 1);
  const rejeitado = resultados.find((resultado) => resultado.status === 'rejected');
  assert.ok(rejeitado?.status === 'rejected' && conflito(rejeitado.reason));
  assert.equal((await service.listar()).length, 1);
});

test('setor: traduz somente SQLSTATE 23505 da constraint de nome, inclusive erro encapsulado', () => {
  assert.throws(() => traduzirErroCriacaoSetor({ cause: { sqlState: '23505', constraint: 'Setor_nome_key' } }), conflito);
  assert.throws(() => traduzirErroCriacaoSetor({ code: '23505', constraint: 'Setor_nome_key' }), conflito);
  for (const erro of [{ sqlState: '23505', constraint: 'Setor_pkey' }, { sqlState: '23503', constraint: 'Setor_nome_key' }, new Error('Falha interna')]) {
    assert.throws(() => traduzirErroCriacaoSetor(erro), (recebido: unknown) => recebido === erro);
  }
  const ciclo: { cause?: unknown } = {};
  ciclo.cause = ciclo;
  assert.throws(() => traduzirErroCriacaoSetor(ciclo), (recebido: unknown) => recebido === ciclo);
});

test('setor: handlers autorizados listam, criam com 201 e retornam 409 para nome duplicado', async () => {
  const handlers = criarHandlersSetores({ autorizar: async () => ({ id: 'admin' }), setores: new SetoresService(new RepositorioEmMemoria()) });
  const vazio = await handlers.GET();
  assert.equal(vazio.status, 200);
  assert.equal(vazio.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await vazio.json(), []);
  const criado = await handlers.POST(post({ nome: 'Costura' }));
  assert.equal(criado.status, 201);
  assert.equal((await criado.json()).descricao, null);
  assert.equal((await handlers.POST(post({ nome: 'Costura' }))).status, 409);
  assert.equal((await handlers.POST(post({ nome: 'Acabamento', descricao: 'Área de revisão' }))).status, 201);
  assert.equal((await handlers.GET()).status, 200);
  assert.equal((await (await handlers.GET()).json()).length, 2);
});

test('setor: JSON inválido, tipos incorretos e campos extras são rejeitados antes da criação', async () => {
  const repo = new RepositorioEmMemoria();
  const handlers = criarHandlersSetores({ autorizar: async () => undefined, setores: new SetoresService(repo) });
  for (const corpo of [null, [], 'texto', {}, { nome: 10 }, { nome: ' ' }, { nome: 'Costura', descricao: [] }, { nome: 'Costura', descricao: true }]) {
    assert.equal((await handlers.POST(post(corpo))).status, 400);
  }
  for (const campo of ['id', 'ativo', 'codigo', 'matricula', 'senha', 'papel', 'operadorId', 'postos', 'createdAt']) {
    assert.equal((await handlers.POST(post({ nome: 'Costura', [campo]: 'não permitido' }))).status, 400);
  }
  assert.equal((await handlers.POST(new Request('http://localhost/api/setores', { method: 'POST', body: '{' }))).status, 400);
  assert.equal(repo.setores.length, 0);
});

test('setor: autorização rejeita sessão ausente/inválida e conta inativa antes de ler ou gravar', async () => {
  let acessos = 0;
  for (const codigo of ['NAO_AUTENTICADO', 'SEM_AUTORIZACAO', 'NAO_ENCONTRADO'] as const) {
    const handlers = criarHandlersSetores({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); }, setores: { listar: async () => { acessos++; return []; }, criar: async () => { acessos++; throw new Error('Não deve executar'); }, definirStatus: async () => { acessos++; throw new Error('Não deve executar'); } } });
    const esperado = { NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404 }[codigo];
    assert.equal((await handlers.GET()).status, esperado);
    assert.equal((await handlers.POST(post({ nome: 'Costura' }))).status, esperado);
    assert.equal((await handlers.PATCH_STATUS(patch({ ativo: false }), '00000000-0000-4000-8000-000000000001')).status, esperado);
  }
  assert.equal(acessos, 0);
});

test('setor: falhas inesperadas de autorização, leitura e escrita retornam 500 sem detalhes internos', async () => {
  const falhar = async (): Promise<never> => { throw new Error('detalhe-interno-nao-publico'); };
  for (const autorizar of [async () => undefined, falhar]) {
    const handlers = criarHandlersSetores({ autorizar, setores: { listar: falhar, criar: falhar, definirStatus: falhar } });
    for (const resposta of [await handlers.GET(), await handlers.POST(post({ nome: 'Costura' }))]) {
      assert.equal(resposta.status, 500);
      assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
    }
  }
});

test('setor: busca por nome/descrição ignora caixa e acentos e ordenação não modifica os dados', () => {
  const base = { createdAt: '2026-10-13T12:00:00Z', updatedAt: '2026-10-13T12:00:00Z' };
  const setores: Setor[] = [{ ...base, id: '1', codigo: 'COS1', nome: 'Costura', descricao: 'Produção', ativo: true }, { ...base, id: '2', codigo: 'ACA1', nome: 'Acabamento', descricao: null, ativo: false, createdAt: '2026-10-12T12:00:00Z' }];
  const original = structuredClone(setores);
  assert.equal(filtrarOrdenarSetores(setores, 'PRODUCAO', { coluna: 'nome', direcao: 'asc' })[0].id, '1');
  assert.equal(filtrarOrdenarSetores(setores, '  COSTURA ', { coluna: 'nome', direcao: 'asc' })[0].id, '1');
  assert.equal(filtrarOrdenarSetores(setores, 'inexistente', { coluna: 'nome', direcao: 'asc' }).length, 0);
  assert.deepEqual(filtrarOrdenarSetores(setores, '', { coluna: 'nome', direcao: 'asc' }).map((item) => item.id), ['2', '1']);
  assert.deepEqual(filtrarOrdenarSetores(setores, '', { coluna: 'nome', direcao: 'desc' }).map((item) => item.id), ['1', '2']);
  assert.deepEqual(filtrarOrdenarSetores(setores, '', { coluna: 'descricao', direcao: 'asc' }).map((item) => item.id), ['2', '1']);
  assert.deepEqual(filtrarOrdenarSetores(setores, '', { coluna: 'createdAt', direcao: 'desc' }).map((item) => item.id), ['1', '2']);
  assert.deepEqual(filtrarOrdenarSetores(setores, '', { coluna: 'nome', direcao: 'asc' }, 'ativos').map((item) => item.id), ['1']);
  assert.deepEqual(filtrarOrdenarSetores(setores, '', { coluna: 'nome', direcao: 'asc' }, 'inativos').map((item) => item.id), ['2']);
  assert.deepEqual(filtrarOrdenarSetores(setores, '', { coluna: 'ativo', direcao: 'asc' }).map((item) => item.id), ['1', '2']);
  assert.deepEqual(setores, original);
  assert.ok(formatarDataCadastro('2026-10-13T01:00:00Z').includes('12/10/2026'));
});

test('setor: inativa e reativa sem mudar código nem nome; handler valida o corpo', async () => {
  const repo = new RepositorioEmMemoria();
  const service = new SetoresService(repo);
  const criado = await service.criar({ nome: 'Pesponto' });
  const inativo = await service.definirStatus(criado.id, false);
  assert.deepEqual([inativo.ativo, inativo.codigo, inativo.nome], [false, criado.codigo, 'Pesponto']);
  assert.equal((await service.definirStatus(criado.id, true)).ativo, true);
  await assert.rejects(() => service.definirStatus('00000000-0000-4000-8000-0000000000ff', false), (erro: unknown) => erro instanceof ErroDeSetor && erro.codigo === 'NAO_ENCONTRADO');
  await assert.rejects(() => service.definirStatus('setor-1', false), (erro: unknown) => erro instanceof ErroDeSetor && erro.codigo === 'NAO_ENCONTRADO');
  const handlers = criarHandlersSetores({ autorizar: async () => ({}), setores: service });
  const resposta = await handlers.PATCH_STATUS(patch({ ativo: false }), criado.id);
  assert.equal(resposta.status, 200);
  assert.equal((await resposta.json()).ativo, false);
  for (const corpo of [{}, { ativo: 'false' }, { ativo: true, codigo: 'X' }, []]) assert.equal((await handlers.PATCH_STATUS(patch(corpo), criado.id)).status, 400);
  assert.equal((await handlers.PATCH_STATUS(patch({ ativo: true }), '00000000-0000-4000-8000-0000000000ff')).status, 404);
  assert.equal(repo.setores[0].ativo, false);
});
