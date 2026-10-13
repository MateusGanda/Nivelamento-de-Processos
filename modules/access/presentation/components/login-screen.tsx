import Image from 'next/image';
import { ChartColumnIncreasing, ClipboardList, Factory } from 'lucide-react';
import { BrandGunp } from './brand-gunp';
import { LoginForm } from './login-form';

const destaques = [
  { icone: ChartColumnIncreasing, titulo: 'Indicadores', descricao: 'Baseados nos registros' },
  { icone: ClipboardList, titulo: 'Processos', descricao: 'Mais organizados' },
  { icone: Factory, titulo: 'Carga por posto', descricao: 'Apoio à análise' },
];

export function LoginScreen() {
  return (
    <main className="grid min-h-svh flex-1 bg-background lg:grid-cols-2">
      <section aria-labelledby="login-titulo" className="flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#1b232a_0%,#12171b_65%)] px-6 py-6 sm:px-12 lg:px-14 lg:py-8 xl:px-20">
        <div className="w-full max-w-[400px]">
          <BrandGunp variante="login" />
          <div className="mt-8">
            <h1 id="login-titulo" className="text-center text-2xl leading-tight font-semibold tracking-tight sm:text-[28px]">Acesse sua conta</h1>
            <p className="mt-2 text-center text-sm leading-5 text-muted">Entre com sua matrícula e senha para continuar</p>
            <LoginForm />
          </div>
        </div>
      </section>
      <aside aria-labelledby="producao-titulo" className="relative isolate hidden overflow-hidden bg-[#20272d] lg:flex lg:items-center">
        <Image src="/images/login-industrial.png" alt="" fill sizes="(min-width: 1024px) 50vw, 0px" className="object-cover object-center" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,31,37,0.64)_0%,rgba(24,31,37,0.84)_55%,rgba(24,31,37,0.96)_100%)]" />
        <div className="relative mx-auto w-full max-w-[600px] px-12 py-20 xl:px-16 [@media(max-height:760px)]:py-6">
          <div aria-hidden="true" className="mb-7 h-1 w-10 rounded-full bg-accent" />
          <h2 id="producao-titulo" className="text-3xl leading-[1.2] font-semibold tracking-tight xl:text-[2.5rem]">
            Controle e acompanhe<br /><span className="text-accent">sua produção</span>
          </h2>
          <p className="mt-7 max-w-[420px] text-base leading-8 text-[#c1c8cf] xl:text-lg">
            Organize cadastros, registros de execução e indicadores em um único sistema para acompanhar sua produção.
          </p>
          <ul className="mt-10 grid grid-cols-3 gap-4 xl:gap-6">
            {destaques.map(({ icone: Icone, titulo, descricao }) => (
              <li key={titulo}>
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-white/5 bg-[#11171b]/65 text-accent">
                  <Icone aria-hidden="true" size={24} strokeWidth={2} />
                </div>
                <p className="text-sm font-medium text-foreground xl:text-base">{titulo}</p>
                <p className="mt-1.5 text-xs leading-5 text-muted xl:text-sm">{descricao}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
