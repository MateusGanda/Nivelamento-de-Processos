// Testa as partes puras da tela de indicadores: período, formatação, pendências e cliente da API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conferirDatas, dataLocal, periodoDoAtalho, periodoEntreDatas } from '../../../../modules/indicators/presentation/periodo.ts';
import { formatarDuracao, formatarInstante, formatarPercentual, formatarQuantidade, formatarSegundosPorUnidade, passoDoEixo } from '../../../../modules/indicators/presentation/formatacao.ts';
import { descreverPendencias } from '../../../../modules/indicators/presentation/pendencias.ts';
import { consultarIndicadores, ErroApiIndicadores, type RespostaIndicadores } from '../../../../modules/indicators/presentation/api-client.ts';
import { IndicadoresService } from '../../../../modules/indicators/application/indicadores.ts';
import { criarHandlersIndicadores } from '../../../../modules/indicators/presentation/http.ts';
import { RepositorioEmMemoria, base } from '../application/registros-ficticios.ts';

const exemplo = (nome: string): RespostaIndicadores => JSON.parse(readFileSync(new URL(`../../../../specs/contratos/exemplos/${nome}.json`, import.meta.url), 'utf8'));

test('tela de indicadores: atalhos em dias inteiros de Brasília, com fim exclusivo', () => {
  // 26/10/2026 às 01:30 em Brasília ainda é 26/10, mesmo já sendo 04:30 UTC.
  const agora = Date.parse('2026-10-26T04:30:00Z');
  assert.equal(dataLocal(agora), '2026-10-26');
  assert.equal(dataLocal(Date.parse('2026-10-26T02:59:00Z')), '2026-10-25');
  assert.deepEqual(periodoDoAtalho('hoje', agora), { inicio: '2026-10-26T00:00:00-03:00', fim: '2026-10-27T00:00:00-03:00' });
  assert.deepEqual(periodoDoAtalho('7dias', agora), { inicio: '2026-10-20T00:00:00-03:00', fim: '2026-10-27T00:00:00-03:00' });
  assert.deepEqual(periodoDoAtalho('30dias', agora), { inicio: '2026-09-27T00:00:00-03:00', fim: '2026-10-27T00:00:00-03:00' });
  assert.deepEqual(periodoEntreDatas('2026-12-31', '2026-12-31'), { inicio: '2026-12-31T00:00:00-03:00', fim: '2027-01-01T00:00:00-03:00' });
});

test('tela de indicadores: confere as datas escolhidas', () => {
  assert.equal(conferirDatas('2026-10-01', '2026-10-26'), null);
  assert.equal(conferirDatas('2026-10-01', '2026-10-01'), null);
  assert.match(conferirDatas('2026-10-26', '2026-10-01') ?? '', /anterior/);
  for (const [a, b] of [['', '2026-10-01'], ['2026-02-30', '2026-03-01'], ['26/10/2026', '2026-10-26']]) assert.match(conferirDatas(a, b) ?? '', /Informe/);
});

test('tela de indicadores: formata durações, quantidades e indisponível', () => {
  assert.deepEqual([0, 8, 59.6, 60, 3599, 3600, 3661, 52_500].map(formatarDuracao), ['0 s', '8 s', '1 min', '1 min', '59 min', '1 h 00 min', '1 h 01 min', '14 h 35 min']);
  assert.equal(formatarDuracao(null), '—');
  assert.equal(formatarQuantidade(1234.5, 'un'), '1.234,5 un');
  assert.equal(formatarPercentual(23.076923), '23,1%');
  assert.equal(formatarPercentual(null), '—');
  assert.equal(formatarSegundosPorUnidade(110.5, 'un'), '110,5 s/un');
  assert.equal(formatarSegundosPorUnidade(null, 'un'), '—');
  assert.equal(formatarInstante('2026-10-26T18:16:57Z'), '26/10/2026, 15:16');
  assert.equal(formatarInstante(null), '—');
});

