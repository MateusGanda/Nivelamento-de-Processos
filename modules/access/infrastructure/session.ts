import { createHmac, timingSafeEqual, scrypt as deriveKey } from 'node:crypto';
import { promisify } from 'node:util';

export const SESSION_COOKIE = 'gunp_session';
export const SESSION_SECONDS = 60 * 60 * 8;
const scrypt = promisify(deriveKey);

export function accessConfig() {
  const email = process.env.AUTH_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.AUTH_PASSWORD_HASH;
  const secret = process.env.AUTH_SECRET;
  if (!email || !passwordHash || !secret || secret.length < 32 ||
      !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)) {
    throw new Error('ACCESS_NOT_CONFIGURED');
  }
  return { email, passwordHash, secret };
}

export async function authenticate(email: string, password: string) {
  const config = accessConfig();
  const [, salt, hash] = config.passwordHash.split(':');
  const actual = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, 'hex')) && email.trim().toLowerCase() === config.email;
}

export function createSession(now = Date.now()) {
  const { email, secret } = accessConfig();
  const payload = Buffer.from(JSON.stringify({ email, expires: now + SESSION_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

export function readSession(token: string | undefined, now = Date.now()): { email: string } | null {
  if (!token || token.length > 2048) return null;
  try {
    const { email, secret } = accessConfig();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    const provided = Buffer.from(signature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, Buffer.from(expected))) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (session.email !== email || !Number.isFinite(session.expires) || session.expires <= now || session.expires > now + SESSION_SECONDS * 1000) return null;
    return { email };
  } catch { return null; }
}
