import { db } from '../../../src/prisma/db.ts';
import type { PostoRepository } from '../application/contracts.ts';
import type { AlteracaoPosto, CadastroPosto, Posto } from '../domain/posto.ts';
import { traduzirErroGravacaoPosto } from './persistence-errors.ts';

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

  async buscarPorId(id: string): Promise<Posto | null> {
    const posto = await db.orm.public.Posto.where({ id }).include('setor', (setor) => setor.select('id', 'nome')).first();
    return posto ? mapear(posto, posto.setor) : null;
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
      return traduzirErroGravacaoPosto(erro);
    }
  }

  async alterar(id: string, dados: AlteracaoPosto): Promise<Posto | null> {
    try {
      // O banco só preenche updatedAt na criação; na alteração ele é informado aqui.
      const posto = await db.orm.public.Posto.where({ id }).update({ ...dados, updatedAt: new Date().toISOString() });
      return posto ? this.buscarPorId(id) : null;
    } catch (erro) {
      return traduzirErroGravacaoPosto(erro);
    }
  }

  async definirAtivo(id: string, ativo: boolean): Promise<Posto | null> {
    const posto = await db.orm.public.Posto.where({ id }).update({ ativo, updatedAt: new Date().toISOString() });
    return posto ? this.buscarPorId(id) : null;
  }
}
