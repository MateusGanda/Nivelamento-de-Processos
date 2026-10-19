import { db } from '../../../src/prisma/db.ts';
import type { RoteiroRepository } from '../application/contracts.ts';
import { ErroDeRoteiro, type EtapaInformada, type OperacaoDoRoteiro, type RoteiroDetalhe, type RoteiroResumo } from '../domain/roteiro.ts';
import { traduzirErroGravacaoRoteiro } from './persistence-errors.ts';

// O include de uma relação obrigatória vem tipado como possivelmente nulo; a chave
// estrangeira garante o registro, então a ausência é erro de dados.
function relacionado<T>(valor: T | null, relacao: string): T {
  if (valor === null) throw new Error(`Registro relacionado ausente: ${relacao}.`);
  return valor;
}

const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

export class PrismaRoteiroRepository implements RoteiroRepository {
  async listar(): Promise<RoteiroResumo[]> {
    const roteiros = await db.orm.public.Roteiro
      .include('etapas', (etapas) => etapas.count())
      .include('ordensProducao', (ordens) => ordens.count())
      .all();
    return roteiros
      .map((r) => ({
        id: r.id, nome: r.nome, versao: r.versao, ativo: r.ativo, quantidadeEtapas: r.etapas, quantidadeOrdens: r.ordensProducao,
        createdAt: r.createdAt, updatedAt: r.updatedAt,
      }))
      .sort((a, b) => collation.compare(a.nome, b.nome) || a.versao - b.versao);
  }

  async buscar(id: string): Promise<RoteiroDetalhe | null> {
    const roteiro = await db.orm.public.Roteiro.where({ id }).include('ordensProducao', (ordens) => ordens.count()).first();
    if (!roteiro) return null;
    const [etapas, versoes] = await Promise.all([
      db.orm.public.EtapaRoteiro
        .where({ roteiroId: id })
        .select('id', 'ordem', 'operacaoId')
        .include('operacao', (operacao) => operacao.select('id', 'nome'))
        .orderBy((etapa) => etapa.ordem.asc())
        .all(),
      db.orm.public.Roteiro.where({ nome: roteiro.nome }).select('id', 'versao', 'ativo').orderBy((r) => r.versao.asc()).all(),
    ]);
    const ligacoes = etapas.length === 0 ? [] : await db.orm.public.EtapaPosto
      .where((ligacao) => ligacao.etapaRoteiroId.in(etapas.map((etapa) => etapa.id)))
      .include('posto', (posto) => posto.select('id', 'codigo', 'nome', 'ativo', 'setorId').include('setor', (setor) => setor.select('nome')))
      .all();
    const postosPorEtapa = new Map<string, RoteiroDetalhe['etapas'][number]['postos']>();
    for (const ligacao of ligacoes) {
      const posto = relacionado(ligacao.posto, 'posto da etapa');
      const lista = postosPorEtapa.get(ligacao.etapaRoteiroId) ?? [];
      lista.push({ id: posto.id, codigo: posto.codigo, nome: posto.nome, ativo: posto.ativo, setorNome: relacionado(posto.setor, 'setor do posto').nome });
      postosPorEtapa.set(ligacao.etapaRoteiroId, lista);
    }
    return {
      id: roteiro.id, nome: roteiro.nome, versao: roteiro.versao, ativo: roteiro.ativo,
      quantidadeEtapas: etapas.length, quantidadeOrdens: roteiro.ordensProducao, travado: roteiro.ordensProducao > 0,
      createdAt: roteiro.createdAt, updatedAt: roteiro.updatedAt,
      etapas: etapas.map((etapa) => ({
        id: etapa.id, ordem: etapa.ordem, operacao: relacionado(etapa.operacao, 'operação da etapa'),
        postos: (postosPorEtapa.get(etapa.id) ?? []).sort((a, b) => collation.compare(a.codigo, b.codigo)),
      })),
      versoes,
    };
  }

  async existeNome(nome: string): Promise<boolean> {
    return (await db.orm.public.Roteiro.where({ nome }).select('id').first()) !== null;
  }

  async criar(nome: string): Promise<string> {
    try {
      return (await db.orm.public.Roteiro.create({ nome, versao: 1, ativo: true })).id;
    } catch (erro) {
      return traduzirErroGravacaoRoteiro(erro, 'Já existe um roteiro com esse nome. Abra-o e use Nova versão.');
    }
  }

  async definirAtivo(id: string, ativo: boolean): Promise<boolean> {
    return (await db.orm.public.Roteiro.where({ id }).update({ ativo, updatedAt: new Date().toISOString() })) !== null;
  }

