import type { MotivoPausa } from '../domain/motivoPausa.ts';

export type ColunaMotivoPausa = 'nome' | 'descricao' | 'ativo' | 'createdAt' | 'updatedAt';
export type FiltroStatusMotivoPausa = 'todos' | 'ativos' | 'inativos';
export type OrdemMotivoPausa = { coluna: ColunaMotivoPausa; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function filtrarOrdenarMotivosPausa(motivosPausa: readonly MotivoPausa[], busca: string, ordem: OrdemMotivoPausa, status: FiltroStatusMotivoPausa = 'todos'): MotivoPausa[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return motivosPausa.filter((motivoPausa) => status === 'todos' || motivoPausa.ativo === (status === 'ativos'))
    .filter((motivoPausa) => !termo || [motivoPausa.nome, motivoPausa.descricao ?? ''].some((campo) => textoBusca(campo).includes(termo)))
    .sort((a, b) => {
      const comparacao = ordem.coluna === 'ativo' ? Number(b.ativo) - Number(a.ativo)
        : ordem.coluna === 'createdAt' || ordem.coluna === 'updatedAt' ? Date.parse(a[ordem.coluna]) - Date.parse(b[ordem.coluna])
        : collation.compare(a[ordem.coluna] ?? '', b[ordem.coluna] ?? '');
      return (comparacao || collation.compare(a.nome, b.nome) || a.id.localeCompare(b.id)) * (ordem.direcao === 'asc' ? 1 : -1);
    });
}

export function formatarDataCadastro(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}
