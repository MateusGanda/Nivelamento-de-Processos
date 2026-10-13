import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

// Opt-in: execute com GUNP_HTTP_TEST_URL apontando para a aplicação local em execução.
// Os testes não criam, atualizam, desativam ou excluem usuários.
const endereco = process.env.GUNP_HTTP_TEST_URL;
const base = endereco ? new URL(endereco) : null;
if (base && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  throw new Error('Os testes HTTP são restritos à aplicação local.');
}
const url = (caminho: string) => new URL(caminho, base!).toString();
const { encode } = createRequire(import.meta.url)('next-auth/jwt') as typeof import('next-auth/jwt');

function guardarCookies(resposta: Response, cookies: Map<string, string>) {
  for (const cookie of resposta.headers.getSetCookie()) {
    const par = cookie.split(';')[0];
    const indice = par.indexOf('=');
    cookies.set(par.slice(0, indice), par.slice(indice + 1));
  }
}

function cabecalhoCookies(cookies: Map<string, string>) {
  return [...cookies].map(([nome, valor]) => `${nome}=${valor}`).join('; ');
}

async function autenticar(matricula: string, senha: string) {
  const cookies = new Map<string, string>();
  const csrf = await fetch(url('/api/auth/csrf'));
  guardarCookies(csrf, cookies);
  const { csrfToken } = await csrf.json() as { csrfToken: string };
  const resposta = await fetch(url('/api/auth/callback/credentials'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cabecalhoCookies(cookies) },
    body: new URLSearchParams({ csrfToken, matricula, senha, callbackUrl: url('/painel'), json: 'true' }),
    redirect: 'manual',
  });
  guardarCookies(resposta, cookies);
  return { resposta, cookies };
}

test('HTTP: páginas públicas, marca, formulário e imagem local', { skip: !base }, async () => {
  const resposta = await fetch(url('/login'));
  assert.equal(resposta.status, 200);
  const html = await resposta.text();
  for (const trecho of ['lang="pt-BR"', 'Acesse sua conta', 'name="matricula"', 'name="senha"', 'autoComplete="username"', 'autoComplete="current-password"', 'Mostrar senha', 'Carga por posto']) {
    assert.ok(html.includes(trecho), `Página deve conter ${trecho}`);
  }
  assert.equal((await fetch(url('/images/login-industrial.png'))).status, 200);
  assert.equal((await fetch(url('/_next/image?url=%2Fimages%2Flogin-industrial.png&w=1080&q=75'))).status, 200);
});

test('HTTP: sem sessão, raiz e painel redirecionam e API nega acesso', { skip: !base }, async () => {
  for (const caminho of ['/', '/painel', '/api/auth/signin']) {
    const resposta = await fetch(url(caminho), { redirect: 'manual' });
    assert.ok([302, 303, 307, 308].includes(resposta.status), `Redirecionamento esperado em ${caminho}`);
    assert.equal(new URL(resposta.headers.get('location')!, base!).pathname, '/login');
  }
  assert.equal((await fetch(url('/api/usuarios'))).status, 401);
  assert.deepEqual(await (await fetch(url('/api/auth/session'))).json(), {});
});

test('HTTP: cookie inválido não permite entrar no painel ou na API', { skip: !base }, async () => {
  const headers = { Cookie: 'next-auth.session-token=token-invalido' };
  const painel = await fetch(url('/painel'), { headers, redirect: 'manual' });
  assert.equal(new URL(painel.headers.get('location')!, base!).pathname, '/login');
  assert.equal((await fetch(url('/api/usuarios'), { headers })).status, 401);
});

test('HTTP: login inválido rejeita credenciais e não cria sessão', { skip: !base }, async () => {
  const { resposta, cookies } = await autenticar(`TESTE-${randomUUID()}`, 'senha-de-teste-invalida');
  const resultado = await resposta.json() as { url: string };
  assert.equal(new URL(resultado.url).searchParams.get('error'), 'CredentialsSignin');
  assert.equal((await fetch(url('/api/usuarios'), { headers: { Cookie: cabecalhoCookies(cookies) } })).status, 401);
});

test('HTTP: ADMIN inexistente com JWT assinado também perde acesso', { skip: !base || !process.env.NEXTAUTH_SECRET }, async () => {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { sub: randomUUID(), papel: 'ADMIN' }, maxAge: 60 });
  const headers = { Cookie: `next-auth.session-token=${token}` };
  const painel = await fetch(url('/painel'), { headers, redirect: 'manual' });
  assert.equal(new URL(painel.headers.get('location')!, base!).pathname, '/login');
  assert.equal((await fetch(url('/api/usuarios'), { headers })).status, 404);
});

test('HTTP: login correto, painel protegido, redirecionamentos e logout', { skip: !base }, async (t) => {
  const matricula = process.env.INITIAL_ADMIN_MATRICULA;
  const senha = process.env.INITIAL_ADMIN_SENHA;
  if (!matricula || !senha) return t.skip('Credenciais de teste não configuradas.');

  const { resposta, cookies } = await autenticar(matricula, senha);
  const resultado = await resposta.json() as { url: string };
  if (new URL(resultado.url).searchParams.has('error')) return t.skip('Credenciais do bootstrap não correspondem a uma conta ativa; não alterar contas para testar.');
  assert.equal(new URL(resultado.url).pathname, '/painel');
  const headers = { Cookie: cabecalhoCookies(cookies) };
  const painel = await fetch(url('/painel'), { headers });
  assert.equal(painel.status, 200);
  const html = await painel.text();
  assert.ok(html.includes('Boas-vindas'));
  assert.ok(html.includes('Sua identificação'));
  assert.ok(!html.includes('senhaHash'));
  for (const caminho of ['/', '/login']) {
    const redirecionamento = await fetch(url(caminho), { headers, redirect: 'manual' });
    assert.equal(new URL(redirecionamento.headers.get('location')!, base!).pathname, '/painel');
  }
  const usuarios = await fetch(url('/api/usuarios'), { headers });
  assert.equal(usuarios.status, 200);
  const lista = await usuarios.json() as Array<{ id: string; ativo: boolean }>;
  const inativo = lista.find((usuario) => !usuario.ativo);
  await t.test('conta inativa é bloqueada mesmo com JWT válido', async (subteste) => {
    if (!inativo || !process.env.NEXTAUTH_SECRET) return subteste.skip('Não há conta inativa existente para teste sem mutações.');
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { sub: inativo.id, papel: 'ADMIN' }, maxAge: 60 });
    const headersInativo = { Cookie: `next-auth.session-token=${token}` };
    const respostaPainel = await fetch(url('/painel'), { headers: headersInativo, redirect: 'manual' });
    assert.equal(new URL(respostaPainel.headers.get('location')!, base!).pathname, '/login');
    assert.equal((await fetch(url('/api/usuarios'), { headers: headersInativo })).status, 403);
  });

  const csrf = await fetch(url('/api/auth/csrf'), { headers });
  guardarCookies(csrf, cookies);
  const { csrfToken } = await csrf.json() as { csrfToken: string };
  const saida = await fetch(url('/api/auth/signout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cabecalhoCookies(cookies) },
    body: new URLSearchParams({ csrfToken, callbackUrl: url('/login'), json: 'true' }),
    redirect: 'manual',
  });
  guardarCookies(saida, cookies);
  assert.equal(new URL((await saida.json() as { url: string }).url).pathname, '/login');
  assert.equal((await fetch(url('/api/usuarios'), { headers: { Cookie: cabecalhoCookies(cookies) } })).status, 401);
});
