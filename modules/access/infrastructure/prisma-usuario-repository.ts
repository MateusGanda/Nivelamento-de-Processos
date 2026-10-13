import { db } from '../../../src/prisma/db.ts';
import { PAPEL_ADMIN, type Usuario } from '../domain/usuario.ts';
import type { AtualizacaoUsuario, NovoUsuario, UsuarioRepository } from '../application/contracts.ts';

type UsuarioDoBanco = {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  senhaHash: string;
  papel: 'ADMIN';
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapear(usuario: UsuarioDoBanco): Usuario {
  return { ...usuario, papel: PAPEL_ADMIN };
}

export class PrismaUsuarioRepository implements UsuarioRepository {
  async listar(): Promise<Usuario[]> {
    const usuarios = await db.orm.public.Usuario.orderBy((usuario) => usuario.nome.asc()).all();
    return usuarios.map((usuario) => mapear(usuario as UsuarioDoBanco));
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const usuario = await db.orm.public.Usuario.first({ id });
    return usuario ? mapear(usuario as UsuarioDoBanco) : null;
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const usuario = await db.orm.public.Usuario.where({ email }).first();
    return usuario ? mapear(usuario as UsuarioDoBanco) : null;
  }

  async buscarPorMatricula(matricula: string): Promise<Usuario | null> {
    const usuario = await db.orm.public.Usuario.where({ matricula }).first();
    return usuario ? mapear(usuario as UsuarioDoBanco) : null;
  }

  async criar(usuario: NovoUsuario): Promise<Usuario> {
    return mapear(await db.orm.public.Usuario.create({ ...usuario, papel: PAPEL_ADMIN, ativo: true }) as UsuarioDoBanco);
  }

  async atualizar(id: string, dados: AtualizacaoUsuario): Promise<Usuario> {
    return mapear(await db.orm.public.Usuario.where({ id }).update(dados) as UsuarioDoBanco);
  }

  async definirAtivo(id: string, ativo: boolean): Promise<Usuario> {
    return mapear(await db.orm.public.Usuario.where({ id }).update({ ativo }) as UsuarioDoBanco);
  }

  async definirSenhaHash(id: string, senhaHash: string): Promise<Usuario> {
    return mapear(await db.orm.public.Usuario.where({ id }).update({ senhaHash }) as UsuarioDoBanco);
  }

  async contarAdminsAtivos(): Promise<number> {
    return (await db.orm.public.Usuario.where({ ativo: true, papel: PAPEL_ADMIN }).all()).length;
  }
}
