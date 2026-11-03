import test from 'node:test';
import assert from 'node:assert/strict';
import type { EtapaDisponivel } from '../../../modules/executions/domain/execucao.ts';
import { motivoIndisponibilidadeEtapa } from '../../../modules/executions/presentation/disponibilidade-etapa.ts';

const corte: EtapaDisponivel = {
  id: 'etapa-corte-compartilhada', ordem: 1, operacao: 'Corte', baixada: false,
  postos: [{ id: 'posto-corte', codigo: 'COR1', nome: 'Posto de corte' }],
};
const atual = { ordemId: 'op-001', etapaId: corte.id };

test('ilha: etapa do mesmo roteiro continua disponível em outra ordem durante a troca', () => {
  assert.equal(motivoIndisponibilidadeEtapa('op-001', corte, atual), 'Etapa atual');
  assert.equal(motivoIndisponibilidadeEtapa('op-002', corte, atual), null);
});

test('ilha: mudar os postos não libera a etapa da ordem que já está em execução', () => {
  const outroPosto = { ...corte, postos: [{ id: 'posto-outro', codigo: 'COR2', nome: 'Outro posto' }] };
  assert.equal(motivoIndisponibilidadeEtapa('op-001', outroPosto, atual), 'Etapa atual');
  assert.equal(motivoIndisponibilidadeEtapa('op-002', outroPosto, atual), null);
});

test('ilha: outra etapa da mesma ordem e início sem etapa atual mantêm a seleção disponível', () => {
  const montagem = { ...corte, id: 'etapa-montagem', ordem: 2, operacao: 'Montagem' };
  assert.equal(motivoIndisponibilidadeEtapa('op-001', montagem, atual), null);
  assert.equal(motivoIndisponibilidadeEtapa('op-001', corte), null);
});

test('ilha: outra ordem não libera etapa já baixada ou sem posto ativo', () => {
  assert.equal(motivoIndisponibilidadeEtapa('op-002', { ...corte, baixada: true }, atual), 'Já teve baixa');
  assert.equal(motivoIndisponibilidadeEtapa('op-002', { ...corte, postos: [] }, atual), 'Sem posto ativo');
  assert.equal(motivoIndisponibilidadeEtapa('op-001', { ...corte, baixada: true }, atual), 'Já teve baixa');
});