  async listarOperacoes(): Promise<OperacaoDoRoteiro[]> {
    return db.orm.public.Operacao.select('id', 'nome').orderBy((operacao) => operacao.nome.asc()).all();
  }

  async buscarOperacoes(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    return (await db.orm.public.Operacao.where((operacao) => operacao.id.in([...ids])).select('id').all()).map((operacao) => operacao.id);
  }

  async buscarPostos(ids: readonly string[]): Promise<{ id: string; ativo: boolean }[]> {
    if (ids.length === 0) return [];
    return db.orm.public.Posto.where((posto) => posto.id.in([...ids])).select('id', 'ativo').all();
  }

  async substituirEtapas(roteiroId: string, etapas: readonly EtapaInformada[]): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const t = tx.orm.public;
        // Repete a verificação dentro da transação: uma ordem pode ter sido criada depois da consulta.
        if (await t.OrdemProducao.where({ roteiroId }).select('id').first()) {
          throw new ErroDeRoteiro('CONFLITO', 'Este roteiro já tem ordens de produção. Para mudar as etapas, crie uma nova versão.');
        }
        const mantidas = new Set(etapas.flatMap((etapa) => etapa.id ? [etapa.id] : []));
        const removidas = (await t.EtapaRoteiro.where({ roteiroId }).select('id').all()).map((etapa) => etapa.id).filter((id) => !mantidas.has(id));
        if (removidas.length > 0) {
          await t.EtapaPosto.where((ligacao) => ligacao.etapaRoteiroId.in(removidas)).deleteAll();
          await t.ProdutoEtapa.where((tempo) => tempo.etapaRoteiroId.in(removidas)).deleteAll();
          await t.EtapaRoteiro.where((etapa) => etapa.id.in(removidas)).deleteAll();
        }
        // Ordem provisória negativa: evita colidir com a chave (roteiroId, ordem) durante a renumeração.
        for (const [indice, etapa] of etapas.entries()) {
          if (etapa.id) await t.EtapaRoteiro.where({ id: etapa.id }).update({ ordem: -(indice + 1) });
        }
        const agora = new Date().toISOString();
        for (const [indice, etapa] of etapas.entries()) {
          if (etapa.id) await t.EtapaRoteiro.where({ id: etapa.id }).update({ ordem: indice + 1, updatedAt: agora });
          else await t.EtapaRoteiro.create({ roteiroId, operacaoId: etapa.operacaoId, ordem: indice + 1 });
        }
        await t.Roteiro.where({ id: roteiroId }).update({ updatedAt: agora });
      });
    } catch (erro) {
      traduzirErroGravacaoRoteiro(erro);
    }
  }

  async definirPostos(etapaId: string, postoIds: readonly string[]): Promise<void> {
    await db.transaction(async (tx) => {
      const t = tx.orm.public;
      await t.EtapaPosto.where({ etapaRoteiroId: etapaId }).deleteAll();
      for (const postoId of postoIds) await t.EtapaPosto.create({ etapaRoteiroId: etapaId, postoId });
    });
  }

  async criarVersao(roteiroId: string): Promise<string> {
    try {
      return await db.transaction(async (tx) => {
        const t = tx.orm.public;
        const origem = await t.Roteiro.where({ id: roteiroId }).select('nome').first();
        if (!origem) throw new ErroDeRoteiro('NAO_ENCONTRADO', 'Roteiro não encontrado.');
        const versoes = await t.Roteiro.where({ nome: origem.nome }).select('versao').all();
        const nova = await t.Roteiro.create({ nome: origem.nome, versao: Math.max(...versoes.map((r) => r.versao)) + 1, ativo: true });
        const etapas = await t.EtapaRoteiro.where({ roteiroId }).select('id', 'operacaoId', 'ordem').orderBy((etapa) => etapa.ordem.asc()).all();
        const ligacoes = etapas.length === 0 ? [] : await t.EtapaPosto.where((ligacao) => ligacao.etapaRoteiroId.in(etapas.map((etapa) => etapa.id))).all();
        for (const etapa of etapas) {
          const copia = await t.EtapaRoteiro.create({ roteiroId: nova.id, operacaoId: etapa.operacaoId, ordem: etapa.ordem });
          for (const ligacao of ligacoes.filter((item) => item.etapaRoteiroId === etapa.id)) {
            await t.EtapaPosto.create({ etapaRoteiroId: copia.id, postoId: ligacao.postoId });
          }
        }
        return nova.id;
      });
    } catch (erro) {
      return traduzirErroGravacaoRoteiro(erro);
    }
  }
}
