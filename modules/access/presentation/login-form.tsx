'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || 'Não foi possível entrar.'); return; }
      router.replace('/painel'); router.refresh();
    } catch { setError('Não foi possível acessar o servidor. Tente novamente.'); }
    finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="login-form">
    <label htmlFor="email">E-mail</label><input id="email" name="email" type="email" placeholder="Seu e-mail de acesso" autoComplete="username" required maxLength={254} disabled={loading}/>
    <label htmlFor="password">Senha</label><div className="password-field"><input id="password" name="password" type={visible ? 'text' : 'password'} placeholder="Sua senha" autoComplete="current-password" required maxLength={256} disabled={loading}/><button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}>{visible ? 'Ocultar' : 'Mostrar'}</button></div>
    {error && <p className="error-box" role="alert">{error}</p>}
    <button className="button" disabled={loading} type="submit">{loading ? 'Entrando…' : 'Entrar no sistema'} <span aria-hidden="true">→</span></button>
    <p className="form-note">Precisa de acesso? Entre em contato com o responsável pelo projeto.</p>
  </form>;
}
