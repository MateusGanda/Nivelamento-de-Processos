import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import { db } from '../../../src/prisma/db.ts';
import type { OrdemRepository, ProdutoConsultado, RoteiroConsultado } from '../application/contracts.ts';
import { ErroDeOrdem, MENSAGEM_ORDEM_COM_EXECUCOES, type AlteracaoOrdem, type CadastroOrdem, type OpcoesOrdem, type Ordem } from '../domain/ordem.ts';
import { traduzirErroGravacaoOrdem } from './persistence-errors.ts';

// O Prisma devolve e recebe numeric como texto; a conversão fica nesta camada.
function decimal(valor: string): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) throw new Error('Valor decimal inválido no banco.');
  return numero;
}
const quantidadeParaBanco = (valor: number) => valor.toFixed(2) as Numeric<12, 2>;

// O include de uma relação obrigatória vem tipado como possivelmente nulo; a chave
// estrangeira garante o registro, então a ausência é erro de dados.
function relacionado<T>(valor: T | null, relacao: string): T {
  if (valor === null) throw new Error(`Registro relacionado ausente: ${relacao}.`);
  return valor;
}

const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

const consultaOrdens = () => db.orm.public.OrdemProducao
  .select('id', 'numero', 'quantidade', 'unidade', 'planoProducaoId', 'produtoId', 'roteiroId', 'createdAt', 'updatedAt')
  .include('planoProducao', (plano) => plano.select('id', 'codigo'))
  .include('produto', (produto) => produto.select('id', 'codigo', 'nome'))
  .include('roteiro', (roteiro) => roteiro.select('id', 'nome', 'versao'))
  .include('execucoes', (execucoes) => execucoes.count());

type LinhaOrdem = Awaited<ReturnType<ReturnType<typeof consultaOrdens>['all']>>[number];

function mapear(ordem: LinhaOrdem): Ordem {
  return {
    id: ordem.id, numero: ordem.numero, quantidade: decimal(ordem.quantidade), unidade: ordem.unidade,
    plano: relacionado(ordem.planoProducao, 'plano da ordem'),
    produto: relacionado(ordem.produto, 'produto da ordem'),
    roteiro: relacionado(ordem.roteiro, 'roteiro da ordem'),
    quantidadeExecucoes: ordem.execucoes, createdAt: ordem.createdAt, updatedAt: ordem.updatedAt,
  };
}

export class PrismaOrdemRepository implements OrdemRepository {
  async listar(): Promise<Ordem[]> {
    return (await consultaOrdens().orderBy((ordem) => ordem.numero.asc()).all()).map(mapear);
  }

  async buscarPorId(id: string): Promise<Ordem | null> {
    const ordem = await consultaOrdens().where({ id }).first();
    return ordem ? mapear(ordem) : null;
  }

  async existeNumero(numero: string): Promise<boolean> {
    return (await db.orm.public.OrdemProducao.where({ numero }).select('id').first()) !== null;
  }

  async listarOpcoes(): Promise<OpcoesOrdem> {
    const [produtos, ligacoes, roteiros, planos] = await Promise.all([
      db.orm.public.Produto.where({ ativo: true }).select('id', 'codigo', 'nome').all(),
      db.orm.public.ProdutoRoteiro.select('produtoId', 'roteiroId', 'vigente').all(),
      db.orm.public.Roteiro.select('id', 'nome', 'versao', 'ativo').include('etapas', (etapas) => etapas.count()).all(),
      db.orm.public.PlanoProducao.select('id', 'codigo').all(),
    ]);
    const roteiroPorId = new Map(roteiros.map((roteiro) => [roteiro.id, roteiro]));
    return {
      produtos: produtos.map((produto) => ({
        ...produto,
        roteiros: ligacoes.filter((ligacao) => ligacao.produtoId === produto.id).map((ligacao) => {
          const roteiro = relacionado(roteiroPorId.get(ligacao.roteiroId) ?? null, 'roteiro do produto');
          return { id: roteiro.id, nome: roteiro.nome, versao: roteiro.versao, vigente: ligacao.vigente, ativo: roteiro.ativo, quantidadeEtapas: roteiro.etapas };
        }).sort((a, b) => Number(b.vigente) - Number(a.vigente) || b.versao - a.versao),
      })).sort((a, b) => collation.compare(a.codigo, b.codigo)),
      planos: planos.sort((a, b) => collation.compare(a.codigo, b.codigo)),
    };
  }

  async existePlano(id: string): Promise<boolean> {
    return (await db.orm.public.PlanoProducao.where({ id }).select('id').first()) !== null;
  }

  async buscarProduto(id: string): Promise<ProdutoConsultado | null> {
    return db.orm.public.Produto.where({ id }).select('id', 'ativo').first();
  }

  async buscarRoteiro(roteiroId: string, produtoId: string): Promise<RoteiroConsultado | null> {
    const [roteiro, ligacao] = await Promise.all([
      db.orm.public.Roteiro.where({ id: roteiroId }).select('id', 'ativo').include('etapas', (etapas) => etapas.count()).first(),
      db.orm.public.ProdutoRoteiro.where({ produtoId, roteiroId }).select('id').first(),
    ]);
    return roteiro ? { id: roteiro.id, ativo: roteiro.ativo, quantidadeEtapas: roteiro.etapas, ligadoAoProduto: ligacao !== null } : null;
  }

  async criar(dados: CadastroOrdem): Promise<Ordem> {
    try {
      const ordem = await db.orm.public.OrdemProducao.create({
        numero: dados.numero, planoProducaoId: dados.planoId, produtoId: dados.produtoId, roteiroId: dados.roteiroId,
        quantidade: quantidadeParaBanco(dados.quantidade), unidade: dados.unidade,
      });
      return relacionado(await this.buscarPorId(ordem.id), 'ordem criada');
    } catch (erro) {
      return traduzirErroGravacaoOrdem(erro);
    }
  }

  async alterar(id: string, dados: AlteracaoOrdem): Promise<Ordem | null> {
    try {
      const alterou = await db.transaction(async (tx) => {
        const t = tx.orm.public;
        const atual = await t.OrdemProducao.where({ id }).select('quantidade', 'unidade').first();
        if (!atual) return false;
        const mudaProducao = (dados.quantidade !== undefined && dados.quantidade !== decimal(atual.quantidade)) ||
          (dados.unidade !== undefined && dados.unidade !== atual.unidade);
        // Repete a verificação dentro da transação: uma execução pode ter começado depois da consulta.
        if (mudaProducao && await t.Execucao.where({ ordemProducaoId: id }).select('id').first()) {
          throw new ErroDeOrdem('CONFLITO', MENSAGEM_ORDEM_COM_EXECUCOES);
        }
        await t.OrdemProducao.where({ id }).update({
          ...(dados.numero !== undefined ? { numero: dados.numero } : {}),
          ...(dados.planoId !== undefined ? { planoProducaoId: dados.planoId } : {}),
          ...(dados.quantidade !== undefined ? { quantidade: quantidadeParaBanco(dados.quantidade) } : {}),
          ...(dados.unidade !== undefined ? { unidade: dados.unidade } : {}),
          updatedAt: new Date().toISOString(),
        });
        return true;
      });
      return alterou ? this.buscarPorId(id) : null;
    } catch (erro) {
      return traduzirErroGravacaoOrdem(erro);
    }
  }
}
