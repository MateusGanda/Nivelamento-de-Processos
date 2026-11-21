import test from 'node:test';
import assert from 'node:assert/strict';
import { temaDoCookie, valorCookieTema } from '../../shared/presentation/tema.ts';

test('sem cookie ou com valor desconhecido, a interface abre no tema escuro', () => {
  assert.equal(temaDoCookie(undefined), 'dark');
  assert.equal(temaDoCookie(''), 'dark');
  assert.equal(temaDoCookie('escuro'), 'dark');
  assert.equal(temaDoCookie('light'), 'dark');
  assert.equal(temaDoCookie('<script>'), 'dark');
});

test('o cookie claro abre a interface no tema claro', () => {
  assert.equal(temaDoCookie('claro'), 'light');
});

test('o valor gravado no cookie volta ao mesmo tema', () => {
  assert.equal(temaDoCookie(valorCookieTema('light')), 'light');
  assert.equal(temaDoCookie(valorCookieTema('dark')), 'dark');
});
