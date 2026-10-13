import * as argon2 from 'argon2';
import type { PasswordHasher } from '../application/contracts.ts';

export class Argon2PasswordHasher implements PasswordHasher {
  async gerar(senha: string): Promise<string> {
    return argon2.hash(senha, { type: argon2.argon2id });
  }

  async verificar(hash: string, senha: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, senha);
    } catch {
      return false;
    }
  }
}
