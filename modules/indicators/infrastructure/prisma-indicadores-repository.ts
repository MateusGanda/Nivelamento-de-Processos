import { db } from '../../../src/prisma/db.ts';
import type { IndicadoresRepository, RegistrosDeProducao } from '../application/contracts.ts';

// O Prisma devolve numeric e timestamptz como texto; a conversão fica nesta camada.
function decimal(valor: string): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) throw new Error('Valor decimal inválido no banco.');
  return numero;
}

function decimalOuNulo(valor: string | null): number | null {
  return valor === null ? null : decimal(valor);
}

// O include de uma relação obrigatória vem tipado como possivelmente nulo; a chave
// estrangeira garante o registro, então a ausência é erro de dados.
function relacionado<T>(valor: T | null, relacao: string): T {
  if (valor === null) throw new Error(`Registro relacionado ausente: ${relacao}.`);
  return valor;
}

function instante(valor: string): number {
  const ms = Date.parse(valor);
  if (Number.isNaN(ms)) throw new Error('Data inválida no banco.');
  return ms;
}

/** Lê os registros de produção usados pelos indicadores, somente leitura.
 * Uma consulta por tabela, juntadas em memória pelo caso de uso; adequado ao
 * volume do piloto.
 */
export class PrismaIndicadoresRepository implements IndicadoresRepository {
  async carregarRegistrosDeProducao(): Promise<RegistrosDeProducao> {
    const [ordens, etapas, execucoes, temposPadrao, postos, postosDasEtapas, motivosPausa] = await Promise.all([
      db.orm.public.OrdemProducao
        .select('id', 'numero', 'quantidade', 'unidade', 'roteiroId', 'produtoId', 'planoProducaoId')
        .include('produto', (produto) => produto.select('codigo', 'nome'))
        .include('planoProducao', (plano) => plano.select('codigo'))
        .all(),
      db.orm.public.EtapaRoteiro
        .select('id', 'roteiroId', 'operacaoId', 'ordem')
        .include('operacao', (operacao) => operacao.select('nome'))
        .all(),
      db.orm.public.Execucao
        .select('id', 'ordemProducaoId', 'etapaRoteiroId', 'postoId', 'tipoFinalizacao', 'quantidadeBoa', 'quantidadeRetrabalho', 'quantidadeRefugo')
        .include('eventosTempo', (evento) => evento.select('tipo', 'dataHora', 'motivoPausaId'))
        .all(),
      db.orm.public.ProdutoEtapa.select('produtoId', 'etapaRoteiroId', 'tempoPadrao').all(),
      db.orm.public.Posto
        .select('id', 'codigo', 'nome', 'ativo', 'setorId')
        .include('setor', (setor) => setor.select('nome'))
        .all(),
      db.orm.public.EtapaPosto.select('etapaRoteiroId', 'postoId').all(),
      db.orm.public.MotivoPausa.select('id', 'nome').all(),
    ]);

    return {
      ordens: ordens.map((o) => {
        const produto = relacionado(o.produto, 'produto da ordem');
        return {
          id: o.id,
          numero: o.numero,
          quantidade: decimal(o.quantidade),
          unidade: o.unidade,
          roteiroId: o.roteiroId,
          produtoId: o.produtoId,
          produtoCodigo: produto.codigo,
          produtoNome: produto.nome,
          planoCodigo: relacionado(o.planoProducao, 'plano da ordem').codigo,
        };
      }),
      etapas: etapas.map((e) => ({ id: e.id, roteiroId: e.roteiroId, ordem: e.ordem, operacaoNome: relacionado(e.operacao, 'operação da etapa').nome })),
      execucoes: execucoes.map((e) => ({
        id: e.id,
        ordemProducaoId: e.ordemProducaoId,
        etapaRoteiroId: e.etapaRoteiroId,
        postoId: e.postoId,
        tipoFinalizacao: e.tipoFinalizacao,
        quantidadeBoa: decimalOuNulo(e.quantidadeBoa),
        quantidadeRetrabalho: decimalOuNulo(e.quantidadeRetrabalho),
        quantidadeRefugo: decimalOuNulo(e.quantidadeRefugo),
        eventos: e.eventosTempo.map((t) => ({ tipo: t.tipo, instanteMs: instante(t.dataHora), motivoPausaId: t.motivoPausaId })),
      })),
      temposPadrao: temposPadrao.map((t) => ({ produtoId: t.produtoId, etapaRoteiroId: t.etapaRoteiroId, tempoPadraoSegundos: decimal(t.tempoPadrao) })),
      postos: postos.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome, ativo: p.ativo, setorNome: relacionado(p.setor, 'setor do posto').nome })),
      postosDasEtapas: postosDasEtapas.map((v) => ({ etapaRoteiroId: v.etapaRoteiroId, postoId: v.postoId })),
      motivosPausa: motivosPausa.map((m) => ({ id: m.id, nome: m.nome })),
    };
  }
}
