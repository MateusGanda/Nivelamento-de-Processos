import type { Posto } from '../domain/posto.ts';

export type ColunaPosto = 'codigo' | 'nome' | 'setor' | 'ativo' | 'createdAt';
export type FiltroStatusPosto = 'todos' | 'ativos' | 'inativos';
export type OrdemPosto = { coluna: ColunaPosto; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

export function filtrarOrdenarPostos(postos: readonly Posto[], busca: string, status: FiltroStatusPosto, ordem: OrdemPosto): Posto[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return postos.filter((posto) => {
    const correspondeStatus = status === 'todos' || (status === 'ativos' ? posto.ativo : !posto.ativo);
    return correspondeStatus && (!termo || [posto.codigo, posto.nome, posto.setor.nome].some((campo) => textoBusca(campo).includes(termo)));
  }).sort((a, b) => {
    let comparacao: number;
    if (ordem.coluna === 'createdAt') comparacao = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    else if (ordem.coluna === 'ativo') comparacao = Number(b.ativo) - Number(a.ativo);
    else if (ordem.coluna === 'setor') comparacao = collation.compare(a.setor.nome, b.setor.nome);
    else comparacao = collation.compare(a[ordem.coluna], b[ordem.coluna]);
    return (comparacao || collation.compare(a.codigo, b.codigo) || a.id.localeCompare(b.id)) * (ordem.direcao === 'asc' ? 1 : -1);
  });
}

export function formatarDataCadastro(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}
