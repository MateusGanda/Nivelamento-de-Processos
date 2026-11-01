import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import { db } from '../../../src/prisma/db.ts';
import type { ExecucaoEncontrada, ExecucaoRepository, OperadorEncontrado, SituacaoDestino } from '../application/contracts.ts';
import type { Baixa, Destino, ExecucaoAberta, OrdemDisponivel, StatusExecucao } from '../domain/execucao.ts';
import { traduzirErroGravacaoExecucao } from './persistence-errors.ts';

type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Tabelas = Transacao['orm']['public'];

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

// UPDATE com o estado esperado na própria condição: o PostgreSQL reavalia o WHERE com a linha
// travada, então de dois pedidos simultâneos só um encontra o estado e grava.
type CamposDeEstado = {
  status: StatusExecucao;
  tipoFinalizacao?: 'TROCA_OPERACAO' | 'BAIXA';
  quantidadeBoa?: Numeric<12, 2>;
  quantidadeRetrabalho?: Numeric<12, 2>;
  quantidadeRefugo?: Numeric<12, 2>;
};

async function mudarEstado(tx: Transacao, execucaoId: string, de: 'EM_EXECUCAO' | 'PAUSADA', campos: CamposDeEstado): Promise<boolean> {
  const plano = tx.sql.public.Execucao.update(campos).where((f, fns) => fns.and(fns.eq(f.id, execucaoId), fns.eq(f.status, de))).build();
  return (await tx.execute(plano)).affectedRows === 1;
}

async function abrirExecucao(t: Tabelas, operadorId: string, destino: Destino, agora: string): Promise<string> {
  const execucao = await t.Execucao.create({
    ordemProducaoId: destino.ordemId, etapaRoteiroId: destino.etapaId, operadorId, postoId: destino.postoId, status: 'EM_EXECUCAO',
  });
  await t.EventoTempo.create({ execucaoId: execucao.id, tipo: 'INICIO', dataHora: agora, motivoPausaId: null });
  return execucao.id;
}

export class PrismaExecucaoRepository implements ExecucaoRepository {
  async buscarOperador(matricula: string): Promise<OperadorEncontrado | null> {
    const operador = await db.orm.public.Operador.where({ matricula })
      .select('id', 'matricula', 'nome', 'ativo', 'setorPrincipalId')
      .include('setorPrincipal', (setor) => setor.select('nome'))
      .first();
    return operador ? { id: operador.id, matricula: operador.matricula, nome: operador.nome, ativo: operador.ativo, setor: operador.setorPrincipal?.nome ?? null } : null;
  }

  async buscarExecucaoAberta(operadorId: string): Promise<ExecucaoAberta | null> {
    const execucao = await db.orm.public.Execucao
      .where({ operadorId })
      .where((e) => e.status.neq('FINALIZADA'))
      .select('id', 'status', 'ordemProducaoId', 'etapaRoteiroId', 'postoId')
      .include('ordemProducao', (ordem) => ordem.select('id', 'numero', 'quantidade', 'unidade', 'produtoId').include('produto', (produto) => produto.select('codigo', 'nome')))
      .include('etapaRoteiro', (etapa) => etapa.select('id', 'ordem', 'operacaoId').include('operacao', (operacao) => operacao.select('nome')))
      .include('posto', (posto) => posto.select('id', 'codigo', 'nome'))
      .include('eventosTempo', (eventos) => eventos.select('tipo', 'dataHora', 'motivoPausaId').orderBy((evento) => evento.dataHora.asc()))
      .first();
    if (!execucao || execucao.status === 'FINALIZADA') return null;
    const idsMotivos = [...new Set(execucao.eventosTempo.flatMap((evento) => evento.motivoPausaId ? [evento.motivoPausaId] : []))];
    const motivos = idsMotivos.length === 0 ? [] : await db.orm.public.MotivoPausa.where((motivo) => motivo.id.in(idsMotivos)).select('id', 'nome').all();
    const nomeMotivo = new Map(motivos.map((motivo) => [motivo.id, motivo.nome]));
    const ordem = relacionado(execucao.ordemProducao, 'ordem da execução');
    const etapa = relacionado(execucao.etapaRoteiro, 'etapa da execução');
    return {
      id: execucao.id, status: execucao.status,
      ordem: { id: ordem.id, numero: ordem.numero, quantidade: decimal(ordem.quantidade), unidade: ordem.unidade },
      produto: relacionado(ordem.produto, 'produto da ordem'),
      etapa: { id: etapa.id, ordem: etapa.ordem, operacao: relacionado(etapa.operacao, 'operação da etapa').nome },
      posto: relacionado(execucao.posto, 'posto da execução'),
      eventos: execucao.eventosTempo.map((evento) => ({
        tipo: evento.tipo, dataHora: evento.dataHora, motivo: evento.motivoPausaId ? nomeMotivo.get(evento.motivoPausaId) ?? null : null,
      })),
    };
  }

