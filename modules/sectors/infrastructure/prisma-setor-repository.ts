import { db } from '../../../src/prisma/db.ts';
import type { SetorRepository } from '../application/contracts.ts';
import type { DadosSetor, Setor } from '../domain/setor.ts';
import { traduzirErroCriacaoSetor } from './persistence-errors.ts';

function mapear(setor: Setor): Setor {
  return { id: setor.id, nome: setor.nome, descricao: setor.descricao, createdAt: setor.createdAt, updatedAt: setor.updatedAt };
}

export class PrismaSetorRepository implements SetorRepository {
  async listar(): Promise<Setor[]> {
    const setores = await db.orm.public.Setor.orderBy((setor) => setor.nome.asc()).all();
    return setores.map(mapear);
  }

  async buscarPorNome(nome: string): Promise<Setor | null> {
    const setor = await db.orm.public.Setor.where({ nome }).first();
    return setor ? mapear(setor) : null;
  }

  async criar(dados: DadosSetor): Promise<Setor> {
    try {
      return mapear(await db.orm.public.Setor.create({ nome: dados.nome, descricao: dados.descricao }));
    } catch (erro) {
      return traduzirErroCriacaoSetor(erro);
    }
  }
}
