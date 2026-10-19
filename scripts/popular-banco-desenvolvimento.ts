// Popula um banco de desenvolvimento com uma fábrica fictícia, para testar e demonstrar
// o sistema. Uso: defina SEED_DATABASE_URL no .env com o banco de desenvolvimento
// (nunca o banco do site publicado) e rode `npm run seed:desenvolvimento`.
// Grava tudo numa transação: se algo falhar, nada fica gravado. Se algum registro
// do cenário já existir (mesmo código, nome ou matrícula), não grava nada.
import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import type { Contract } from '../src/prisma/contract.d';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };

const url = process.env.SEED_DATABASE_URL;
if (!url) throw new Error('Defina SEED_DATABASE_URL no .env com o banco de desenvolvimento.');
if (url === process.env.DATABASE_URL) {
  throw new Error('SEED_DATABASE_URL é igual a DATABASE_URL. Use um banco de desenvolvimento, separado do banco do site.');
}
console.log('Banco de destino:', new URL(url).host);

// ----------------------------------------------------------------- cenário
const SETORES = [
  { nome: 'Preparação', descricao: 'Corte e preparação das peças' },
  { nome: 'Montagem', descricao: 'Montagem dos produtos' },
  { nome: 'Acabamento', descricao: 'Acabamento e inspeção final' },
];
const POSTOS = [
  { codigo: 'PRE-01', nome: 'Corte 1', setor: 'Preparação' },
  { codigo: 'PRE-02', nome: 'Corte 2', setor: 'Preparação' },
  { codigo: 'MON-01', nome: 'Montagem 1', setor: 'Montagem' },
  { codigo: 'MON-02', nome: 'Montagem 2', setor: 'Montagem' },
  { codigo: 'ACA-01', nome: 'Acabamento 1', setor: 'Acabamento' },
  { codigo: 'INS-01', nome: 'Inspeção 1', setor: 'Acabamento' },
];
// Postos em que cada operação pode ser feita.
const POSTOS_DA_OPERACAO: Record<string, string[]> = {
  Corte: ['PRE-01', 'PRE-02'],
  Montagem: ['MON-01', 'MON-02'],
  Acabamento: ['ACA-01'],
  Inspeção: ['INS-01'],
};
const OPERACOES = [
  { nome: 'Corte', descricao: 'Corte das peças' },
  { nome: 'Montagem', descricao: 'Montagem das peças' },
  { nome: 'Acabamento', descricao: 'Acabamento superficial' },
  { nome: 'Inspeção', descricao: 'Inspeção de qualidade' },
];
const OPERADORES = [
  { matricula: '1001', nome: 'Operador Fictício 1' },
  { matricula: '1002', nome: 'Operador Fictício 2' },
  { matricula: '1003', nome: 'Operador Fictício 3' },
  { matricula: '1004', nome: 'Operador Fictício 4' },
  { matricula: '1005', nome: 'Operador Fictício 5' },
  { matricula: '1006', nome: 'Operador Fictício 6' },
];
const MOTIVOS = [
  { nome: 'Falta de material', descricao: 'Material não disponível no posto' },
  { nome: 'Ajuste de máquina', descricao: 'Regulagem ou troca de ferramenta' },
  { nome: 'Intervalo', descricao: 'Pausa prevista na jornada' },
  { nome: 'Manutenção', descricao: 'Parada para manutenção' },
];
// Roteiro de cada produto: operações em ordem e tempo padrão em segundos por unidade.
const PRODUTOS = [
  { codigo: 'PRD-001', nome: 'Produto A', roteiro: 'Roteiro do Produto A', etapas: [['Corte', 30], ['Montagem', 120], ['Acabamento', 60], ['Inspeção', 20]] },
  { codigo: 'PRD-002', nome: 'Produto B', roteiro: 'Roteiro do Produto B', etapas: [['Corte', 45], ['Montagem', 90], ['Inspeção', 25]] },
] as const;
// Sem dataInicio e dataFim: o Prisma grava datas como Temporal.PlainDate, que o Node 22 não tem.
const PLANO = { codigo: 'PL-2026-10', descricao: 'Plano fictício de 13 a 24 de outubro de 2026' };
const ORDENS = [
  { numero: 'OP-0001', produto: 'PRD-001', quantidade: 40 },
  { numero: 'OP-0002', produto: 'PRD-002', quantidade: 60 },
  { numero: 'OP-0003', produto: 'PRD-001', quantidade: 25 },
  { numero: 'OP-0004', produto: 'PRD-002', quantidade: 50 },
  { numero: 'OP-0005', produto: 'PRD-001', quantidade: 30 },
  { numero: 'OP-0006', produto: 'PRD-002', quantidade: 80 },
];