  async buscarExecucao(id: string): Promise<ExecucaoEncontrada | null> {
    const execucao = await db.orm.public.Execucao.where({ id })
      .select('id', 'operadorId', 'status', 'ordemProducaoId')
      .include('ordemProducao', (ordem) => ordem.select('quantidade'))
      .first();
    return execucao ? {
      id: execucao.id, operadorId: execucao.operadorId, status: execucao.status,
      quantidadeOrdem: decimal(relacionado(execucao.ordemProducao, 'ordem da execução').quantidade),
    } : null;
  }

  async listarOrdensDisponiveis(): Promise<OrdemDisponivel[]> {
    const [ordens, etapas, ligacoes, postos, baixas] = await Promise.all([
      db.orm.public.OrdemProducao.select('id', 'numero', 'quantidade', 'unidade', 'roteiroId', 'produtoId', 'planoProducaoId')
        .include('produto', (produto) => produto.select('codigo', 'nome'))
        .include('planoProducao', (plano) => plano.select('codigo'))
        .all(),
      db.orm.public.EtapaRoteiro.select('id', 'roteiroId', 'ordem', 'operacaoId').include('operacao', (operacao) => operacao.select('nome')).all(),
      db.orm.public.EtapaPosto.select('etapaRoteiroId', 'postoId').all(),
      db.orm.public.Posto.where({ ativo: true }).select('id', 'codigo', 'nome').all(),
      db.orm.public.Execucao.where({ tipoFinalizacao: 'BAIXA' }).select('ordemProducaoId', 'etapaRoteiroId').all(),
    ]);
    const postoPorId = new Map(postos.map((posto) => [posto.id, posto]));
    const baixadas = new Set(baixas.map((baixa) => `${baixa.ordemProducaoId}|${baixa.etapaRoteiroId}`));
    return ordens.map((ordem) => ({
      id: ordem.id, numero: ordem.numero, quantidade: decimal(ordem.quantidade), unidade: ordem.unidade,
      plano: relacionado(ordem.planoProducao, 'plano da ordem').codigo,
      produto: relacionado(ordem.produto, 'produto da ordem'),
      etapas: etapas.filter((etapa) => etapa.roteiroId === ordem.roteiroId).sort((a, b) => a.ordem - b.ordem).map((etapa) => ({
        id: etapa.id, ordem: etapa.ordem, operacao: relacionado(etapa.operacao, 'operação da etapa').nome,
        baixada: baixadas.has(`${ordem.id}|${etapa.id}`),
        // Só postos ativos ligados à etapa podem receber execuções.
        postos: ligacoes.filter((ligacao) => ligacao.etapaRoteiroId === etapa.id).flatMap((ligacao) => postoPorId.get(ligacao.postoId) ?? [])
          .sort((a, b) => collation.compare(a.codigo, b.codigo)),
      })),
    }))
      // Ordem com todas as etapas baixadas já foi concluída e sai da lista da ilha.
      .filter((ordem) => ordem.etapas.some((etapa) => !etapa.baixada))
      .sort((a, b) => collation.compare(a.numero, b.numero));
  }

  async listarMotivosAtivos(): Promise<{ id: string; nome: string }[]> {
    return db.orm.public.MotivoPausa.where({ ativo: true }).select('id', 'nome').orderBy((motivo) => motivo.nome.asc()).all();
  }

