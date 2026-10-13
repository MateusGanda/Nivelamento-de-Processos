'use client';

import { useRef, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const emEnvio = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;

    const campos = new FormData(event.currentTarget);
    const matricula = String(campos.get('matricula') ?? '').trim();
    const senha = String(campos.get('senha') ?? '');
    if (!matricula || !senha) {
      setErro('Informe sua matrícula e senha.');
      return;
    }

    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      const resultado = await signIn('credentials', { matricula, senha, redirect: false, callbackUrl: '/painel' });
      if (resultado?.error === 'CredentialsSignin') {
        setErro('Matrícula ou senha inválidas.');
      } else if (!resultado?.ok || resultado.error) {
        setErro('Não foi possível entrar. Tente novamente em instantes.');
      } else {
        router.replace('/painel');
        router.refresh();
      }
    } catch {
      setErro('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  const campoClassName = 'h-12 w-full rounded-lg border border-[#3b454e] bg-white/[0.025] pl-12 pr-4 text-base text-foreground outline-none transition-colors placeholder:text-[#89949f] hover:border-[#59646e] focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

  return (
    // method="post": se o envio ocorrer antes da hidratação, a senha não vai para a URL.
    <form method="post" onSubmit={entrar} className="mt-6 space-y-4" aria-busy={enviando}>
      <div>
        <label htmlFor="matricula" className="mb-1 block text-sm font-medium text-[#ccd2d8]">Matrícula</label>
        <div className="relative">
          <UserRound aria-hidden="true" size={22} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            id="matricula" name="matricula" type="text" autoComplete="username"
            placeholder="Sua matrícula" required maxLength={64} disabled={enviando}
            spellCheck={false} autoCapitalize="none"
            aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'login-erro' : undefined}
            className={campoClassName}
          />
        </div>
      </div>
      <div>
        <label htmlFor="senha" className="mb-1 block text-sm font-medium text-[#ccd2d8]">Senha</label>
        <div className="relative">
          <LockKeyhole aria-hidden="true" size={22} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            id="senha" name="senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password"
            placeholder="Sua senha" required maxLength={128} disabled={enviando}
            aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'login-erro' : undefined}
            className={`${campoClassName} pr-14`}
          />
          <button
            type="button" onClick={() => setMostrarSenha(!mostrarSenha)} disabled={enviando}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha} aria-controls="senha"
            className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait"
          >
            {mostrarSenha ? <EyeOff aria-hidden="true" size={22} strokeWidth={2} /> : <Eye aria-hidden="true" size={22} strokeWidth={2} />}
          </button>
        </div>
      </div>
      {erro && (
        <p id="login-erro" role="alert" className="flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 px-3 py-2 text-sm leading-5 text-[#ffb4a5]">
          <AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}
        </p>
      )}
      <button
        type="submit" disabled={enviando}
        className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent text-base font-semibold text-[#171b1f] transition-colors hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
      >
        {enviando && <LoaderCircle aria-hidden="true" size={20} strokeWidth={2} className="motion-safe:animate-spin" />}
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
