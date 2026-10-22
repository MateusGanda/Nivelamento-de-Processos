import type { Operador } from '../domain/operador.ts';

export type ColunaOperador = 'nome' | 'matricula' | 'setor' | 'funcao' | 'ativo' | 'createdAt';
export type FiltroStatusOperador = 'todos' | 'ativos' | 'inativos';
export type OrdemOperador = { coluna: ColunaOperador; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function filtrarOrdenarOperadores(operadores: readonly Operador[], busca: string, status: FiltroStatusOperador, ordem: OrdemOperador): Operador[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return operadores.filter((operador) => {
    const correspondeStatus = status === 'todos' || (status === 'ativos' ? operador.ativo : !operador.ativo);
    return correspondeStatus && (!termo || [operador.nome, operador.matricula, operador.funcao ?? '', operador.setorPrincipal?.nome ?? '', operador.setorPrincipal?.codigo ?? ''].some((campo) => textoBusca(campo).includes(termo)));
  }).sort((a, b) => {
    let comparacao: number;
    if (ordem.coluna === 'createdAt') comparacao = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    else if (ordem.coluna === 'ativo') comparacao = Number(b.ativo) - Number(a.ativo);
    else if (ordem.coluna === 'setor') comparacao = collation.compare(a.setorPrincipal?.nome ?? '', b.setorPrincipal?.nome ?? '');
    else comparacao = collation.compare(a[ordem.coluna] ?? '', b[ordem.coluna] ?? '');
    return (comparacao || collation.compare(a.matricula, b.matricula) || a.id.localeCompare(b.id)) * (ordem.direcao === 'asc' ? 1 : -1);
  });
}

export function formatarDataCadastro(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}
