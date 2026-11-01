import type { Operacao } from '../domain/operacao.ts';

export type ColunaOperacao = 'nome' | 'descricao' | 'ativo' | 'createdAt' | 'updatedAt';
export type FiltroStatusOperacao = 'todos' | 'ativos' | 'inativos';
export type OrdemOperacao = { coluna: ColunaOperacao; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function filtrarOrdenarOperacoes(operacoes: readonly Operacao[], busca: string, ordem: OrdemOperacao, status: FiltroStatusOperacao = 'todos'): Operacao[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return operacoes.filter((operacao) => status === 'todos' || operacao.ativo === (status === 'ativos'))
    .filter((operacao) => !termo || [operacao.nome, operacao.descricao ?? ''].some((campo) => textoBusca(campo).includes(termo)))
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
