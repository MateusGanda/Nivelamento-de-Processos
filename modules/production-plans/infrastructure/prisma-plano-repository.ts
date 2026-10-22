import { db } from '../../../src/prisma/db.ts';
import type { PlanoRepository } from '../application/contracts.ts';
import type { AlteracaoPlano, DadosPlano, Plano } from '../domain/plano.ts';
import { traduzirErroGravacaoPlano } from './persistence-errors.ts';

type Linha = Omit<Plano, 'quantidadeOrdens'>;

function mapear(plano: Linha, quantidadeOrdens: number): Plano {
  return {
    id: plano.id, codigo: plano.codigo, descricao: plano.descricao, dataInicio: plano.dataInicio, dataFim: plano.dataFim,
    quantidadeOrdens, createdAt: plano.createdAt, updatedAt: plano.updatedAt,
  };
}

const comOrdens = () => db.orm.public.PlanoProducao.include('ordensProducao', (ordens) => ordens.count());

export class PrismaPlanoRepository implements PlanoRepository {
  async listar(): Promise<Plano[]> {
    const planos = await comOrdens().orderBy((plano) => plano.codigo.asc()).all();
    return planos.map((plano) => mapear(plano, plano.ordensProducao));
  }

  async buscarPorId(id: string): Promise<Plano | null> {
    const plano = await comOrdens().where({ id }).first();
    return plano ? mapear(plano, plano.ordensProducao) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Plano | null> {
    const plano = await comOrdens().where({ codigo }).first();
    return plano ? mapear(plano, plano.ordensProducao) : null;
  }

  async criar(dados: DadosPlano): Promise<Plano> {
    try {
      return mapear(await db.orm.public.PlanoProducao.create(dados), 0);
    } catch (erro) {
      return traduzirErroGravacaoPlano(erro);
    }
  }

  async alterar(id: string, dados: AlteracaoPlano): Promise<Plano | null> {
    try {
      // O banco só preenche updatedAt na criação; na alteração ele é informado aqui.
      const plano = await db.orm.public.PlanoProducao.where({ id }).update({ ...dados, updatedAt: new Date().toISOString() });
      return plano ? this.buscarPorId(id) : null;
    } catch (erro) {
      return traduzirErroGravacaoPlano(erro);
    }
  }
}
