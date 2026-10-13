import test from 'node:test';
import assert from 'node:assert/strict';
import { Argon2PasswordHasher } from '../../../modules/access/infrastructure/argon2-password-hasher.ts';

test('armazena senha com Argon2id e verifica somente a senha correta', async () => {
  const hasher = new Argon2PasswordHasher();
  const hash = await hasher.gerar('senha-segura');

  assert.notEqual(hash, 'senha-segura');
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await hasher.verificar(hash, 'senha-segura'), true);
  assert.equal(await hasher.verificar(hash, 'senha-incorreta'), false);
});
