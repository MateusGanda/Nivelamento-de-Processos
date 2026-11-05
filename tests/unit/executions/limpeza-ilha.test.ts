import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarLimpeza, CONFIRMACAO_MS, INATIVIDADE_MS, type SituacaoLimpeza } from '../../../modules/executions/presentation/limpeza-ilha.ts';

const base: SituacaoLimpeza = { temIdentificacao: true, ocupado: false, bloqueando: false, ultimaInteracaoMs: 1_000, confirmacaoDesdeMs: null };
const situacao = (mudancas: Partial<SituacaoLimpeza>): SituacaoLimpeza => ({ ...base, ...mudancas });

test('ilha: os tempos aprovados são 10 s de confirmação e 30 s sem uso', () => {
  assert.equal(CONFIRMACAO_MS, 10_000);
  assert.equal(INATIVIDADE_MS, 30_000);
});

test('ilha: depois de um registro, conta 10 s e limpa', () => {
  // O registro marca a interação no mesmo instante, então a contagem vale.
  const registro = situacao({ ultimaInteracaoMs: 5_000, confirmacaoDesdeMs: 5_000 });
  assert.deepEqual(avaliarLimpeza(registro, 5_000), { tipo: 'contagem', segundosRestantes: 10 });
  assert.deepEqual(avaliarLimpeza(registro, 5_001), { tipo: 'contagem', segundosRestantes: 10 });
  assert.deepEqual(avaliarLimpeza(registro, 14_000), { tipo: 'contagem', segundosRestantes: 1 });
  assert.deepEqual(avaliarLimpeza(registro, 14_999), { tipo: 'contagem', segundosRestantes: 1 });
  assert.deepEqual(avaliarLimpeza(registro, 15_000), { tipo: 'limpar', motivo: 'confirmacao' });
});

test('ilha: tocar na tela durante a contagem passa a valer a regra de 30 s', () => {
  const tocou = situacao({ confirmacaoDesdeMs: 5_000, ultimaInteracaoMs: 7_000 });
  assert.deepEqual(avaliarLimpeza(tocou, 16_000), { tipo: 'aguardando' });
  assert.deepEqual(avaliarLimpeza(tocou, 36_999), { tipo: 'aguardando' });
  assert.deepEqual(avaliarLimpeza(tocou, 37_000), { tipo: 'limpar', motivo: 'inatividade' });
});

test('ilha: sem uso por 30 s limpa, e cada interação reinicia a conta', () => {
  assert.deepEqual(avaliarLimpeza(base, 30_999), { tipo: 'aguardando' });
  assert.deepEqual(avaliarLimpeza(base, 31_000), { tipo: 'limpar', motivo: 'inatividade' });
  // Digitação da baixa a cada 20 s: nunca chega a 30 s parado.
  assert.deepEqual(avaliarLimpeza(situacao({ ultimaInteracaoMs: 21_000 }), 41_000), { tipo: 'aguardando' });
});

test('ilha: não limpa durante uma gravação nem com o terminal em bloqueio', () => {
  assert.deepEqual(avaliarLimpeza(situacao({ ocupado: true }), 120_000), { tipo: 'nada' });
  assert.deepEqual(avaliarLimpeza(situacao({ ocupado: true, confirmacaoDesdeMs: 1_000 }), 120_000), { tipo: 'nada' });
  assert.deepEqual(avaliarLimpeza(situacao({ bloqueando: true }), 120_000), { tipo: 'nada' });
});

test('ilha: tela vazia não tem nada a limpar; matrícula abandonada segue a regra de 30 s', () => {
  assert.deepEqual(avaliarLimpeza(situacao({ temIdentificacao: false }), 120_000), { tipo: 'nada' });
  // temIdentificacao também é verdadeiro quando só há matrícula digitada pela metade.
  assert.deepEqual(avaliarLimpeza(base, 31_000), { tipo: 'limpar', motivo: 'inatividade' });
});

test('ilha: identificação e situação atualizada não iniciam a contagem de 10 s', () => {
  // Nesses casos a tela não informa confirmacaoDesdeMs; só a inatividade vale.
  const identificado = situacao({ ultimaInteracaoMs: 5_000, confirmacaoDesdeMs: null });
  assert.deepEqual(avaliarLimpeza(identificado, 15_000), { tipo: 'aguardando' });
  assert.deepEqual(avaliarLimpeza(identificado, 35_000), { tipo: 'limpar', motivo: 'inatividade' });
});

test('ilha: timers atrasados em segundo plano limpam no primeiro tique depois do prazo', () => {
  assert.deepEqual(avaliarLimpeza(situacao({ ultimaInteracaoMs: 5_000, confirmacaoDesdeMs: 5_000 }), 600_000), { tipo: 'limpar', motivo: 'confirmacao' });
  assert.deepEqual(avaliarLimpeza(base, 600_000), { tipo: 'limpar', motivo: 'inatividade' });
});

test('ilha: a contagem exibida fica entre 1 e 10, mesmo com o relógio voltando', () => {
  const registro = situacao({ ultimaInteracaoMs: 5_000, confirmacaoDesdeMs: 5_000 });
  for (let agora = 0; agora < 15_000; agora += 250) {
    const decisao = avaliarLimpeza(registro, agora);
    assert.equal(decisao.tipo, 'contagem');
    if (decisao.tipo === 'contagem') assert.ok(decisao.segundosRestantes >= 1 && decisao.segundosRestantes <= 10, String(agora));
  }
});
