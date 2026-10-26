// Testa a rota de indicadores com autorização e consulta substituídas, sem banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IndicadoresService } from '../../../../modules/indicators/application/indicadores.ts';
import { criarHandlersIndicadores } from '../../../../modules/indicators/presentation/http.ts';
import { ErroDeAcesso } from '../../../../modules/access/domain/usuario.ts';
import type { Janela } from '../../../../shared/validation.ts';
import { RepositorioEmMemoria, base } from '../application/registros-ficticios.ts';

const AGORA = new Date('2026-10-06T21:00:00.000Z');
const get = (consulta: string) => new Request(`http://localhost/api/indicadores${consulta}`);
const DIA_06 = '?inicio=2026-10-06T08:00:00-03:00&fim=2026-10-06T18:00:00-03:00';

function handlers({ autorizar = async () => ({ id: 'admin' }), consultar }: { autorizar?: () => Promise<unknown>; consultar?: (periodo: Janela) => Promise<never> } = {}) {
  const periodos: Janela[] = [];
  const servico = new IndicadoresService(new RepositorioEmMemoria(base()));
  const indicadores = {
    consultar: async (periodo: Janela) => {
      periodos.push(periodo);
      return consultar ? consultar(periodo) : servico.consultar(periodo);
    },
  };
  return { ...criarHandlersIndicadores({ autorizar, indicadores, agora: () => AGORA }), periodos };
}

test('responde os blocos e o meta com o período em UTC e as pendências', async () => {
  const h = handlers();
  const resposta = await h.GET(get(DIA_06));
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
  const corpo = await resposta.json();
  assert.deepEqual(Object.keys(corpo), ['meta', 'ordens', 'producao', 'producaoFinal', 'tempos', 'tempoMedio', 'porDia', 'cargaPendente', 'cargaPorPosto']);
  assert.deepEqual(corpo.meta.filtros, { inicio: '2026-10-06T11:00:00.000Z', fim: '2026-10-06T21:00:00.000Z', setorId: null, postoId: null });
  assert.equal(corpo.meta.consultadoEm, '2026-10-06T21:00:00.000Z');
  assert.equal(corpo.meta.fuso, 'America/Sao_Paulo');
  assert.deepEqual(corpo.meta.pendencias.map((p: { codigo: string }) => p.codigo), ['BAIXA_INCONSISTENTE', 'SEM_TEMPO_PADRAO', 'ETAPA_SEM_POSTO', 'EXECUCAO_ABERTA']);
  assert.deepEqual(corpo.ordens.map((o: { numero: string }) => o.numero), ['0001', '0002', '0004']);
  assert.deepEqual(h.periodos, [{ inicioMs: Date.parse('2026-10-06T11:00:00Z'), fimMs: Date.parse('2026-10-06T21:00:00Z') }]);
});

test('sem sessão ou sem ADMIN ativo não consulta os indicadores', async () => {
  for (const [codigo, status] of [['NAO_AUTENTICADO', 401], ['SEM_AUTORIZACAO', 403]] as const) {
    const h = handlers({ autorizar: async () => { throw new ErroDeAcesso(codigo, 'Acesso negado.'); } });
    const resposta = await h.GET(get(DIA_06));
    assert.equal(resposta.status, status);
    assert.equal((await resposta.json()).erro.codigo, codigo);
    assert.equal(h.periodos.length, 0);
  }
});

test('período ausente, sem fuso, inválido ou invertido é recusado com 400', async () => {
  const consultas = [
    '',
    '?inicio=2026-10-06T08:00:00-03:00',
    '?inicio=2026-10-06T08:00:00&fim=2026-10-06T18:00:00',
    '?inicio=2026-10-06&fim=2026-10-07',
    '?inicio=2026-13-06T08:00:00Z&fim=2026-10-06T18:00:00Z',
    '?inicio=2026-10-06T18:00:00Z&fim=2026-10-06T18:00:00Z',
    '?inicio=2026-10-06T18:00:00Z&fim=2026-10-06T08:00:00Z',
  ];
  for (const consulta of consultas) {
    const h = handlers();
    const resposta = await h.GET(get(consulta));
    assert.equal(resposta.status, 400, consulta);
    assert.equal((await resposta.json()).erro.codigo, 'ENTRADA_INVALIDA');
    assert.equal(h.periodos.length, 0);
  }
});

test('filtros por setor e posto ainda não disponíveis e parâmetros desconhecidos são recusados', async () => {
  for (const extra of ['&setorId=00000000-0000-4000-8000-000000000001', '&postoId=00000000-0000-4000-8000-000000000001', '&pagina=2']) {
    const resposta = await handlers().GET(get(DIA_06 + extra));
    assert.equal(resposta.status, 400, extra);
  }
});

test('falha inesperada responde 500 sem detalhes internos', async () => {
  const h = handlers({ consultar: async () => { throw new Error('connect ECONNREFUSED 10.0.0.1:5432'); } });
  const resposta = await h.GET(get(DIA_06));
  assert.equal(resposta.status, 500);
  assert.deepEqual(await resposta.json(), { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } });
});
