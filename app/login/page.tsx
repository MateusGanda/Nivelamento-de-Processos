import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession } from '@/modules/access/presentation/http';
import { LoginForm } from '@/modules/access/presentation/login-form';
export default async function LoginPage() {
  if (await currentSession()) redirect('/painel');
  return <main className="login-page"><section className="login-story"><Link className="brand" href="/"><span className="brand-symbol">≋</span>GUNP</Link><div><span className="eyebrow">NIVELAMENTO DE PROCESSOS</span><h1>O próximo passo<br/>começa com uma<br/><em>visão clara.</em></h1><p>Acesse as informações da produção e construa uma base para decisões melhores.</p><div className="story-lines" aria-hidden="true"><span/><span/><span/><span/></div></div><span className="story-footer">Gestão industrial · Projeto acadêmico</span></section><section className="login-content"><Link href="/" className="back-link">← Voltar ao início</Link><div className="login-card"><span className="eyebrow">BEM-VINDO AO GUNP</span><h2>Acesse sua conta.</h2><p>Informe suas credenciais para abrir o painel.</p><LoginForm/></div><p className="login-bottom">GUNP · Gerenciamento de nivelamento de processos</p></section></main>;
}
