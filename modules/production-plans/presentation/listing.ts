import type { Plano } from '../domain/plano.ts';

export type ColunaPlano = 'codigo' | 'descricao' | 'dataInicio' | 'dataFim' | 'quantidadeOrdens' | 'updatedAt';
export type OrdemPlano = { coluna: ColunaPlano; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

export function filtrarOrdenarPlanos(planos: readonly Plano[], busca: string, ordem: OrdemPlano): Plano[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return planos.filter((plano) => !termo || [plano.codigo, plano.descricao ?? ''].some((campo) => textoBusca(campo).includes(termo)))
    .sort((a, b) => {
      let comparacao: number;
      if (ordem.coluna === 'quantidadeOrdens') comparacao = a.quantidadeOrdens - b.quantidadeOrdens;
      else if (ordem.coluna === 'updatedAt') comparacao = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
      // Sem data fica por último na ordem crescente; AAAA-MM-DD compara como texto.
      else if (ordem.coluna === 'dataInicio' || ordem.coluna === 'dataFim') comparacao = (a[ordem.coluna] ?? '9999-99-99').localeCompare(b[ordem.coluna] ?? '9999-99-99');
      else comparacao = collation.compare(a[ordem.coluna] ?? '', b[ordem.coluna] ?? '');
      return (comparacao || collation.compare(a.codigo, b.codigo) || a.id.localeCompare(b.id)) * (ordem.direcao === 'asc' ? 1 : -1);
    });
}

export function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}
