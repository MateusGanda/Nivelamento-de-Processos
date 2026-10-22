import test from 'node:test';
import assert from 'node:assert/strict';
import { baseCodigoSetor, gerarCodigoSetor } from '../../../modules/sectors/domain/codigo-setor.ts';
import { SetoresService } from '../../../modules/sectors/application/setores.ts';
import type { SetorRepository } from '../../../modules/sectors/application/contracts.ts';
import { ErroCodigoSetorReservado, ErroDeSetor } from '../../../modules/sectors/domain/setor.ts';

test('código de setor: normalização, nomes curtos, números e fallback', () => {
  for (const [nome, esperado] of [['Pesponto', 'PES1'], ['Pré-costura', 'PRE1'], ['  costura  ', 'COS1'], ['T.I.', 'TI1'], ['A', 'A1'], ['123!', 'SET1']]) {
    assert.equal(gerarCodigoSetor(nome, []), esperado);
  }
  assert.equal(baseCodigoSetor('Á-ç ã'), 'ACA');
});

test('código de setor: próximo número reservado, sem limite artificial ou reutilização de buracos', () => {
  assert.equal(gerarCodigoSetor('Pesponto', ['PES1', 'PES3', 'PRE90', 'PESX']), 'PES4');
  assert.equal(gerarCodigoSetor('Pesponto', ['PES99999999999999999999']), 'PES100000000000000000000');
});

test('setor: colisão do código recalcula; nome duplicado não é repetido', async () => {
  const reservados: string[] = [];
  let tentativas = 0;
  const repo: SetorRepository = {
    listar: async () => [], buscarPorNome: async () => null, codigosReservados: async () => [...reservados],
    criar: async (dados) => {
      tentativas++;
      if (tentativas === 1) { reservados.push(dados.codigo); throw new ErroCodigoSetorReservado(); }
      return { id: '1', ...dados, createdAt: '2026-10-21T12:00:00Z', updatedAt: '2026-10-21T12:00:00Z' };
    },
  };
  assert.equal((await new SetoresService(repo).criar({ nome: 'Pesponto' })).codigo, 'PES2');
  assert.equal(tentativas, 2);
  repo.criar = async () => { tentativas++; throw new ErroDeSetor('CONFLITO', 'Nome já cadastrado.'); };
  await assert.rejects(() => new SetoresService(repo).criar({ nome: 'Pesponto' }), /Nome já cadastrado/);
  assert.equal(tentativas, 3);
});

test('setor: esgotamento de dez tentativas retorna conflito recuperável', async () => {
  let tentativas = 0;
  const service = new SetoresService({
    listar: async () => [], buscarPorNome: async () => null, codigosReservados: async () => [],
    criar: async () => { tentativas++; throw new ErroCodigoSetorReservado(); },
  });
  await assert.rejects(() => service.criar({ nome: 'Pesponto' }), (erro: unknown) => erro instanceof ErroDeSetor && erro.codigo === 'CONFLITO' && /Tente novamente/.test(erro.message));
  assert.equal(tentativas, 10);
});