type Evento = ['INICIO' | 'PAUSA' | 'RETOMADA' | 'FINALIZACAO', string, string?];
type Apontamento = {
  ordem: string; operacao: string; posto: string; operador: string;
  fim: 'BAIXA' | 'TROCA_OPERACAO' | 'EM_EXECUCAO' | 'PAUSADA';
  quantidades?: [number, number, number];
  eventos: Evento[];
};
// Horários de Brasília, no formato 'dia hora' de outubro de 2026.
const APONTAMENTOS: Apontamento[] = [
  // OP-0001: as quatro etapas baixadas.
  { ordem: 'OP-0001', operacao: 'Corte', posto: 'PRE-01', operador: '1001', fim: 'BAIXA', quantidades: [40, 0, 0], eventos: [['INICIO', '15 08:00'], ['FINALIZACAO', '15 08:25']] },
  { ordem: 'OP-0001', operacao: 'Montagem', posto: 'MON-01', operador: '1002', fim: 'BAIXA', quantidades: [38, 1, 1],
    eventos: [['INICIO', '15 09:00'], ['PAUSA', '15 09:40', 'Ajuste de máquina'], ['RETOMADA', '15 09:50'], ['FINALIZACAO', '15 10:30']] },
  { ordem: 'OP-0001', operacao: 'Acabamento', posto: 'ACA-01', operador: '1003', fim: 'BAIXA', quantidades: [37, 2, 1], eventos: [['INICIO', '15 13:00'], ['FINALIZACAO', '15 13:45']] },
  { ordem: 'OP-0001', operacao: 'Inspeção', posto: 'INS-01', operador: '1004', fim: 'BAIXA', quantidades: [38, 1, 1], eventos: [['INICIO', '16 08:00'], ['FINALIZACAO', '16 08:15']] },
  // OP-0002: corte baixado; na montagem, uma troca de operação e depois a baixa em outro posto.
  { ordem: 'OP-0002', operacao: 'Corte', posto: 'PRE-02', operador: '1001', fim: 'BAIXA', quantidades: [60, 0, 0], eventos: [['INICIO', '16 08:00'], ['FINALIZACAO', '16 08:50']] },
  { ordem: 'OP-0002', operacao: 'Montagem', posto: 'MON-02', operador: '1005', fim: 'TROCA_OPERACAO', eventos: [['INICIO', '16 09:00'], ['FINALIZACAO', '16 09:40']] },
  { ordem: 'OP-0002', operacao: 'Montagem', posto: 'MON-01', operador: '1002', fim: 'BAIXA', quantidades: [57, 2, 1],
    eventos: [['INICIO', '16 10:00'], ['PAUSA', '16 10:50', 'Falta de material'], ['RETOMADA', '16 11:05'], ['FINALIZACAO', '16 11:40']] },
  // OP-0003: corte baixado; montagem em execução.
  { ordem: 'OP-0003', operacao: 'Corte', posto: 'PRE-01', operador: '1001', fim: 'BAIXA', quantidades: [25, 0, 0], eventos: [['INICIO', '17 08:00'], ['FINALIZACAO', '17 08:15']] },
  { ordem: 'OP-0003', operacao: 'Montagem', posto: 'MON-02', operador: '1006', fim: 'EM_EXECUCAO', eventos: [['INICIO', '19 08:00']] },
  // OP-0004: corte baixado; montagem pausada.
  { ordem: 'OP-0004', operacao: 'Corte', posto: 'PRE-02', operador: '1003', fim: 'BAIXA', quantidades: [50, 0, 0], eventos: [['INICIO', '17 09:00'], ['FINALIZACAO', '17 09:40']] },
  { ordem: 'OP-0004', operacao: 'Montagem', posto: 'MON-01', operador: '1005', fim: 'PAUSADA', eventos: [['INICIO', '19 08:30'], ['PAUSA', '19 09:00', 'Intervalo']] },
  // OP-0005 e OP-0006: ainda não iniciadas.
];
// O Prisma recebe numeric como texto decimal com a precisão da coluna.
const quantidade = (valor: number) => String(valor) as Numeric<12, 2>;
const tempoPadrao = (valor: number) => String(valor) as Numeric<10, 2>;
const instante = (diaHora: string) => {
  const [dia, hora] = diaHora.split(' ');
  return new Date(`2026-10-${dia}T${hora}:00-03:00`).toISOString();
};

