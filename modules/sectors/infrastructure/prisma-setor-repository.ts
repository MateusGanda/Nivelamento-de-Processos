import { db } from '../../../src/prisma/db.ts';
import type { SetorRepository } from '../application/contracts.ts';
import type { NovoSetor, Setor } from '../domain/setor.ts';
import { traduzirErroCriacaoSetor } from './persistence-errors.ts';

function mapear(setor: Setor): Setor {
  return { id: setor.id, codigo: setor.codigo, nome: setor.nome, descricao: setor.descricao, ativo: setor.ativo, createdAt: setor.createdAt, updatedAt: setor.updatedAt };
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

  async codigosReservados(): Promise<string[]> {
    return (await db.orm.public.Setor.select('codigo').all()).map((setor) => setor.codigo);
  }

  async criar(dados: NovoSetor): Promise<Setor> {
    try {
      return mapear(await db.orm.public.Setor.create({ codigo: dados.codigo, nome: dados.nome, descricao: dados.descricao, ativo: true }));
    } catch (erro) {
      return traduzirErroCriacaoSetor(erro);
    }
  }

  async definirAtivo(id: string, ativo: boolean): Promise<Setor | null> {
    const setor = await db.orm.public.Setor.where({ id }).update({ ativo, updatedAt: new Date().toISOString() });
    return setor ? mapear(setor) : null;
  }
}
