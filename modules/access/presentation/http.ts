import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '../infrastructure/session';

export async function currentSession() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === request.headers.get('host');
  } catch { return false; }
}
