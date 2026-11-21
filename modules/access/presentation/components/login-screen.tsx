import Image from 'next/image';
import { ThemeToggle } from '@/shared/presentation/theme-toggle';
import { BrandGunp } from './brand-gunp';
import { LoginForm } from './login-form';

export function LoginScreen() {
  return (
    <main className="grid min-h-svh flex-1 bg-background lg:grid-cols-2">
      <section aria-labelledby="login-titulo" className="relative flex items-center justify-center px-6 py-6 sm:px-12 lg:px-14 lg:py-8 xl:px-20">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="w-full max-w-[400px]">
          <BrandGunp variante="login" />
          <div className="mt-8">
            <h1 id="login-titulo" className="text-center text-2xl leading-tight font-semibold tracking-tight sm:text-[28px]">Acesse sua conta</h1>
            <p className="mt-2 text-center text-sm leading-5 text-muted">Entre com sua matrícula e senha para continuar</p>
            <LoginForm />
          </div>
        </div>
      </section>
      {/* A foto fica sempre com o texto claro sobre o escurecimento, nos dois temas. */}
      <aside data-theme="dark" aria-labelledby="producao-titulo" className="relative isolate hidden overflow-hidden bg-surface text-foreground lg:flex lg:items-end">
        <Image src="/images/login-industrial.png" alt="" fill sizes="(min-width: 1024px) 50vw, 0px" className="object-cover object-center" />
        <div aria-hidden="true" className="absolute inset-0 bg-background/40" />
        <div className="relative w-full border-t border-foreground/10 bg-background/80 px-12 py-10 xl:px-16">
          <h2 id="producao-titulo" className="max-w-[520px] text-3xl leading-[1.2] font-semibold tracking-tight xl:text-4xl">
            Controle e acompanhe <span className="text-accent-ink">sua produção</span>
          </h2>
          <p className="mt-4 max-w-[480px] text-base leading-7 text-subtle">
            Cadastros, registros de execução e indicadores em um único sistema.
          </p>
          <dl className="mt-8 grid max-w-[520px] grid-cols-3 border-t border-foreground/10 pt-5 text-sm">
            <div><dt className="text-muted">Ilha</dt><dd className="mt-1 font-medium">Apontamento</dd></div>
            <div><dt className="text-muted">Painel</dt><dd className="mt-1 font-medium">Carga por posto</dd></div>
            <div><dt className="text-muted">TV</dt><dd className="mt-1 font-medium">Gestão à vista</dd></div>
          </dl>
        </div>
      </aside>
    </main>
  );
}
