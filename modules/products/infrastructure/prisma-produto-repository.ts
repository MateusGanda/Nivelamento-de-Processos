import { db } from '../../../src/prisma/db.ts';
import type { ProdutoRepository } from '../application/contracts.ts';
import type { AlteracaoProduto, CadastroProduto, Produto } from '../domain/produto.ts';
import { traduzirErroGravacaoProduto } from './persistence-errors.ts';

function mapear(produto: Produto): Produto {
  return { id: produto.id, codigo: produto.codigo, nome: produto.nome, ativo: produto.ativo, createdAt: produto.createdAt, updatedAt: produto.updatedAt };
}

export class PrismaProdutoRepository implements ProdutoRepository {
  async listar(): Promise<Produto[]> {
    const produtos = await db.orm.public.Produto.orderBy((produto) => produto.codigo.asc()).all();
    return produtos.map(mapear);
  }

  async buscarPorId(id: string): Promise<Produto | null> {
    const produto = await db.orm.public.Produto.where({ id }).first();
    return produto ? mapear(produto) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Produto | null> {
    const produto = await db.orm.public.Produto.where({ codigo }).first();
    return produto ? mapear(produto) : null;
  }

  async criar(dados: CadastroProduto): Promise<Produto> {
    try {
      return mapear(await db.orm.public.Produto.create({ codigo: dados.codigo, nome: dados.nome, ativo: true }));
    } catch (erro) {
      return traduzirErroGravacaoProduto(erro);
    }
  }

  async alterar(id: string, dados: AlteracaoProduto): Promise<Produto | null> {
    try {
      // O banco só preenche updatedAt na criação; na alteração ele é informado aqui.
      const produto = await db.orm.public.Produto.where({ id }).update({ ...dados, updatedAt: new Date().toISOString() });
      return produto ? mapear(produto) : null;
    } catch (erro) {
      return traduzirErroGravacaoProduto(erro);
    }
  }

  async definirAtivo(id: string, ativo: boolean): Promise<Produto | null> {
    const produto = await db.orm.public.Produto.where({ id }).update({ ativo, updatedAt: new Date().toISOString() });
    return produto ? mapear(produto) : null;
  }
}
