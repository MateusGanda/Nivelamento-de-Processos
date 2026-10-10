import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'GUNP | Nivelamento de processos',
  description: 'Sistema web para gerenciamento e análise do nivelamento de processos em linhas de produção.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
