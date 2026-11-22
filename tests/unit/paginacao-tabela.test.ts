import assert from 'node:assert/strict';
import test from 'node:test';
import { paginarTabela } from '../../shared/presentation/use-paginacao-tabela.ts';

const registros = Array.from({ length: 200 }, (_, indice) => indice + 1);

test('paginação de tabelas: limita a página a 10 itens e informa a faixa exibida', () => {
  for (const [total, etapa, paginas, inicio, fim] of [
    [0, 1, 1, 0, 0],
    [10, 1, 1, 1, 10],
    [11, 2, 2, 11, 11],
    [200, 20, 20, 191, 200],
  ]) {
    assert.deepEqual(paginarTabela(registros.slice(0, total), etapa), {
      itens: inicio === 0 ? [] : registros.slice(inicio - 1, fim),
      pagina: etapa,
      totalPaginas: paginas,
      inicio,
      fim,
      total,
    });
  }
});

test('paginação de tabelas: volta à última página válida se os resultados diminuírem', () => {
  const pagina = paginarTabela(registros, 20);
  const depoisDaRecarga = paginarTabela(registros.slice(0, 14), pagina.pagina);

  assert.equal(depoisDaRecarga.pagina, 2);
  assert.deepEqual(depoisDaRecarga.itens, [11, 12, 13, 14]);
});