// Confere o próprio cenário antes de gravar: baixa com soma igual à da ordem e no
// máximo uma execução aberta por operador, como exigem as regras do sistema.
for (const a of APONTAMENTOS) {
  const ordem = ORDENS.find((o) => o.numero === a.ordem);
  if (!ordem) throw new Error(`Ordem inexistente no cenário: ${a.ordem}`);
  if (a.fim === 'BAIXA' && (a.quantidades ?? []).reduce((s, q) => s + q, 0) !== ordem.quantidade) throw new Error(`Soma da baixa diferente da ordem: ${a.ordem} ${a.operacao}`);
  if (!POSTOS_DA_OPERACAO[a.operacao].includes(a.posto)) throw new Error(`Posto não compatível: ${a.posto} em ${a.operacao}`);
}
const abertas = APONTAMENTOS.filter((a) => a.fim === 'EM_EXECUCAO' || a.fim === 'PAUSADA').map((a) => a.operador);
if (new Set(abertas).size !== abertas.length) throw new Error('Operador com duas execuções abertas no cenário.');

// ----------------------------------------------------------------- gravação
const db = postgres<Contract>({ contractJson, url });
try {
  const o = db.orm.public;
  const existentes = (lista: { [k: string]: unknown }[], campo: string, procurados: string[]) =>
    procurados.filter((v) => lista.some((r) => r[campo] === v));
  const [setores, postos, operacoes, operadores, motivos, produtos, planos, ordens, roteiros] = await Promise.all([
    o.Setor.select('nome').all(), o.Posto.select('codigo').all(), o.Operacao.select('nome').all(),
    o.Operador.select('matricula').all(), o.MotivoPausa.select('nome').all(), o.Produto.select('codigo').all(),
    o.PlanoProducao.select('codigo').all(), o.OrdemProducao.select('numero').all(), o.Roteiro.select('nome').all(),
  ]);
  const conflitos = [
    ...existentes(setores, 'nome', SETORES.map((s) => s.nome)).map((v) => `setor ${v}`),
    ...existentes(postos, 'codigo', POSTOS.map((p) => p.codigo)).map((v) => `posto ${v}`),
    ...existentes(operacoes, 'nome', OPERACOES.map((p) => p.nome)).map((v) => `operação ${v}`),
    ...existentes(operadores, 'matricula', OPERADORES.map((p) => p.matricula)).map((v) => `operador ${v}`),
    ...existentes(motivos, 'nome', MOTIVOS.map((p) => p.nome)).map((v) => `motivo de pausa ${v}`),
    ...existentes(produtos, 'codigo', PRODUTOS.map((p) => p.codigo)).map((v) => `produto ${v}`),
    ...existentes(planos, 'codigo', [PLANO.codigo]).map((v) => `plano ${v}`),
    ...existentes(ordens, 'numero', ORDENS.map((p) => p.numero)).map((v) => `ordem ${v}`),
    ...existentes(roteiros, 'nome', PRODUTOS.map((p) => p.roteiro)).map((v) => `roteiro ${v}`),
  ];
  if (conflitos.length > 0) {
    console.error('Nada foi gravado. Já existem no banco:', conflitos.join(', '));
    process.exitCode = 1;
  } else {
    await db.transaction(async (tx) => {
      const t = tx.orm.public;
      const id = new Map<string, string>();
      for (const s of SETORES) id.set(`setor:${s.nome}`, (await t.Setor.create(s)).id);
      for (const p of POSTOS) id.set(`posto:${p.codigo}`, (await t.Posto.create({ codigo: p.codigo, nome: p.nome, setorId: id.get(`setor:${p.setor}`)!, ativo: true })).id);
      for (const op of OPERACOES) id.set(`operacao:${op.nome}`, (await t.Operacao.create(op)).id);
      for (const op of OPERADORES) id.set(`operador:${op.matricula}`, (await t.Operador.create({ ...op, ativo: true })).id);
      for (const m of MOTIVOS) id.set(`motivo:${m.nome}`, (await t.MotivoPausa.create({ ...m, ativo: true })).id);
      const plano = await t.PlanoProducao.create(PLANO);

      for (const p of PRODUTOS) {
        const produto = await t.Produto.create({ codigo: p.codigo, nome: p.nome });
        const roteiro = await t.Roteiro.create({ nome: p.roteiro, versao: 1, ativo: true });
        await t.ProdutoRoteiro.create({ produtoId: produto.id, roteiroId: roteiro.id, vigente: true });
        id.set(`produto:${p.codigo}`, produto.id);
        id.set(`roteiro:${p.codigo}`, roteiro.id);
        for (const [k, [operacao, tempo]] of p.etapas.entries()) {
          const etapa = await t.EtapaRoteiro.create({ roteiroId: roteiro.id, operacaoId: id.get(`operacao:${operacao}`)!, ordem: k + 1 });
          id.set(`etapa:${p.codigo}:${operacao}`, etapa.id);
          await t.ProdutoEtapa.create({ produtoId: produto.id, etapaRoteiroId: etapa.id, tempoPadrao: tempoPadrao(tempo) });
          for (const posto of POSTOS_DA_OPERACAO[operacao]) await t.EtapaPosto.create({ etapaRoteiroId: etapa.id, postoId: id.get(`posto:${posto}`)! });
        }
      }

      for (const ordem of ORDENS) {
        const criada = await t.OrdemProducao.create({
          numero: ordem.numero, planoProducaoId: plano.id, produtoId: id.get(`produto:${ordem.produto}`)!,
          roteiroId: id.get(`roteiro:${ordem.produto}`)!, quantidade: quantidade(ordem.quantidade), unidade: 'un',
        });
        id.set(`ordem:${ordem.numero}`, criada.id);
      }

      for (const a of APONTAMENTOS) {
        const produto = ORDENS.find((ordem) => ordem.numero === a.ordem)!.produto;
        const [boa, retrabalho, refugo] = a.quantidades ?? [0, 0, 0];
        const execucao = await t.Execucao.create({
          ordemProducaoId: id.get(`ordem:${a.ordem}`)!, etapaRoteiroId: id.get(`etapa:${produto}:${a.operacao}`)!,
          operadorId: id.get(`operador:${a.operador}`)!, postoId: id.get(`posto:${a.posto}`)!,
          status: a.fim === 'BAIXA' || a.fim === 'TROCA_OPERACAO' ? 'FINALIZADA' : a.fim,
          tipoFinalizacao: a.fim === 'BAIXA' || a.fim === 'TROCA_OPERACAO' ? a.fim : null,
          quantidadeBoa: a.fim === 'BAIXA' ? quantidade(boa) : null,
          quantidadeRetrabalho: a.fim === 'BAIXA' ? quantidade(retrabalho) : null,
          quantidadeRefugo: a.fim === 'BAIXA' ? quantidade(refugo) : null,
        });
        for (const [tipo, quando, motivo] of a.eventos) {
          await t.EventoTempo.create({ execucaoId: execucao.id, tipo, dataHora: instante(quando), motivoPausaId: motivo ? id.get(`motivo:${motivo}`)! : null });
        }
      }
    });
    console.log(`Gravado: ${SETORES.length} setores, ${POSTOS.length} postos, ${OPERACOES.length} operações, ${OPERADORES.length} operadores, ${MOTIVOS.length} motivos de pausa, ${PRODUTOS.length} produtos com roteiro, 1 plano, ${ORDENS.length} ordens e ${APONTAMENTOS.length} execuções.`);
  }
} finally {
  await db.close();
}
