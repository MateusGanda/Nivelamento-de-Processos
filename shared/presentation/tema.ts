// Tema da interface (claro ou escuro). O escuro é o padrão e a identidade do GUNP.
// A escolha fica em um cookie para o servidor já montar a página com o tema certo, sem script na página.
export const COOKIE_TEMA = 'gunp-tema';

export type Tema = 'dark' | 'light';

const VALOR_CLARO = 'claro';

export function temaDoCookie(valor: string | undefined): Tema {
  return valor === VALOR_CLARO ? 'light' : 'dark';
}

export function valorCookieTema(tema: Tema): string {
  return tema === 'light' ? VALOR_CLARO : 'escuro';
}