test('tela de indicadores: pendências viram frases com os nomes dos blocos', () => {
  assert.deepEqual(descreverPendencias(exemplo('indicadores-caso-base')), []);
  assert.deepEqual(descreverPendencias(exemplo('indicadores-indisponiveis')), [
    'Produto REF-002, etapa 1. Corte: sem tempo padrão. A carga dessa etapa fica indisponível.',
    'Posto P01: 1 execução em aberto. O tempo só entra nos totais depois da finalização.',
  ]);
  const resposta = exemplo('indicadores-caso-base');
  const etapa = resposta.cargaPendente[0].etapaRoteiroId;
  resposta.meta.pendencias = [
    { codigo: 'BAIXA_INCONSISTENTE', ordemId: resposta.ordens[0].ordemId, etapaRoteiroId: etapa },
    { codigo: 'ETAPA_SEM_POSTO', etapaRoteiroId: etapa },
    { codigo: 'EVENTOS_INCONSISTENTES', execucaoId: 'a' }, { codigo: 'EVENTOS_INCONSISTENTES', execucaoId: 'b' },
    { codigo: 'EXECUCAO_ABERTA', execucaoId: 'c', postoId: resposta.tempos[0].posto.id },
    { codigo: 'EXECUCAO_ABERTA', execucaoId: 'd', postoId: resposta.tempos[0].posto.id },
  ];
  assert.deepEqual(descreverPendencias(resposta), [
    'Ordem 000123, etapa 1. Corte: a baixa não fecha com a quantidade da ordem e não foi contada.',
    'Etapa 1. Corte sem posto ativo: a carga dela não entra em nenhum posto.',
    'Posto P02: 2 execuções em aberto. O tempo só entra nos totais depois da finalização.',
    '2 execuções têm eventos fora da sequência esperada e ficaram fora dos tempos.',
  ]);
});

test('tela de indicadores: cliente envia o período e aceita os exemplos do contrato', async (t) => {
  const pedidos: string[] = [];
  for (const nome of ['indicadores-caso-base', 'indicadores-indisponiveis', 'indicadores-sem-registros']) {
    t.mock.method(globalThis, 'fetch', async (url: string, opcoes: RequestInit) => {
      pedidos.push(url);
      assert.equal(opcoes.cache, 'no-store');
      assert.equal(opcoes.credentials, 'same-origin');
      return Response.json(exemplo(nome));
    });
    assert.deepEqual(await consultarIndicadores({ inicio: '2026-10-20T00:00:00-03:00', fim: '2026-10-27T00:00:00-03:00' }), exemplo(nome));
    t.mock.restoreAll();
  }
  assert.equal(pedidos[0], '/api/indicadores?inicio=2026-10-20T00%3A00%3A00-03%3A00&fim=2026-10-27T00%3A00%3A00-03%3A00');
});

test('tela de indicadores: cliente aceita a resposta real da rota', async (t) => {
  const handlers = criarHandlersIndicadores({ autorizar: async () => ({}), indicadores: new IndicadoresService(new RepositorioEmMemoria(base())) });
  t.mock.method(globalThis, 'fetch', async (url: string) => handlers.GET(new Request('http://localhost' + url)));
  const resposta = await consultarIndicadores({ inicio: '2026-10-06T08:00:00-03:00', fim: '2026-10-06T18:00:00-03:00' });
  assert.ok(resposta.ordens.length > 0);
  assert.ok(Array.isArray(resposta.meta.pendencias));
});

test('tela de indicadores: cliente preserva a mensagem de erro e recusa resposta fora do contrato', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'fim deve ser posterior a inicio.' } }, { status: 400 }));
  await assert.rejects(() => consultarIndicadores({ inicio: 'a', fim: 'b' }), (erro: unknown) => erro instanceof ErroApiIndicadores && erro.status === 400 && erro.message === 'fim deve ser posterior a inicio.');
  t.mock.restoreAll();
  for (const quebrar of [
    (r: Record<string, unknown>) => { delete r.meta; },
    (r: Record<string, unknown>) => { r.tempos = [{ posto: null }]; },
    (r: Record<string, unknown>) => { (r.ordens as Record<string, unknown>[])[0].quantidade = '40'; },
    (r: Record<string, unknown>) => { (r.cargaPorPosto as Record<string, unknown>[])[0].percentualDaCarga = 'x'; },
    (r: Record<string, unknown>) => { delete r.porDia; },
    (r: Record<string, unknown>) => { (r.porDia as Record<string, unknown>[])[0].data = '06/10/2026'; },
    (r: Record<string, unknown>) => { (r.porDia as Record<string, unknown>[])[0].tempoPadraoDasBaixasSegundos = '4000'; },
  ]) {
    const corpo = exemplo('indicadores-caso-base') as unknown as Record<string, unknown>;
    quebrar(corpo);
    t.mock.method(globalThis, 'fetch', async () => Response.json(corpo));
    await assert.rejects(() => consultarIndicadores({ inicio: 'a', fim: 'b' }), /Resposta inválida/);
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>erro</html>', { status: 502 }));
  await assert.rejects(() => consultarIndicadores({ inicio: 'a', fim: 'b' }), (erro: unknown) => erro instanceof ErroApiIndicadores && erro.status === 502 && !erro.message.includes('html'));
});

