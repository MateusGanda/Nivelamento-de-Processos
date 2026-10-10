import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/modules/access/infrastructure/session';
import { sameOrigin } from '@/modules/access/presentation/http';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 });
  return response;
}
