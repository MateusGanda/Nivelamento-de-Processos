import type { EtapaDoRoteiro, OperacaoDoRoteiro, RoteiroResumo } from '../domain/roteiro.ts';

export type ColunaRoteiro = 'nome' | 'versao' | 'quantidadeEtapas' | 'quantidadeOrdens' | 'ativo' | 'updatedAt';
export type FiltroStatusRoteiro = 'todos' | 'ativos' | 'inativos';
export type OrdemRoteiro = { coluna: ColunaRoteiro; direcao: 'asc' | 'desc' };

function textoBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

export function filtrarOrdenarRoteiros(roteiros: readonly RoteiroResumo[], busca: string, status: FiltroStatusRoteiro, ordem: OrdemRoteiro): RoteiroResumo[] {
  const termo = textoBusca(busca.trim());
  const collation = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  return roteiros.filter((roteiro) => {
    const correspondeStatus = status === 'todos' || (status === 'ativos' ? roteiro.ativo : !roteiro.ativo);
    return correspondeStatus && (!termo || textoBusca(roteiro.nome).includes(termo));
  }).sort((a, b) => {
    let comparacao: number;
    if (ordem.coluna === 'nome') comparacao = collation.compare(a.nome, b.nome) || a.versao - b.versao;
    else if (ordem.coluna === 'ativo') comparacao = Number(b.ativo) - Number(a.ativo);
    else if (ordem.coluna === 'updatedAt') comparacao = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    else comparacao = a[ordem.coluna] - b[ordem.coluna];
    return (comparacao || collation.compare(a.nome, b.nome) || a.versao - b.versao) * (ordem.direcao === 'asc' ? 1 : -1);
  });
}

// Etapa em edição na tela: id ausente indica etapa nova, ainda não gravada.
export type EtapaEmEdicao = { chave: string; id?: string; operacao: OperacaoDoRoteiro };

export function paraEdicao(etapas: readonly EtapaDoRoteiro[]): EtapaEmEdicao[] {
  return etapas.map((etapa) => ({ chave: etapa.id, id: etapa.id, operacao: etapa.operacao }));
}

export function moverEtapa(etapas: readonly EtapaEmEdicao[], indice: number, deslocamento: -1 | 1): EtapaEmEdicao[] {
  const destino = indice + deslocamento;
  if (indice < 0 || indice >= etapas.length || destino < 0 || destino >= etapas.length) return [...etapas];
  const copia = [...etapas];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

export function etapasAlteradas(originais: readonly EtapaDoRoteiro[], editadas: readonly EtapaEmEdicao[]): boolean {
  return originais.length !== editadas.length || originais.some((etapa, indice) => etapa.id !== editadas[indice].id);
}

export function formatarData(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}

// Lê o tempo digitado em segundos, aceitando vírgula ou ponto. Vazio é nulo (sem tempo);
// undefined indica valor inválido.
export function lerTempoDigitado(texto: string): number | null | undefined {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return undefined;
  const valor = Number(limpo);
  return valor > 0 && valor <= 99_999_999.99 ? valor : undefined;
}

export function formatarSegundos(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s`;
}