test('tela de indicadores: eixo do gráfico por dia usa passos redondos e no máximo quatro marcas', () => {
  assert.deepEqual([60, 200, 2400, 3600, 7200, 14_400, 39_600, 400_000].map(passoDoEixo), [60, 60, 600, 900, 1800, 3600, 10_800, 172_800]);
});

test('planilha: CSV para o Excel em português com todos os blocos do período', async () => {
  const { gerarCsvIndicadores, nomeDoArquivo } = await import('../../../../modules/indicators/presentation/exportacao.ts');
  const dados = exemplo('indicadores-caso-base');
  const csv = gerarCsvIndicadores(dados);
  assert.ok(csv.startsWith('﻿Relatório de indicadores - GUNP\r\n'));
  const linhas = csv.slice(1).split('\r\n');
  for (const esperada of [
    'Período;06/10/2026 a 06/10/2026',
    'Peças boas na última etapa;40;un',
    'Tempo produtivo;80;min',
    'Tempo em pausa;10;min',
    '000123;REF-001;Produto fictício;PLANO-2026-41;40;un;2;2;Concluída;06/10/2026, 09:30',
    '000124;REF-001;Produto fictício;PLANO-2026-41;24;un;0;2;Aguardando: 1. Corte;',
    '06/10/2026;80;10;1;66,7',
    'un;40;0;0;100',
    'REF-001;2. Costura;Sim;1;40;0;0;un',
    'P02;Costura (fictício);Setor A (fictício);80;10;90;1;0',
    'P02;Falta de material;10;1',
    'REF-001;Costura;1;120;100;120;Acima do padrão;un',
    'P01;Corte (fictício);12;23,1',
    'REF-001;1. Corte;1;24;un;30;12;P01',
  ]) assert.ok(linhas.includes(esperada), esperada);
  // Bloco vazio fica explícito, sem linha em branco ambígua.
  const atencao = linhas.indexOf('Atenção aos dados');
  assert.deepEqual(linhas.slice(atencao, atencao + 3), ['Atenção aos dados', 'Aviso', 'Sem registros']);
  assert.equal(nomeDoArquivo(dados), 'indicadores_2026-10-06_a_2026-10-06.csv');
});

test('planilha: indisponível fica vazio e texto dos cadastros não vira fórmula', async () => {
  const { gerarCsvIndicadores, textoCsv } = await import('../../../../modules/indicators/presentation/exportacao.ts');
  const linhas = gerarCsvIndicadores(exemplo('indicadores-indisponiveis')).split('\r\n');
  assert.ok(linhas.includes('P01;Corte (fictício);;'), 'carga sem tempo padrão fica vazia, nunca zero');
  assert.equal(textoCsv('Produto A'), 'Produto A');
  assert.equal(textoCsv('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(textoCsv('+1'), "'+1");
  assert.equal(textoCsv('-5'), "'-5");
  assert.equal(textoCsv('@SOMA'), "'@SOMA");
  assert.equal(textoCsv('Corte; acabamento'), '"Corte; acabamento"');
  assert.equal(textoCsv('linha\nnova'), '"linha\nnova"');
  const dados = exemplo('indicadores-caso-base');
  dados.ordens[0].produtoNome = '=1+1';
  assert.ok(gerarCsvIndicadores(dados).includes(";'=1+1;"));
});
