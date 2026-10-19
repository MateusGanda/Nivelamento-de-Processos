import { db } from '../../../src/prisma/db.ts';
import type { PostoRepository } from '../application/contracts.ts';
import type { CadastroPosto, Posto } from '../domain/posto.ts';
import { traduzirErroCriacaoPosto } from './persistence-errors.ts';

type Linha = { id: string; codigo: string; nome: string; ativo: boolean; createdAt: string; updatedAt: string };

function mapear(posto: Linha, setor: { id: string; nome: string } | null): Posto {
  // A chave estrangeira garante o setor; a ausência é erro de dados.
  if (!setor) throw new Error('Setor do posto não encontrado.');
  return {
    id: posto.id, codigo: posto.codigo, nome: posto.nome, ativo: posto.ativo,
    setor: { id: setor.id, nome: setor.nome }, createdAt: posto.createdAt, updatedAt: posto.updatedAt,
  };
}

export class PrismaPostoRepository implements PostoRepository {
  async listar(): Promise<Posto[]> {
    const postos = await db.orm.public.Posto
      .include('setor', (setor) => setor.select('id', 'nome'))
      .orderBy((posto) => posto.codigo.asc())
      .all();
    return postos.map((posto) => mapear(posto, posto.setor));
  }

  async buscarPorCodigo(codigo: string): Promise<Posto | null> {
    const posto = await db.orm.public.Posto.where({ codigo }).include('setor', (setor) => setor.select('id', 'nome')).first();
    return posto ? mapear(posto, posto.setor) : null;
  }

  async buscarSetor(id: string): Promise<{ id: string; nome: string } | null> {
    return db.orm.public.Setor.where({ id }).select('id', 'nome').first();
  }

  async criar(dados: CadastroPosto): Promise<Posto> {
    try {
      const posto = await db.orm.public.Posto.create({ codigo: dados.codigo, nome: dados.nome, setorId: dados.setorId, ativo: true });
      return mapear(posto, await this.buscarSetor(dados.setorId));
    } catch (erro) {
      return traduzirErroCriacaoPosto(erro);
    }
  }
}
