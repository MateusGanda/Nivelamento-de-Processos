'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function logout() {
    setLoading(true); setError(false);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      router.replace('/login'); router.refresh();
    } catch { setError(true); }
    finally { setLoading(false); }
  }
  return <div><button className="logout" onClick={logout} disabled={loading}>{loading ? 'Saindo…' : 'Sair da conta ↗'}</button>{error && <p role="alert">Não foi possível sair. Tente novamente.</p>}</div>;
}
