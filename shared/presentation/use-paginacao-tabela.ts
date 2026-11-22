import { useState } from 'react';

const ITENS_POR_PAGINA = 10;

export function paginarTabela<T>(itens: readonly T[], paginaSolicitada: number) {
  const total = itens.length;
  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const pagina = Math.min(totalPaginas, Math.max(1, paginaSolicitada));
  const deslocamento = (pagina - 1) * ITENS_POR_PAGINA;
  const fim = Math.min(deslocamento + ITENS_POR_PAGINA, total);

  return {
    itens: itens.slice(deslocamento, fim),
    pagina,
    totalPaginas,
    inicio: total > 0 ? deslocamento + 1 : 0,
    fim,
    total,
  };
}

export function usePaginacaoTabela<T>(itens: readonly T[], criterio = '') {
  const [selecao, setSelecao] = useState({ criterio, pagina: 1 });
  const mesmoCriterio = selecao.criterio === criterio;
  const paginacao = paginarTabela(itens, mesmoCriterio ? selecao.pagina : 1);

  // Guarda a página efetiva para que uma recarga posterior não volte a uma página já descartada.
  if (!mesmoCriterio || paginacao.pagina !== selecao.pagina) {
    setSelecao({ criterio, pagina: paginacao.pagina });
  }

  return {
    ...paginacao,
    chaveRolagem: `${paginacao.pagina}:${criterio}`,
    irPara: (pagina: number) => setSelecao({ criterio, pagina }),
  };
}
