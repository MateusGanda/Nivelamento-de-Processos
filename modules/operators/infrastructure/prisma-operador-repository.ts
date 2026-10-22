import { db } from '../../../src/prisma/db.ts';
import type { OperadorRepository } from '../application/contracts.ts';
import type { AlteracaoOperador, NovoOperador, Operador, SetorPrincipal } from '../domain/operador.ts';
import { traduzirErroCriacaoOperador } from './persistence-errors.ts';

function mapear(operador: Omit<Operador, 'setorPrincipal'> & { setorPrincipal: SetorPrincipal | null }): Operador {
  return {
    id: operador.id, nome: operador.nome, matricula: operador.matricula,
    ativo: operador.ativo, funcao: operador.funcao, setorPrincipal: operador.setorPrincipal,
    createdAt: operador.createdAt, updatedAt: operador.updatedAt,
  };
}

export class PrismaOperadorRepository implements OperadorRepository {
  async listar(): Promise<Operador[]> {
    const operadores = await db.orm.public.Operador.orderBy((operador) => operador.nome.asc())
      .include('setorPrincipal', (setor) => setor.select('id', 'codigo', 'nome')).all();
    return operadores.map(mapear);
  }

  async buscarPorId(id: string): Promise<Operador | null> {
    const operador = await db.orm.public.Operador.where({ id })
      .include('setorPrincipal', (setor) => setor.select('id', 'codigo', 'nome')).first();
    return operador ? mapear(operador) : null;
  }

  async buscarSetorPrincipal(id: string): Promise<SetorPrincipal | null> {
    return db.orm.public.Setor.where({ id }).select('id', 'codigo', 'nome').first();
  }

  async matriculasReservadas(): Promise<string[]> {
    return (await db.orm.public.Operador.select('matricula').all()).map((operador) => operador.matricula);
  }

  async criar(dados: NovoOperador): Promise<Operador> {
    try {
      return await db.transaction(async (tx) => {
        const criado = await tx.orm.public.Operador.create({
          nome: dados.nome, matricula: dados.matricula, funcao: dados.funcao,
          setorPrincipalId: dados.setorPrincipalId, ativo: true,
        });
        const registro = await tx.orm.public.Operador.where({ id: criado.id })
          .include('setorPrincipal', (setor) => setor.select('id', 'codigo', 'nome')).first();
        if (!registro) throw new Error('Operador criado não encontrado.');
        return mapear(registro);
      });
    } catch (erro) { return traduzirErroCriacaoOperador(erro); }
  }

  async alterar(id: string, dados: AlteracaoOperador): Promise<Operador | null> {
    try {
      return await db.transaction(async (tx) => {
        const alterado = await tx.orm.public.Operador.where({ id }).update({ ...dados, updatedAt: new Date().toISOString() });
        if (!alterado) return null;
        const registro = await tx.orm.public.Operador.where({ id })
          .include('setorPrincipal', (setor) => setor.select('id', 'codigo', 'nome')).first();
        if (!registro) throw new Error('Operador alterado não encontrado.');
        return mapear(registro);
      });
    } catch (erro) { return traduzirErroCriacaoOperador(erro); }
  }
}
