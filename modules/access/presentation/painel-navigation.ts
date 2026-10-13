export type IconePainel = 'inicio' | 'produtos' | 'operacoes' | 'setores' | 'postos' | 'operadores' | 'pausas' | 'roteiros' | 'planos' | 'ordens' | 'execucoes' | 'indicadores';
export type GrupoPainel = 'Início' | 'Cadastros' | 'Produção' | 'Relatórios';

export type DestinoPainel = {
  readonly titulo: string;
  readonly slug: string;
  readonly grupo: GrupoPainel;
  readonly descricao: string;
  readonly icone: IconePainel;
};

// Metadados de apresentação, não funcionalidades ou permissões de negócio.
export const destinosPainel: readonly DestinoPainel[] = [
  { titulo: 'Início', slug: '', grupo: 'Início', descricao: 'Acesso aos módulos do GUNP.', icone: 'inicio' },
  { titulo: 'Produtos', slug: 'produtos', grupo: 'Cadastros', descricao: 'Organização dos produtos fabricados.', icone: 'produtos' },
  { titulo: 'Operações', slug: 'operacoes', grupo: 'Cadastros', descricao: 'Operações do processo produtivo.', icone: 'operacoes' },
  { titulo: 'Setores', slug: 'setores', grupo: 'Cadastros', descricao: 'Organização dos setores da produção.', icone: 'setores' },
  { titulo: 'Postos', slug: 'postos', grupo: 'Cadastros', descricao: 'Postos e recursos de produção.', icone: 'postos' },
  { titulo: 'Operadores', slug: 'operadores', grupo: 'Cadastros', descricao: 'Identificação dos operadores da produção.', icone: 'operadores' },
  { titulo: 'Motivos de Pausa', slug: 'motivos-de-pausa', grupo: 'Cadastros', descricao: 'Classificação das pausas das execuções.', icone: 'pausas' },
  { titulo: 'Roteiros', slug: 'roteiros', grupo: 'Produção', descricao: 'Roteiros versionados e suas etapas.', icone: 'roteiros' },
  { titulo: 'Planos de Produção', slug: 'planos-de-producao', grupo: 'Produção', descricao: 'Organização dos planos de produção.', icone: 'planos' },
  { titulo: 'Ordens de Produção', slug: 'ordens-de-producao', grupo: 'Produção', descricao: 'Acompanhamento das ordens de produção.', icone: 'ordens' },
  { titulo: 'Execução', slug: 'execucoes', grupo: 'Produção', descricao: 'Acompanhamento administrativo das execuções.', icone: 'execucoes' },
  { titulo: 'Indicadores', slug: 'indicadores', grupo: 'Relatórios', descricao: 'Análise dos registros da produção.', icone: 'indicadores' },
];

export const gruposPainel: readonly GrupoPainel[] = ['Início', 'Cadastros', 'Produção', 'Relatórios'];

export function hrefDestinoPainel(destino: DestinoPainel): string {
  return destino.slug ? `/painel/${destino.slug}` : '/painel';
}

export function obterModuloPainel(slug: string): DestinoPainel | undefined {
  return destinosPainel.find((destino) => destino.slug !== '' && destino.slug === slug);
}
