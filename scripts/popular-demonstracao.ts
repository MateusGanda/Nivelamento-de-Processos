// Prepara os dados de demonstração da banca: uma fábrica de calçados com três semanas de produção.
// Parte do que já existe no banco (setores, postos, operações, produtos, roteiros e motivos de pausa),
// troca o que tinha cara de teste e grava o histórico de ordens e execuções de 03/11 a 19/11/2026.
//
// Uso: defina DEMO_DATABASE_URL com o banco de destino e rode
//   node --experimental-strip-types scripts/popular-demonstracao.ts            (só mostra o que faria)
//   node --experimental-strip-types scripts/popular-demonstracao.ts --gravar   (grava)
// Grava tudo numa transação: se algo falhar, nada fica gravado. Se o plano ou as ordens do cenário
// já existirem, não grava nada. Dos testes antigos, só as ordens de ORDENS_DE_TESTE (com execuções e eventos)
// e o plano de testes são apagados; os demais registros de teste são renomeados ou inativados.
import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Numeric } from '@prisma/orm-postgres/target/codec-types';
import { gerarMatriculaOperador } from '../modules/operators/domain/matricula.ts';
import type { Contract } from '../src/prisma/contract.d';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };

const url = process.env.DEMO_DATABASE_URL;
if (!url) throw new Error('Defina DEMO_DATABASE_URL com o banco de destino.');
const gravar = process.argv.includes('--gravar');
console.log('Banco de destino:', new URL(url).host, gravar ? '— GRAVANDO' : '— simulação (nada será gravado; use --gravar)');

// ----------------------------------------------------------------- cenário
const NOMES_DOS_POSTOS: Record<string, string> = {
  'COR-01': 'Mesa de corte 1', 'COR-02': 'Mesa de corte 2', 'COS-01': 'Máquina de costura 1', 'COS-02': 'Máquina de costura 2',
  'PES-01': 'Máquina de pesponto 1', 'PES-02': 'Máquina de pesponto 2', 'MON-01': 'Esteira de montagem 1', 'MON-02': 'Esteira de montagem 2',
  'ACA-01': 'Bancada de acabamento', 'REV-01': 'Bancada de revisão',
};
// Registros de teste das etapas 8 e 9 apagados a pedido da equipe (22/11/2026): só estas ordens,
// as execuções e eventos delas e o plano de testes. Se o banco tiver algo diferente disso, nada é feito.
const ORDENS_DE_TESTE = ['OP-0001', 'OP-0002', 'OP-0003', 'OP-0004', 'OP-0005', 'OP-0006', 'OP-0007', 'OP-0008', 'OP-TESTE-01', 'OP-TESTE-02'];
const PLANO_DE_TESTE = 'PL-2026-11';
const PRODUTO_RENOMEADO = { codigo: 'PRD-001', nome: 'Sapato Social Masculino', roteiro: 'Calçado fechado' };
const ROTEIRO_DE_TESTE = 'Teste 1';
const OPERADOR_DE_TESTE = 'T-ACA1';
// Tempo padrão do Sapato Social no roteiro Calçado fechado, em segundos por par.
const TEMPOS_SAPATO_SOCIAL: Record<string, number> = { Corte: 45, Pesponto: 240, Montagem: 200, Acabamento: 75, Revisão: 20 };

