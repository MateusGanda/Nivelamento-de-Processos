import type { Ordem } from '../domain/ordem.ts';

export type ColunaOrdem = 'numero' | 'produto' | 'roteiro' | 'plano' | 'quantidade' | 'quantidadeExecucoes' | 'createdAt';
export type OrdemListagem = { coluna: ColunaOrdem; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

// planoId vazio mostra as ordens de todos os planos.
export function filtrarOrdenarOrdens(ordens: readonly Ordem[], busca: string, planoId: string, ordem: OrdemListagem): Ordem[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return ordens
    .filter((item) => !planoId || item.plano.id === planoId)
    .filter((item) => !termo || [item.numero, item.produto.codigo, item.produto.nome, item.roteiro.nome].some((campo) => textoBusca(campo).includes(termo)))
    .sort((a, b) => {
      let comparacao: number;
      if (ordem.coluna === 'produto') comparacao = collation.compare(a.produto.codigo, b.produto.codigo);
      else if (ordem.coluna === 'roteiro') comparacao = collation.compare(a.roteiro.nome, b.roteiro.nome) || a.roteiro.versao - b.roteiro.versao;
      else if (ordem.coluna === 'plano') comparacao = collation.compare(a.plano.codigo, b.plano.codigo);
      else if (ordem.coluna === 'quantidade' || ordem.coluna === 'quantidadeExecucoes') comparacao = a[ordem.coluna] - b[ordem.coluna];
      else if (ordem.coluna === 'createdAt') comparacao = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      else comparacao = collation.compare(a.numero, b.numero);
      return (comparacao || collation.compare(a.numero, b.numero) || a.id.localeCompare(b.id)) * (ordem.direcao === 'asc' ? 1 : -1);
    });
}

// Lê a quantidade digitada aceitando vírgula ou ponto; undefined indica valor inválido.
export function lerQuantidadeDigitada(texto: string): number | undefined {
  const limpo = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return undefined;
  const valor = Number(limpo);
  return valor > 0 && valor <= 9_999_999_999.99 ? valor : undefined;
}

export function formatarQuantidade(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export function formatarDataHora(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}
