// Dados fictícios. Encerramento parcial (fim de turno) nos indicadores: a etapa fica pendente com o que já
// foi apontado, a produção de cada turno entra no dia em que foi feita e a baixa completa o restante.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IndicadoresService } from '../../../../modules/indicators/application/indicadores.ts';
import type { ExecucaoRegistrada, RegistrosDeProducao } from '../../../../modules/indicators/application/contracts.ts';
import { identificarBaixa } from '../../../../modules/indicators/domain/producao.ts';
import { DIA_06, RepositorioEmMemoria, base, evento, instante } from './registros-ficticios.ts';

const consultar = (dados: RegistrosDeProducao, periodo = DIA_06) => new IndicadoresService(new RepositorioEmMemoria(dados)).consultar(periodo);

const parcial = (id: string, boa: number, retrabalho: number, refugo: number, dia: string, inicio: string, fim: string): ExecucaoRegistrada => ({
  id, ordemProducaoId: 'ordem-0002', etapaRoteiroId: 'etapa-1', postoId: 'posto-1', tipoFinalizacao: 'ENCERRAMENTO_PARCIAL',
  quantidadeBoa: boa, quantidadeRetrabalho: retrabalho, quantidadeRefugo: refugo,
  eventos: [evento('INICIO', dia, inicio), evento('FINALIZACAO', dia, fim)],
});

// 0002 (24 un): o corte foi feito em dois turnos sem terminar — 11 no dia 05 e 6 no dia 06.
const comParciais = (): RegistrosDeProducao => {
  const dados = base();
  return { ...dados, execucoes: [...dados.execucoes, parcial('p1', 10, 1, 0, '05', '08:00', '09:00'), parcial('p2', 5, 0, 1, '06', '08:00', '08:30')] };
};

test('PARC-01: etapa com encerramento parcial fica pendente, com o apontado, o que falta e desde quando', async () => {
  const { etapasParciais, ordens, cargaPendente } = await consultar(comParciais());
  assert.deepEqual(etapasParciais, [{
    ordemId: 'ordem-0002', numero: '0002', produtoCodigo: 'P-100', produtoNome: 'Produto A',
    etapaRoteiroId: 'etapa-1', ordem: 1, operacaoNome: 'Corte', quantidade: 24, unidade: 'un',
    quantidadeBoa: 15, quantidadeRetrabalho: 1, quantidadeRefugo: 1, quantidadeApontada: 17, quantidadeQueFalta: 7,
    percentualApontado: (17 / 24) * 100, encerramentosParciais: 2,
    inicioEm: new Date(instante('05', '08:00')).toISOString(), ultimoEncerramentoEm: new Date(instante('06', '08:30')).toISOString(),
    motivoUltimoEncerramento: null, emExecucao: false,
  }]);
  assert.equal(ordens.find((o) => o.numero === '0002')?.etapaAtual?.quantidadeApontada, 17);
  // Carga pendente do corte: só os 7 que faltam da 0002 mais a 0004 (baixa inconsistente conta inteira).
  const corte = cargaPendente.find((c) => c.etapaRoteiroId === 'etapa-1');
  assert.deepEqual([corte?.ordensPendentes, corte?.quantidadePendente, corte?.cargaPendenteSegundos], [2, 19.5, 1170]);
});

test('PARC-02: a produção de cada turno entra no dia em que foi registrada, junto com as baixas', async () => {
  const { producao, porDia, tempoMedio } = await consultar(comParciais());
  // Dia 06: a baixa do corte da 0001 (38, 1, 1) e o turno da 0002 (5, 0, 1).
  const corte = producao.find((p) => p.etapaRoteiroId === 'etapa-1');
  assert.deepEqual([corte?.ordensBaixadas, corte?.encerramentosParciais, corte?.quantidadeBoa, corte?.quantidadeRetrabalho, corte?.quantidadeRefugo], [1, 1, 43, 1, 2]);
  // Tempo padrão do que foi apontado no dia: (40 + 6) × 60 s.
  assert.deepEqual([porDia[0].baixas, porDia[0].encerramentosParciais, porDia[0].tempoPadraoDasBaixasSegundos], [1, 1, 2760]);
  // Tempo por unidade com os dois registros do dia: 30 min + 30 min para 38 + 5 boas.
  const medio = tempoMedio.find((t) => t.etapaRoteiroId === 'etapa-1');
  assert.deepEqual([medio?.execucoesConsideradas, medio?.produtivoSegundos, medio?.quantidadeBoa], [2, 3600, 43]);
});

