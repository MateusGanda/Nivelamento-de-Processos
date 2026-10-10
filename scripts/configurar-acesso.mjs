import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
const rl = createInterface({ input: stdin, output: stdout });
try {
  const email = (await rl.question('E-mail do acesso inicial: ')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
  const password = randomBytes(18).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  let env;
  try { env = await readFile('.env', 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    env = await readFile('.env.example', 'utf8');
  }
  env = env.replace(/^AUTH_(?:EMAIL|PASSWORD_HASH|SECRET)=.*\r?\n?/gm, '');
  await writeFile('.env', `${env.trim()}\n\nAUTH_EMAIL=${email}\nAUTH_PASSWORD_HASH=${hash}\nAUTH_SECRET=${randomBytes(48).toString('hex')}\n`, { mode: 0o600 });
  console.log(`\nAcesso configurado.\nE-mail: ${email}\nSenha gerada: ${password}\nGuarde a senha; ela não será exibida novamente.\nA conexão DATABASE_URL existente foi preservada. Reinicie npm run dev.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { rl.close(); }
