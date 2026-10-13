import { UsuariosService } from './application/usuarios.ts';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.ts';
import { PrismaUsuarioRepository } from './infrastructure/prisma-usuario-repository.ts';

export const usuariosService = new UsuariosService(
  new PrismaUsuarioRepository(),
  new Argon2PasswordHasher(),
);
