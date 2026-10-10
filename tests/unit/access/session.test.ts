import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { authenticate, createSession, readSession, SESSION_SECONDS } from '../../../modules/access/infrastructure/session.ts';
const salt = '0123456789abcdef0123456789abcdef';
process.env.AUTH_EMAIL = 'teste@gunp.local';
process.env.AUTH_PASSWORD_HASH = `scrypt:${salt}:${scryptSync('senha-de-teste', salt, 64).toString('hex')}`;
process.env.AUTH_SECRET = 'segredo-exclusivo-para-testes-com-mais-de-32-caracteres';
test('valida credenciais e rejeita e-mail ou senha diferentes', async () => {
  assert.equal(await authenticate(' TESTE@GUNP.LOCAL ', 'senha-de-teste'), true);
  assert.equal(await authenticate('outro@gunp.local', 'senha-de-teste'), false);
  assert.equal(await authenticate('teste@gunp.local', 'errada'), false);
});
test('sessão válida expira após oito horas e não aceita adulteração', () => {
  const now = Date.now();
  const token = createSession(now);
  assert.deepEqual(readSession(token, now), { email: 'teste@gunp.local' });
  assert.equal(readSession(token, now + SESSION_SECONDS * 1000), null);
  const [, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ email: 'teste@gunp.local', expires: now + SESSION_SECONDS * 1000 })).toString('base64url');
  assert.equal(readSession(`${forged}x.${signature}`, now), null);
  assert.equal(readSession(`${token}.extra`, now), null);
  assert.equal(readSession(undefined), null);
});
test('sessão é invalidada quando o segredo é trocado', () => {
  const token = createSession();
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'outro-segredo-com-mais-de-32-caracteres-para-testes';
  assert.equal(readSession(token), null);
  process.env.AUTH_SECRET = previous;
});