// Operadores novos: setor principal pelo código e operações que fazem no histórico.
const OPERADORES = [
  { nome: 'Marcos Antônio Ribeiro', setor: 'COR1', funcao: 'Cortador', operacoes: ['Corte'] },
  { nome: 'Juliana Ferreira Lima', setor: 'COR1', funcao: 'Cortadora', operacoes: ['Corte'] },
  { nome: 'Patrícia Gomes Souza', setor: 'COS1', funcao: 'Costureira', operacoes: ['Costura'] },
  { nome: 'Rosângela Alves Martins', setor: 'COS1', funcao: 'Costureira', operacoes: ['Costura'] },
  { nome: 'Cláudia Regina Santos', setor: 'PES1', funcao: 'Pespontadeira', operacoes: ['Pesponto'] },
  { nome: 'Edson Luiz Pereira', setor: 'PES1', funcao: 'Pespontador', operacoes: ['Pesponto'] },
  { nome: 'Rafael Henrique Costa', setor: 'MON1', funcao: 'Montador', operacoes: ['Montagem'] },
  { nome: 'Bruno César Almeida', setor: 'MON1', funcao: 'Montador', operacoes: ['Montagem'] },
  { nome: 'Simone Aparecida Rocha', setor: 'ACA1', funcao: 'Acabadora e revisora', operacoes: ['Acabamento', 'Revisão'] },
] as const;
const PLANO = { codigo: 'PL-2026-12', descricao: 'Pedidos de calçados para entrega em dezembro', dataInicio: '2026-11-03', dataFim: '2026-12-04' };
// Ordens do plano: produto, quantidade em pares, dia de liberação e, se for o caso, até qual etapa avança.
const ORDENS: { numero: string; produto: string; quantidade: number; liberacao: string; ateEtapa?: number }[] = [
  { numero: 'OP-0001', produto: 'PRD-002', quantidade: 60, liberacao: '2026-11-03' },
  { numero: 'OP-0002', produto: 'PRD-003', quantidade: 100, liberacao: '2026-11-03' },
  { numero: 'OP-0003', produto: 'PRD-004', quantidade: 40, liberacao: '2026-11-04' },
  { numero: 'OP-0004', produto: 'PRD-001', quantidade: 48, liberacao: '2026-11-05' },
  { numero: 'OP-0005', produto: 'PRD-003', quantidade: 120, liberacao: '2026-11-06' },
  { numero: 'OP-0006', produto: 'PRD-002', quantidade: 72, liberacao: '2026-11-09' },
  { numero: 'OP-0007', produto: 'PRD-004', quantidade: 36, liberacao: '2026-11-10' },
  { numero: 'OP-0008', produto: 'PRD-001', quantidade: 60, liberacao: '2026-11-11' },
  { numero: 'OP-0009', produto: 'PRD-003', quantidade: 96, liberacao: '2026-11-12' },
  { numero: 'OP-0010', produto: 'PRD-002', quantidade: 80, liberacao: '2026-11-13' },
  { numero: 'OP-0011', produto: 'PRD-004', quantidade: 48, liberacao: '2026-11-16' },
  // Nos últimos dias entram mais pedidos do que o Pesponto consegue fazer: a fila fica nele.
  { numero: 'OP-0012', produto: 'PRD-001', quantidade: 72, liberacao: '2026-11-17' },
  { numero: 'OP-0013', produto: 'PRD-002', quantidade: 96, liberacao: '2026-11-17' },
  { numero: 'OP-0014', produto: 'PRD-004', quantidade: 70, liberacao: '2026-11-17' },
  { numero: 'OP-0015', produto: 'PRD-003', quantidade: 110, liberacao: '2026-11-18' },
  { numero: 'OP-0016', produto: 'PRD-001', quantidade: 90, liberacao: '2026-11-18' },
  { numero: 'OP-0017', produto: 'PRD-002', quantidade: 100, liberacao: '2026-11-18' },
  { numero: 'OP-0018', produto: 'PRD-004', quantidade: 70, liberacao: '2026-11-19' },
  { numero: 'OP-0019', produto: 'PRD-002', quantidade: 90, liberacao: '2026-11-19' },
  { numero: 'OP-0020', produto: 'PRD-001', quantidade: 80, liberacao: '2026-11-19' },
  // Ordem da demonstração: só o corte é baixado; ela espera no Pesponto, que aparece na TV da Pesponto.
  { numero: 'OP-0021', produto: 'PRD-002', quantidade: 24, liberacao: '2026-11-19', ateEtapa: 1 },
];
// Dias úteis do histórico (20/11, Dia da Consciência Negra, é feriado nacional).
const DIAS = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
const MOTIVOS_PESPONTO: [string, number][] = [['Ajuste de máquina/ferramenta', 35], ['Manutenção corretiva', 20], ['Falta de material', 15], ['Setup / troca de produto', 15], ['Limpeza e organização', 5], ['Reunião/treinamento', 5], ['Falta de operador', 5]];
const MOTIVOS_GERAIS: [string, number][] = [['Falta de material', 25], ['Setup / troca de produto', 20], ['Ajuste de máquina/ferramenta', 15], ['Limpeza e organização', 15], ['Reunião/treinamento', 10], ['Manutenção preventiva', 10], ['Falta de operador', 5]];

