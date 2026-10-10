import { NextResponse } from 'next/server';
import { authenticate, createSession, SESSION_COOKIE, SESSION_SECONDS } from '@/modules/access/infrastructure/session';
import { sameOrigin } from '@/modules/access/presentation/http';

export const runtime = 'nodejs';
// Limite global do acesso inicial, por processo (sem infraestrutura adicional).
let attempts = 0;
let windowStart = 0;
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 });
  if (Date.now() - windowStart > 60_000) { attempts = 0; windowStart = Date.now(); }
  if (++attempts > 10) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429, headers: { 'Retry-After': '60' } });
  try {
    const body = await request.text();
    if (body.length > 4096) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    let input;
    try { input = JSON.parse(body); } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }); }
    if (!input || typeof input.email !== 'string' || typeof input.password !== 'string' || !input.email || !input.password || input.email.length > 254 || input.password.length > 256) {
      return NextResponse.json({ error: 'Informe e-mail e senha válidos.' }, { status: 400 });
    }
    if (!await authenticate(input.email, input.password)) return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(SESSION_COOKIE, createSession(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
    return response;
  } catch {
    return NextResponse.json({ error: 'Acesso indisponível. Confira a configuração com o responsável.' }, { status: 503 });
  }
}
