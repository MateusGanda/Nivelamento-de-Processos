import { db } from '../../../src/prisma/db.ts';
import type { OperacaoRepository } from '../application/contracts.ts';
import type { AlteracaoOperacao, DadosOperacao, Operacao } from '../domain/operacao.ts';
import { traduzirErroGravacaoOperacao } from './persistence-errors.ts';

function mapear(operacao: Operacao): Operacao {
  return { id: operacao.id, nome: operacao.nome, descricao: operacao.descricao, createdAt: operacao.createdAt, updatedAt: operacao.updatedAt };
}

export class PrismaOperacaoRepository implements OperacaoRepository {
  async listar(): Promise<Operacao[]> {
    return (await db.orm.public.Operacao.orderBy((operacao) => operacao.nome.asc()).all()).map(mapear);
  }

  async buscarPorId(id: string): Promise<Operacao | null> {
    const operacao = await db.orm.public.Operacao.where({ id }).first();
    return operacao ? mapear(operacao) : null;
  }

  async buscarPorNome(nome: string): Promise<Operacao | null> {
    const operacao = await db.orm.public.Operacao.where({ nome }).first();
    return operacao ? mapear(operacao) : null;
  }

  async criar(dados: DadosOperacao): Promise<Operacao> {
    try {
      return mapear(await db.orm.public.Operacao.create({ nome: dados.nome, descricao: dados.descricao }));
    } catch (erro) {
      return traduzirErroGravacaoOperacao(erro);
    }
  }

  async alterar(id: string, dados: AlteracaoOperacao): Promise<Operacao | null> {
    try {
      const operacao = await db.orm.public.Operacao.where({ id }).update({ ...dados, updatedAt: new Date().toISOString() });
      return operacao ? mapear(operacao) : null;
    } catch (erro) {
      return traduzirErroGravacaoOperacao(erro);
    }
  }
}
