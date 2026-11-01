import { db } from '../../../src/prisma/db.ts';
import type { MotivoPausaRepository } from '../application/contracts.ts';
import type { AlteracaoMotivoPausa, DadosMotivoPausa, MotivoPausa } from '../domain/motivoPausa.ts';
import { traduzirErroGravacaoMotivoPausa } from './persistence-errors.ts';

function mapear(motivoPausa: MotivoPausa): MotivoPausa {
  return { id: motivoPausa.id, nome: motivoPausa.nome, descricao: motivoPausa.descricao, ativo: motivoPausa.ativo, createdAt: motivoPausa.createdAt, updatedAt: motivoPausa.updatedAt };
}

export class PrismaMotivoPausaRepository implements MotivoPausaRepository {
  async listar(): Promise<MotivoPausa[]> {
    return (await db.orm.public.MotivoPausa.orderBy((motivoPausa) => motivoPausa.nome.asc()).all()).map(mapear);
  }

  async buscarPorId(id: string): Promise<MotivoPausa | null> {
    const motivoPausa = await db.orm.public.MotivoPausa.where({ id }).first();
    return motivoPausa ? mapear(motivoPausa) : null;
  }

  async buscarPorNome(nome: string): Promise<MotivoPausa | null> {
    const motivoPausa = await db.orm.public.MotivoPausa.where({ nome }).first();
    return motivoPausa ? mapear(motivoPausa) : null;
  }

  async criar(dados: DadosMotivoPausa): Promise<MotivoPausa> {
    try {
      return mapear(await db.orm.public.MotivoPausa.create({ nome: dados.nome, descricao: dados.descricao, ativo: true }));
    } catch (erro) {
      return traduzirErroGravacaoMotivoPausa(erro);
    }
  }

  async alterar(id: string, dados: AlteracaoMotivoPausa): Promise<MotivoPausa | null> {
    try {
      const motivoPausa = await db.orm.public.MotivoPausa.where({ id }).update({ ...dados, updatedAt: new Date().toISOString() });
      return motivoPausa ? mapear(motivoPausa) : null;
    } catch (erro) {
      return traduzirErroGravacaoMotivoPausa(erro);
    }
  }

  async definirAtivo(id: string, ativo: boolean): Promise<MotivoPausa | null> {
    const motivoPausa = await db.orm.public.MotivoPausa.where({ id }).update({ ativo, updatedAt: new Date().toISOString() });
    return motivoPausa ? mapear(motivoPausa) : null;
  }
}
