import test from 'node:test';
import assert from 'node:assert/strict';
import { criarAutorizacaoLogin } from '../../../modules/access/presentation/login.ts';
import type { Usuario } from '../../../modules/access/domain/usuario.ts';

const usuario: Usuario = {
  id: '00000000-0000-4000-8000-000000000001', nome: 'Admin de Teste', email: 'admin@teste.local', matricula: 'ADM-1',
  senhaHash: 'hash', papel: 'ADMIN', ativo: true, createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z',
};

function montar(autenticar: (matricula: string, senha: string) => Promise<Usuario | null>) {
  const espera = { vezes: 0 };
  const autorizar = criarAutorizacaoLogin({ autenticar, esperarAposErro: async () => { espera.vezes++; } });
  return { autorizar, espera };
}

test('login correto devolve só os dados da sessão e não espera', async () => {
  const { autorizar, espera } = montar(async (matricula, senha) => (matricula === 'ADM-1' && senha === 'senha-certa' ? usuario : null));
  const sessao = await autorizar({ matricula: 'ADM-1', senha: 'senha-certa' });
  assert.deepEqual(sessao, { id: usuario.id, name: usuario.nome, email: usuario.email, papel: 'ADMIN' });
  assert.equal(espera.vezes, 0);
});

test('senha errada ou matrícula inexistente espera antes de recusar', async () => {
  const { autorizar, espera } = montar(async () => null);
  assert.equal(await autorizar({ matricula: 'ADM-1', senha: 'errada' }), null);
  assert.equal(await autorizar({ matricula: 'NAO-EXISTE', senha: 'qualquer' }), null);
  assert.equal(espera.vezes, 2);
});

test('campos vazios também esperam e não consultam o banco', async () => {
  let consultas = 0;
  const { autorizar, espera } = montar(async () => { consultas++; return null; });
  assert.equal(await autorizar({ matricula: '', senha: 'x' }), null);
  assert.equal(await autorizar(undefined), null);
  assert.equal(consultas, 0);
  assert.equal(espera.vezes, 2);
});

test('falha do banco vira erro genérico, sem detalhes da infraestrutura', async () => {
  const { autorizar } = montar(async () => { throw new Error('connection refused at 10.0.0.1:5432'); });
  await assert.rejects(() => autorizar({ matricula: 'ADM-1', senha: 'x' }), { message: 'AuthenticationUnavailable' });
});

test('a espera padrão dura cerca de 0,8 s', async () => {
  const autorizar = criarAutorizacaoLogin({ autenticar: async () => null });
  const inicio = Date.now();
  await autorizar({ matricula: 'ADM-1', senha: 'errada' });
  assert.ok(Date.now() - inicio >= 750);
});
