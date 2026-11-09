import { db } from '../../../src/prisma/db.ts';
import type { ChaveIlhaRepository, RegistroChaveIlha } from '../application/chave-ilha.ts';

export class PrismaChaveIlhaRepository implements ChaveIlhaRepository {
  private consulta() {
    return db.orm.public.ChaveIlha.select('id', 'chaveHash', 'criadaEm')
      .include('criadaPor', (usuario) => usuario.select('nome'));
  }

  async atual(): Promise<(RegistroChaveIlha & { chaveHash: string }) | null> {
    const linha = await this.consulta().orderBy((c) => c.criadaEm.desc()).first();
    return linha ? { chaveHash: linha.chaveHash, criadaEm: linha.criadaEm, criadaPor: { nome: linha.criadaPor?.nome ?? 'Usuário removido' } } : null;
  }

  async registrar(chaveHash: string, usuarioId: string): Promise<RegistroChaveIlha> {
    const criada = await db.orm.public.ChaveIlha.create({ chaveHash, criadaPorId: usuarioId });
    const linha = (await this.consulta().where({ id: criada.id }).first())!;
    return { criadaEm: linha.criadaEm, criadaPor: { nome: linha.criadaPor?.nome ?? 'Usuário removido' } };
  }
}