test('PARC-03: a baixa completa o que falta e conclui a etapa; o resultado da etapa soma os turnos', async () => {
  const dados = comParciais();
  const baixa: ExecucaoRegistrada = {
    id: 'b', ordemProducaoId: 'ordem-0002', etapaRoteiroId: 'etapa-1', postoId: 'posto-1', tipoFinalizacao: 'BAIXA',
    quantidadeBoa: 6, quantidadeRetrabalho: 0, quantidadeRefugo: 1, eventos: [evento('INICIO', '07', '08:00'), evento('FINALIZACAO', '07', '08:20')],
  };
  const r = await consultar({ ...dados, execucoes: [...dados.execucoes, baixa] }, { inicioMs: instante('07', '00:00'), fimMs: instante('08', '00:00') });
  assert.deepEqual(r.etapasParciais, []);
  assert.equal(r.ordens.find((o) => o.numero === '0002')?.etapasBaixadas, 1);
  // No dia 07 entra só o que a baixa registrou; os turnos anteriores ficaram nos seus dias.
  const corte = r.producao.find((p) => p.etapaRoteiroId === 'etapa-1');
  assert.deepEqual([corte?.ordensBaixadas, corte?.encerramentosParciais, corte?.quantidadeBoa, corte?.quantidadeRefugo], [1, 0, 6, 1]);
  assert.deepEqual(identificarBaixa(24, [...dados.execucoes.filter((e) => e.ordemProducaoId === 'ordem-0002'), baixa]).resultado,
    { quantidadeBoa: 21, quantidadeRetrabalho: 1, quantidadeRefugo: 2 });
});

test('PARC-04: baixa que, somada aos turnos, passa da quantidade da ordem é inconsistente', () => {
  const turnos = [{ tipoFinalizacao: 'ENCERRAMENTO_PARCIAL' as const, quantidadeBoa: 17, quantidadeRetrabalho: 0, quantidadeRefugo: 0 }];
  assert.equal(identificarBaixa(24, [...turnos, { tipoFinalizacao: 'BAIXA', quantidadeBoa: 24, quantidadeRetrabalho: 0, quantidadeRefugo: 0 }]).situacao, 'INCONSISTENTE');
  assert.equal(identificarBaixa(24, [...turnos, { tipoFinalizacao: 'BAIXA', quantidadeBoa: 7, quantidadeRetrabalho: 0, quantidadeRefugo: 0 }]).situacao, 'BAIXADA');
  // Turnos que já completam a ordem sem baixa não são aceitos pela ilha; nos indicadores, viram inconsistência.
  assert.equal(identificarBaixa(24, [{ ...turnos[0], quantidadeBoa: 24 }]).situacao, 'INCONSISTENTE');
  assert.deepEqual(identificarBaixa(24, turnos), { situacao: 'SEM_BAIXA', resultado: null, apontado: { quantidadeBoa: 17, quantidadeRetrabalho: 0, quantidadeRefugo: 0 } });
});

test('PARC-05: o motivo do último encerramento aparece na etapa pendente; sem motivo, é o fim do turno', async () => {
  const dados = comParciais();
  // O turno do dia 06 terminou por falta de material: o motivo fica no evento FINALIZACAO.
  const execucoes = dados.execucoes.map((e) => e.id !== 'p2' ? e : { ...e, eventos: [evento('INICIO', '06', '08:00'), evento('FINALIZACAO', '06', '08:30', 'motivo-falta')] });
  const { etapasParciais } = await consultar({ ...dados, execucoes });
  assert.equal(etapasParciais[0].motivoUltimoEncerramento, 'Falta de material');
  // Os tempos continuam iguais: o motivo da finalização não vira pausa.
  const { tempos } = await consultar({ ...dados, execucoes });
  const semMotivo = await consultar(dados);
  assert.deepEqual(tempos, semMotivo.tempos);
});
