import type { Setor } from '../domain/setor.ts';

export type ColunaSetor = 'codigo' | 'nome' | 'descricao' | 'ativo' | 'createdAt';
export type FiltroStatusSetor = 'todos' | 'ativos' | 'inativos';
export type OrdemSetor = { coluna: ColunaSetor; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function filtrarOrdenarSetores(setores: readonly Setor[], busca: string, ordem: OrdemSetor, status: FiltroStatusSetor = 'todos'): Setor[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return setores.filter((setor) => status === 'todos' || setor.ativo === (status === 'ativos')).filter((setor) => !termo || [setor.codigo, setor.nome, setor.descricao ?? ''].some((campo) => textoBusca(campo).includes(termo))).sort((a, b) => {
    const comparacao = ordem.coluna === 'ativo' ? Number(b.ativo) - Number(a.ativo)
      : ordem.coluna === 'createdAt' ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : collation.compare(a[ordem.coluna] ?? '', b[ordem.coluna] ?? '');
    return (comparacao || collation.compare(a.nome, b.nome) || a.id.localeCompare(b.id)) * (ordem.direcao === 'asc' ? 1 : -1);
  });
}

export function formatarDataCadastro(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}
