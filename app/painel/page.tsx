import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession } from '@/modules/access/presentation/http';
import { LogoutButton } from '@/modules/access/presentation/logout-button';
import { ProductsPanel } from '@/modules/catalog/presentation/products-panel';
export default async function PanelPage() {
  const session = await currentSession();
  if (!session) redirect('/login');
  return <div className="dashboard"><aside className="sidebar"><Link href="/" className="brand"><span className="brand-symbol">≋</span>GUNP</Link><span className="sidebar-caption">NIVELAMENTO DE PROCESSOS</span><nav aria-label="Menu do painel"><a href="#visao-geral">◈ <span>Visão geral</span></a><a href="#produtos">▦ <span>Produtos</span></a><Link href="/">↗ <span>Apresentação do projeto</span></Link></nav><div className="sidebar-bottom"><span className="eyebrow">CONTA CONECTADA</span><p>{session.email}</p><LogoutButton/></div></aside><div className="dashboard-body"><header className="dashboard-top"><span>Área de trabalho <span aria-hidden="true">/</span> <strong>Visão geral</strong></span><span className="status-pill">Acesso autenticado</span></header><main className="dashboard-main"><section id="visao-geral" className="dashboard-welcome"><span className="eyebrow">SEU PONTO DE PARTIDA</span><h1>Bem-vindo ao GUNP.</h1><p>As informações da produção, em um só lugar.</p></section><div className="welcome-banner"><div><span className="eyebrow">ESTRUTURA DA PRODUÇÃO</span><h2>Comece pelos seus produtos.</h2><p>Consulte os registros do banco e encontre a informação que precisa.</p></div><a href="#produtos" className="button">Ver produtos ↓</a></div><ProductsPanel/><p className="dashboard-note">Primeira entrega do projeto. Novos cadastros e análises serão adicionados nas próximas etapas.</p></main></div></div>;
}
