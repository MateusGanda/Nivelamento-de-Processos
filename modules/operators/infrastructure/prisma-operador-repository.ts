import { db } from '../../../src/prisma/db.ts';
import type { OperadorRepository } from '../application/contracts.ts';
import type { CadastroOperador, Operador } from '../domain/operador.ts';
import { traduzirErroCriacaoOperador } from './persistence-errors.ts';

function mapear(operador: Operador): Operador {
  return {
    id: operador.id, nome: operador.nome, matricula: operador.matricula,
    ativo: operador.ativo, createdAt: operador.createdAt, updatedAt: operador.updatedAt,
  };
}

export class PrismaOperadorRepository implements OperadorRepository {
  async listar(): Promise<Operador[]> {
    const operadores = await db.orm.public.Operador.orderBy((operador) => operador.nome.asc()).all();
    return operadores.map(mapear);
  }

  async buscarPorMatricula(matricula: string): Promise<Operador | null> {
    const operador = await db.orm.public.Operador.where({ matricula }).first();
    return operador ? mapear(operador) : null;
  }

  async criar(dados: CadastroOperador): Promise<Operador> {
    try {
      return mapear(await db.orm.public.Operador.create({ nome: dados.nome, matricula: dados.matricula, ativo: true }));
    } catch (erro) {
      return traduzirErroCriacaoOperador(erro);
    }
  }
}
