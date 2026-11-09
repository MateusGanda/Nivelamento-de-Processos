import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarNonce, montarCsp } from '../../shared/csp.ts';

const diretivas = (csp: string) => new Map(csp.split('; ').map((d) => { const [nome, ...valores] = d.split(' '); return [nome, valores]; }));

test('CSP: em produção os scripts só rodam com o nonce da página, sem inline nem eval', () => {
  const csp = diretivas(montarCsp({ nonce: 'abc123', desenvolvimento: false, https: true }));
  assert.deepEqual(csp.get('script-src'), ["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  assert.deepEqual(csp.get('style-src'), ["'self'", "'nonce-abc123'"]);
  assert.deepEqual(csp.get('style-src-attr'), ["'unsafe-inline'"], 'atributos style liberados à parte');
  assert.deepEqual(csp.get('object-src'), ["'none'"]);
  assert.deepEqual(csp.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(csp.get('connect-src'), ["'self'"]);
  assert.deepEqual(csp.get('img-src'), ["'self'", 'blob:', 'data:']);
  assert.ok(csp.has('upgrade-insecure-requests'));
  for (const [nome, valores] of csp) {
    if (nome !== 'style-src-attr') assert.ok(!valores.includes("'unsafe-inline'"), `${nome} sem unsafe-inline`);
    assert.ok(!valores.includes("'unsafe-eval'"), `${nome} sem unsafe-eval`);
    assert.ok(!valores.some((v) => v.startsWith('http')), `${nome} sem domínios de fora`);
  }
});

test('CSP: no desenvolvimento libera o eval do React; em HTTP local não força HTTPS', () => {
  const csp = diretivas(montarCsp({ nonce: 'n', desenvolvimento: true, https: false }));
  assert.ok(csp.get('script-src')!.includes("'unsafe-eval'"));
  assert.deepEqual(csp.get('style-src'), ["'self'", "'unsafe-inline'"]);
  assert.equal(csp.has('upgrade-insecure-requests'), false);
});

test('CSP: o nonce muda a cada pedido e não é previsível', () => {
  const nonces = new Set(Array.from({ length: 200 }, gerarNonce));
  assert.equal(nonces.size, 200);
  for (const n of nonces) assert.match(n, /^[A-Za-z0-9+/]{40,}={0,2}$/);
});