  async buscarMotivo(id: string): Promise<{ id: string; ativo: boolean } | null> {
    return db.orm.public.MotivoPausa.where({ id }).select('id', 'ativo').first();
  }

  async conferirDestino(destino: Destino): Promise<SituacaoDestino> {
    const [ordem, etapa, posto, ligacao, baixa] = await Promise.all([
      db.orm.public.OrdemProducao.where({ id: destino.ordemId }).select('roteiroId').first(),
      db.orm.public.EtapaRoteiro.where({ id: destino.etapaId }).select('roteiroId').first(),
      db.orm.public.Posto.where({ id: destino.postoId }).select('ativo').first(),
      db.orm.public.EtapaPosto.where({ etapaRoteiroId: destino.etapaId, postoId: destino.postoId }).select('postoId').first(),
      db.orm.public.Execucao.where({ ordemProducaoId: destino.ordemId, etapaRoteiroId: destino.etapaId, tipoFinalizacao: 'BAIXA' }).select('id').first(),
    ]);
    return {
      ordemExiste: ordem !== null,
      etapaDaOrdem: ordem !== null && etapa !== null && etapa.roteiroId === ordem.roteiroId,
      etapaBaixada: baixa !== null,
      posto: posto ? { ativo: posto.ativo, compativel: ligacao !== null } : null,
    };
  }

  async iniciar(operadorId: string, destino: Destino, agora: string): Promise<string> {
    try {
      return await db.transaction((tx) => abrirExecucao(tx.orm.public, operadorId, destino, agora));
    } catch (erro) {
      return traduzirErroGravacaoExecucao(erro);
    }
  }

  async pausar(execucaoId: string, motivoId: string, agora: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const t = tx.orm.public;
      // Grava só se ainda estiver em execução: um segundo pedido igual não pausa de novo.
      if (!await mudarEstado(tx, execucaoId, 'EM_EXECUCAO', { status: 'PAUSADA' })) return false;
      await t.EventoTempo.create({ execucaoId, tipo: 'PAUSA', dataHora: agora, motivoPausaId: motivoId });
      return true;
    });
  }

  async retomar(execucaoId: string, agora: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const t = tx.orm.public;
      if (!await mudarEstado(tx, execucaoId, 'PAUSADA', { status: 'EM_EXECUCAO' })) return false;
      await t.EventoTempo.create({ execucaoId, tipo: 'RETOMADA', dataHora: agora, motivoPausaId: null });
      return true;
    });
  }

  async trocar(execucaoId: string, operadorId: string, destino: Destino, agora: string): Promise<string | null> {
    try {
      return await db.transaction(async (tx) => {
        const t = tx.orm.public;
        if (!await mudarEstado(tx, execucaoId, 'EM_EXECUCAO', { status: 'FINALIZADA', tipoFinalizacao: 'TROCA_OPERACAO' })) return null;
        await t.EventoTempo.create({ execucaoId, tipo: 'FINALIZACAO', dataHora: agora, motivoPausaId: null });
        return abrirExecucao(t, operadorId, destino, agora);
      });
    } catch (erro) {
      return traduzirErroGravacaoExecucao(erro);
    }
  }

  async baixar(execucaoId: string, baixa: Baixa, agora: string): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        const t = tx.orm.public;
        const finalizada = await mudarEstado(tx, execucaoId, 'EM_EXECUCAO', {
          status: 'FINALIZADA', tipoFinalizacao: 'BAIXA',
          quantidadeBoa: quantidadeParaBanco(baixa.quantidadeBoa),
          quantidadeRetrabalho: quantidadeParaBanco(baixa.quantidadeRetrabalho),
          quantidadeRefugo: quantidadeParaBanco(baixa.quantidadeRefugo),
        });
        if (!finalizada) return false;
        await t.EventoTempo.create({ execucaoId, tipo: 'FINALIZACAO', dataHora: agora, motivoPausaId: null });
        return true;
      });
    } catch (erro) {
      return traduzirErroGravacaoExecucao(erro);
    }
  }
}