// ----------------------------------------------------------------- simulação (determinística)
let semente = 20261103;
const aleatorio = () => { semente |= 0; semente = (semente + 0x6d2b79f5) | 0; let t = Math.imul(semente ^ (semente >>> 15), 1 | semente); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const entre = (a: number, b: number) => a + (b - a) * aleatorio();
const sortear = (opcoes: [string, number][]) => { let r = aleatorio() * opcoes.reduce((s, [, p]) => s + p, 0); for (const [v, p] of opcoes) { r -= p; if (r <= 0) return v; } return opcoes[0][0]; };
const MIN = 60_000;
const instante = (dia: string, hora: string) => new Date(`${dia}T${hora}:00-03:00`).getTime();
const inicioDoDia = (i: number) => instante(DIAS[i], '07:00');
const fimDoDia = (i: number) => instante(DIAS[i], '17:00');
const indiceDoDia = (t: number) => DIAS.findIndex((_, i) => t < fimDoDia(i));
// Primeiro instante de trabalho a partir de t (pula noites, fins de semana e o feriado).
function normalizar(t: number): number | null {
  const i = indiceDoDia(t);
  if (i < 0) return null;
  return Math.max(t, inicioDoDia(i));
}

type Etapa = { id: string; ordem: number; operacao: string; postos: string[] };
type Apontamento = { ordem: string; etapa: Etapa; posto: string; operador: string; inicio: number; fim: number; pausas: { inicio: number; fim: number; motivo: string }[]; quantidades: [number, number, number] };

function simular(etapasDoProduto: Map<string, Etapa[]>, tempos: Map<string, number>) {
  const livrePosto = new Map<string, number>();
  const livreOperador = new Map<string, number>();
  const uso = new Map<string, number>();
  const apontamentos: Apontamento[] = [];
  const estado = ORDENS.map((o) => ({ o, proxima: 0, pronta: instante(o.liberacao, '07:00'), parada: false }));
  for (;;) {
    const pendentes = estado.filter((e) => !e.parada && e.proxima < Math.min(etapasDoProduto.get(e.o.produto)!.length, e.o.ateEtapa ?? 99));
    if (pendentes.length === 0) break;
    pendentes.sort((a, b) => a.pronta - b.pronta);
    const e = pendentes[0];
    const etapa = etapasDoProduto.get(e.o.produto)![e.proxima];
    const fatorBase = etapa.operacao === 'Pesponto' ? entre(1.15, 1.28) : etapa.operacao === 'Montagem' ? entre(0.95, 1.12) : entre(0.88, 1.1);
    const produtivo = e.o.quantidade * tempos.get(`${e.o.produto}:${etapa.operacao}`)! * fatorBase * 1000;
    const nPausas = aleatorio() < (etapa.operacao === 'Pesponto' ? 0.3 : 0.5) ? 0 : aleatorio() < 0.75 ? 1 : 2;
    const pausas = Array.from({ length: nPausas }, () => {
      const motivo = sortear(etapa.operacao === 'Pesponto' ? MOTIVOS_PESPONTO : MOTIVOS_GERAIS);
      return { motivo, duracao: (motivo === 'Manutenção corretiva' ? entre(20, 45) : entre(5, 25)) * MIN, fracao: entre(0.15, 0.85) };
    }).sort((a, b) => a.fracao - b.fracao);
    const total = produtivo + pausas.reduce((s, p) => s + p.duracao, 0);
    if (total > 10 * 60 * MIN) throw new Error(`Execução maior que um expediente: ${e.o.numero} ${etapa.operacao}`);
    const operadores = OPERADORES.filter((op) => (op.operacoes as readonly string[]).includes(etapa.operacao)).map((op) => op.nome);
    let melhor: { posto: string; operador: string; inicio: number } | null = null;
    // Em empate, fica com o posto e o operador menos usados, como faria um encarregado.
    const menosUsados = <T extends string>(lista: readonly T[]) => [...lista].sort((a, b) => (uso.get(a) ?? 0) - (uso.get(b) ?? 0));
    for (const posto of menosUsados(etapa.postos)) for (const operador of menosUsados(operadores)) {
      let inicio = normalizar(Math.max(e.pronta, livrePosto.get(posto) ?? 0, livreOperador.get(operador) ?? 0));
      if (inicio !== null && inicio + total > fimDoDia(indiceDoDia(inicio))) inicio = indiceDoDia(inicio) + 1 < DIAS.length ? inicioDoDia(indiceDoDia(inicio) + 1) : null;
      if (inicio !== null && (!melhor || inicio < melhor.inicio)) melhor = { posto, operador, inicio };
    }
    if (!melhor) { e.parada = true; continue; }
    // Arredonda para o minuto, como um apontamento real.
    const inicio = Math.round(melhor.inicio / MIN) * MIN;
    let cursor = inicio;
    let feito = 0;
    const eventosPausa = pausas.map((p) => {
      cursor += (p.fracao * produtivo - feito); feito = p.fracao * produtivo;
      const pInicio = Math.round(cursor / MIN) * MIN; cursor = pInicio + Math.round(p.duracao / MIN) * MIN;
      return { inicio: pInicio, fim: cursor, motivo: p.motivo };
    });
    const fim = Math.round((cursor + (produtivo - feito)) / MIN) * MIN;
    const retrabalho = Math.round(e.o.quantidade * entre(0, 0.035));
    const refugo = Math.round(e.o.quantidade * entre(0, 0.015));
    apontamentos.push({ ordem: e.o.numero, etapa, posto: melhor.posto, operador: melhor.operador, inicio, fim, pausas: eventosPausa, quantidades: [e.o.quantidade - retrabalho - refugo, retrabalho, refugo] });
    livrePosto.set(melhor.posto, fim + 5 * MIN);
    livreOperador.set(melhor.operador, fim + 5 * MIN);
    uso.set(melhor.posto, (uso.get(melhor.posto) ?? 0) + (fim - inicio));
    uso.set(melhor.operador, (uso.get(melhor.operador) ?? 0) + (fim - inicio));
    e.proxima += 1;
    e.pronta = fim + Math.round(entre(10, 40)) * MIN;
  }
  return apontamentos;
}

// Confere o próprio histórico com as regras do sistema antes de gravar.
function conferir(apontamentos: Apontamento[]) {
  const porChave = new Map<string, Apontamento[]>();
  for (const a of apontamentos) {
    for (const chave of [`posto:${a.posto}`, `operador:${a.operador}`]) porChave.set(chave, [...(porChave.get(chave) ?? []), a]);
    const ordem = ORDENS.find((o) => o.numero === a.ordem)!;
    if (a.quantidades.reduce((s, q) => s + q, 0) !== ordem.quantidade) throw new Error(`Soma da baixa diferente da ordem: ${a.ordem}`);
    if (!a.etapa.postos.includes(a.posto)) throw new Error(`Posto não compatível: ${a.posto}`);
    if (a.fim > fimDoDia(DIAS.length - 1) || a.fim <= a.inicio) throw new Error(`Horário inválido: ${a.ordem}`);
  }
  for (const [chave, lista] of porChave) {
    lista.sort((x, y) => x.inicio - y.inicio);
    for (let i = 1; i < lista.length; i++) if (lista[i].inicio < lista[i - 1].fim) throw new Error(`Sobreposição em ${chave}`);
  }
  const baixas = new Set(apontamentos.map((a) => `${a.ordem}:${a.etapa.id}`));
  if (baixas.size !== apontamentos.length) throw new Error('Duas baixas na mesma etapa de uma ordem.');
}

const iso = (t: number) => new Date(t).toISOString();
const quantidade = (v: number) => String(v) as Numeric<12, 2>;
const tempoPadrao = (v: number) => String(v) as Numeric<10, 2>;
const hora = (t: number) => new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ----------------------------------------------------------------- leitura e gravação
const db = postgres<Contract>({ contractJson, url });
try {
  const o = db.orm.public;
  const [setores, postos, operacoes, produtos, roteiros, motivos, operadores, planos, ordens] = await Promise.all([
    o.Setor.select('id', 'codigo').all(), o.Posto.select('id', 'codigo', 'nome').all(), o.Operacao.select('id', 'nome').all(),
    o.Produto.select('id', 'codigo', 'nome').all(), o.Roteiro.select('id', 'nome', 'versao', 'ativo').all(), o.MotivoPausa.select('id', 'nome', 'ativo').all(),
    o.Operador.select('id', 'matricula', 'nome', 'ativo').all(), o.PlanoProducao.select('id', 'codigo').all(), o.OrdemProducao.select('id', 'numero', 'planoProducaoId').all(),
  ]);
  const porCampo = <T extends Record<string, unknown>>(lista: T[], campo: keyof T) => new Map(lista.map((r) => [r[campo] as string, r]));
  const setor = porCampo(setores, 'codigo'); const posto = porCampo(postos, 'codigo');
  const produto = porCampo(produtos, 'codigo'); const motivo = porCampo(motivos, 'nome'); const operador = porCampo(operadores, 'matricula');
  const roteiro = (nome: string) => roteiros.filter((r) => r.nome === nome).sort((a, b) => b.versao - a.versao)[0];

  // O que precisa existir e o que não pode existir.
  const faltando = [
    ...Object.keys(NOMES_DOS_POSTOS).filter((c) => !posto.has(c)).map((c) => `posto ${c}`),
    ...[...new Set(OPERADORES.map((op) => op.setor))].filter((c) => !setor.has(c)).map((c) => `setor ${c}`),
    ...['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004'].filter((c) => !produto.has(c)).map((c) => `produto ${c}`),
    ...['Calçado fechado', 'Calçado leve', ROTEIRO_DE_TESTE].filter((n) => !roteiro(n)).map((n) => `roteiro ${n}`),
    ...[...MOTIVOS_PESPONTO, ...MOTIVOS_GERAIS].map(([m]) => m).filter((m) => !motivo.get(m)?.ativo).map((m) => `motivo ativo ${m}`),
  ];
  const conflitos = [
    ...planos.filter((p) => p.codigo === PLANO.codigo).map((p) => `plano ${p.codigo}`),
    // As ordens de teste com o mesmo número são apagadas antes de criar as novas.
    ...ordens.filter((x) => ORDENS.some((y) => y.numero === x.numero) && !ORDENS_DE_TESTE.includes(x.numero)).map((x) => `ordem ${x.numero}`),
    ...operadores.filter((x) => OPERADORES.some((y) => y.nome === x.nome)).map((x) => `operador ${x.nome}`),
  ];
  // Testes antigos: ou estão todos, exatamente como esperado, ou já foram apagados.
  const planoTeste = planos.find((p) => p.codigo === PLANO_DE_TESTE);
  const ordensTeste = ordens.filter((x) => ORDENS_DE_TESTE.includes(x.numero));
  const apagarTestes = ordensTeste.length > 0 || planoTeste !== undefined;
  if (apagarTestes) {
    if (ordensTeste.length !== ORDENS_DE_TESTE.length) conflitos.push(`faltam ordens de teste (${ordensTeste.length} de ${ORDENS_DE_TESTE.length})`);
    if (!planoTeste) conflitos.push(`plano ${PLANO_DE_TESTE} não encontrado`);
    else if (ordens.some((x) => x.planoProducaoId === planoTeste.id && !ORDENS_DE_TESTE.includes(x.numero))) conflitos.push(`o plano ${PLANO_DE_TESTE} tem ordens fora da lista de teste`);
  }
  const execucoesTeste = ordensTeste.length ? await o.Execucao.where((x) => x.ordemProducaoId.in(ordensTeste.map((y) => y.id))).select('id', 'status').all() : [];
  const eventosTeste = execucoesTeste.length ? await o.EventoTempo.where((x) => x.execucaoId.in(execucoesTeste.map((y) => y.id))).select('id').all() : [];
  if (faltando.length || conflitos.length) {
    if (faltando.length) console.error('Faltam no banco:', [...new Set(faltando)].join(', '));
    if (conflitos.length) console.error('Já existem no banco (o cenário já foi gravado?):', conflitos.join(', '));
    console.error('Nada foi gravado.');
    process.exitCode = 1;
  } else {
    // Etapas dos dois roteiros de calçado, com os postos de cada etapa.
    const etapasDo = async (roteiroId: string): Promise<Etapa[]> => {
      const etapas = await o.EtapaRoteiro.where({ roteiroId }).select('id', 'ordem', 'operacaoId').orderBy((e) => e.ordem.asc()).all();
      const ligacoes = await o.EtapaPosto.where((l) => l.etapaRoteiroId.in(etapas.map((e) => e.id))).select('etapaRoteiroId', 'postoId').all();
      return etapas.map((e) => ({
        id: e.id, ordem: e.ordem, operacao: operacoes.find((op) => op.id === e.operacaoId)!.nome,
        postos: ligacoes.filter((l) => l.etapaRoteiroId === e.id).map((l) => postos.find((p) => p.id === l.postoId)!.codigo).sort(),
      }));
    };
    const fechado = roteiro('Calçado fechado'); const leve = roteiro('Calçado leve');
    const etapasFechado = await etapasDo(fechado.id); const etapasLeve = await etapasDo(leve.id);
    const roteiroDoProduto: Record<string, typeof fechado> = { 'PRD-001': fechado, 'PRD-002': fechado, 'PRD-003': leve, 'PRD-004': fechado };
    const etapasDoProduto = new Map(Object.entries(roteiroDoProduto).map(([c, r]) => [c, r.id === fechado.id ? etapasFechado : etapasLeve]));
    const tempos = new Map<string, number>();
    const temposGravados = await o.ProdutoEtapa.where((t) => t.etapaRoteiroId.in([...etapasFechado, ...etapasLeve].map((e) => e.id))).select('produtoId', 'etapaRoteiroId', 'tempoPadrao').all();
    for (const [codigo, etapas] of etapasDoProduto) for (const etapa of etapas) {
      const gravado = temposGravados.find((t) => t.produtoId === produto.get(codigo)!.id && t.etapaRoteiroId === etapa.id);
      const valor = gravado ? Number(gravado.tempoPadrao) : codigo === 'PRD-001' ? TEMPOS_SAPATO_SOCIAL[etapa.operacao] : undefined;
      if (valor === undefined) throw new Error(`Sem tempo padrão: ${codigo} ${etapa.operacao}`);
      tempos.set(`${codigo}:${etapa.operacao}`, valor);
    }

    const apontamentos = simular(etapasDoProduto, tempos);
    conferir(apontamentos);

    // Resumo do que será feito.
    console.log(apagarTestes
      ? `\nApagar (testes antigos): ${ordensTeste.length} ordens (${ORDENS_DE_TESTE.join(', ')}), ${execucoesTeste.length} execuções (${execucoesTeste.filter((x) => x.status !== 'FINALIZADA').length} abertas), ${eventosTeste.length} eventos e o plano ${PLANO_DE_TESTE}.`
      : '\nTestes antigos: já apagados.');
    console.log('\nAjustes:');
    console.log(`  ${PRODUTO_RENOMEADO.codigo}: "${produto.get('PRD-001')!.nome}" → "${PRODUTO_RENOMEADO.nome}", roteiro vigente "${PRODUTO_RENOMEADO.roteiro}"`);
    console.log(`  roteiro "${ROTEIRO_DE_TESTE}" inativado; operador ${OPERADOR_DE_TESTE} inativado`);
    for (const [c, n] of Object.entries(NOMES_DOS_POSTOS)) console.log(`  posto ${c}: "${posto.get(c)!.nome}" → "${n}"`);
    console.log(`\nNovos: ${OPERADORES.length} operadores, plano ${PLANO.codigo}, ${ORDENS.length} ordens e ${apontamentos.length} execuções finalizadas por baixa, com ${apontamentos.reduce((s, a) => s + a.pausas.length, 0)} pausas.`);
    console.log('\nSituação final das ordens:');
    for (const ordem of ORDENS) {
      const etapas = etapasDoProduto.get(ordem.produto)!;
      const feitas = apontamentos.filter((a) => a.ordem === ordem.numero);
      const ultima = feitas.at(-1);
      console.log(`  ${ordem.numero} ${ordem.produto} ${ordem.quantidade} pares: ${feitas.length} de ${etapas.length} etapas${feitas.length < etapas.length ? ` · aguardando ${etapas[feitas.length].operacao}` : ' · concluída'}${ultima ? ` · última baixa ${hora(ultima.fim)}` : ''}`);
    }
    const porOperacao = new Map<string, { real: number; padrao: number }>();
    for (const a of apontamentos) {
      const ordem = ORDENS.find((x) => x.numero === a.ordem)!;
      const pausado = a.pausas.reduce((s, p) => s + (p.fim - p.inicio), 0);
      const atual = porOperacao.get(a.etapa.operacao) ?? { real: 0, padrao: 0 };
      atual.real += (a.fim - a.inicio - pausado) / 1000; atual.padrao += ordem.quantidade * tempos.get(`${ordem.produto}:${a.etapa.operacao}`)!;
      porOperacao.set(a.etapa.operacao, atual);
    }
    console.log('\nTempo real em relação ao padrão, por operação:');
    for (const [op, v] of porOperacao) console.log(`  ${op}: ${Math.round((v.real / v.padrao) * 100)}%`);

    if (gravar) {
      await db.transaction(async (tx) => {
        const t = tx.orm.public;
        const agora = new Date().toISOString();
        // 0. Testes antigos: eventos, execuções, ordens e o plano, nessa ordem por causa das chaves estrangeiras.
        if (apagarTestes) {
          if (eventosTeste.length) await t.EventoTempo.where((x) => x.id.in(eventosTeste.map((y) => y.id))).deleteAll();
          if (execucoesTeste.length) await t.Execucao.where((x) => x.id.in(execucoesTeste.map((y) => y.id))).deleteAll();
          await t.OrdemProducao.where((x) => x.id.in(ordensTeste.map((y) => y.id))).deleteAll();
          await t.PlanoProducao.where({ id: planoTeste!.id }).deleteAll();
        }
        // 1. Registros de teste.
        const prd1 = produto.get('PRD-001')!.id;
        await t.Produto.where({ id: prd1 }).update({ nome: PRODUTO_RENOMEADO.nome, updatedAt: agora });
        const ligacaoTeste = await t.ProdutoRoteiro.where({ produtoId: prd1, roteiroId: roteiro(ROTEIRO_DE_TESTE).id }).first();
        if (ligacaoTeste?.vigente) await t.ProdutoRoteiro.where({ id: ligacaoTeste.id }).update({ vigente: false, updatedAt: agora });
        const ligacaoFechado = await t.ProdutoRoteiro.where({ produtoId: prd1, roteiroId: fechado.id }).first();
        if (ligacaoFechado) await t.ProdutoRoteiro.where({ id: ligacaoFechado.id }).update({ vigente: true, updatedAt: agora });
        else await t.ProdutoRoteiro.create({ produtoId: prd1, roteiroId: fechado.id, vigente: true });
        for (const etapa of etapasFechado) {
          if (!temposGravados.some((x) => x.produtoId === prd1 && x.etapaRoteiroId === etapa.id)) {
            await t.ProdutoEtapa.create({ produtoId: prd1, etapaRoteiroId: etapa.id, tempoPadrao: tempoPadrao(TEMPOS_SAPATO_SOCIAL[etapa.operacao]) });
          }
        }
        await t.Roteiro.where({ id: roteiro(ROTEIRO_DE_TESTE).id }).update({ ativo: false, updatedAt: agora });
        const teste = operador.get(OPERADOR_DE_TESTE);
        if (teste?.ativo) await t.Operador.where({ id: teste.id }).update({ ativo: false, updatedAt: agora });
        for (const [c, nome] of Object.entries(NOMES_DOS_POSTOS)) await t.Posto.where({ id: posto.get(c)!.id }).update({ nome, updatedAt: agora });

        // 2. Operadores, plano e ordens, com as datas do histórico.
        const cadastro = new Date('2026-11-02T08:00:00-03:00').toISOString();
        const idOperador = new Map<string, string>();
        const reservadas = operadores.map((x) => x.matricula);
        for (const op of OPERADORES) {
          const matricula = gerarMatriculaOperador(op.nome, op.setor, reservadas);
          reservadas.push(matricula);
          idOperador.set(op.nome, (await t.Operador.create({ nome: op.nome, matricula, funcao: op.funcao, setorPrincipalId: setor.get(op.setor)!.id, ativo: true, createdAt: cadastro, updatedAt: cadastro })).id);
        }
        const plano = await t.PlanoProducao.create({ ...PLANO, createdAt: cadastro, updatedAt: cadastro });
        const idOrdem = new Map<string, string>();
        for (const ordem of ORDENS) {
          const criada = iso(instante(ordem.liberacao, '06:45'));
          idOrdem.set(ordem.numero, (await t.OrdemProducao.create({
            numero: ordem.numero, planoProducaoId: plano.id, produtoId: produto.get(ordem.produto)!.id, roteiroId: roteiroDoProduto[ordem.produto].id,
            quantidade: quantidade(ordem.quantidade), unidade: 'par', createdAt: criada, updatedAt: criada,
          })).id);
        }

        // 3. Execuções e eventos de tempo.
        for (const a of apontamentos) {
          const [boa, retrabalho, refugo] = a.quantidades;
          const execucao = await t.Execucao.create({
            ordemProducaoId: idOrdem.get(a.ordem)!, etapaRoteiroId: a.etapa.id, operadorId: idOperador.get(a.operador)!, postoId: posto.get(a.posto)!.id,
            status: 'FINALIZADA', tipoFinalizacao: 'BAIXA', quantidadeBoa: quantidade(boa), quantidadeRetrabalho: quantidade(retrabalho), quantidadeRefugo: quantidade(refugo),
            criadoEm: iso(a.inicio),
          });
          const eventos: [('INICIO' | 'PAUSA' | 'RETOMADA' | 'FINALIZACAO'), number, string | null][] = [['INICIO', a.inicio, null]];
          for (const p of a.pausas) eventos.push(['PAUSA', p.inicio, motivo.get(p.motivo)!.id], ['RETOMADA', p.fim, null]);
          eventos.push(['FINALIZACAO', a.fim, null]);
          for (const [tipo, quando, motivoPausaId] of eventos) await t.EventoTempo.create({ execucaoId: execucao.id, tipo, dataHora: iso(quando), motivoPausaId, createdAt: iso(quando) });
        }
      });
      console.log('\nGravado.');
    }
  }
} finally {
  await db.close();
}
