'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
type Product = { id: string; codigo: string; nome: string };
export function ProductsPanel() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const load = useCallback((signal?: AbortSignal) => {
    return fetch('/api/produtos', { cache: 'no-store', signal }).then(async response => {
      if (response.status === 401) { router.replace('/login'); router.refresh(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Consulta indisponível.');
      if (!signal?.aborted) setProducts(result.produtos);
    }).catch(err => {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Não foi possível acessar o servidor.');
    }).finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [router]);
  function refresh() { setLoading(true); setError(''); void load(); }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const filtered = products.filter(product => `${product.codigo} ${product.nome}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <section id="produtos" className="panel-card"><div className="table-heading"><div><span className="eyebrow">CADASTROS DA PRODUÇÃO</span><h2>Produtos</h2><p>Consulta aos produtos cadastrados no banco.</p></div><button className="button secondary small" disabled={loading} onClick={() => refresh()}>{loading ? 'Consultando…' : '↻ Atualizar'}</button></div>
    <div className="table-toolbar"><label htmlFor="product-search" className="sr-only">Buscar por código ou nome</label><input id="product-search" placeholder="Buscar por código ou nome…" value={search} onChange={event => setSearch(event.target.value)} type="search"/><span className="status-pill">{loading ? 'Consultando banco' : error ? 'Consulta indisponível' : `${products.length} produtos carregados`}</span></div>
    <div aria-live="polite">{loading ? <div className="empty-state">Consultando os produtos no banco de dados…</div> : error ? <div className="empty-state"><strong>Não foi possível carregar os dados</strong><p>{error}</p><button className="text-link" onClick={() => refresh()}>Tentar novamente →</button></div> : products.length === 0 ? <div className="empty-state"><span aria-hidden="true">◇</span><strong>A conexão funcionou. Ainda não há produtos.</strong><p>Os produtos aparecerão aqui depois que forem cadastrados no banco.</p></div> : filtered.length === 0 ? <div className="empty-state">Nenhum produto encontrado para esta busca.</div> : <div className="table-scroll"><table><thead><tr><th scope="col">Código</th><th scope="col">Nome do produto</th></tr></thead><tbody>{filtered.map(product => <tr key={product.id}><td><span className="code-tag">{product.codigo}</span></td><td>{product.nome}</td></tr>)}</tbody></table></div>}</div><div className="table-foot">Consulta somente leitura · Até 100 produtos por código</div></section>;
}
