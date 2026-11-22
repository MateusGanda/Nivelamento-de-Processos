import type { usePaginacaoTabela } from './use-paginacao-tabela';

const botao = 'min-h-11 rounded-md border border-line px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-[disabled=false]:cursor-pointer aria-[disabled=false]:hover:border-accent';

export function PaginacaoTabela({ legenda, paginacao, totalGeral }: {
  legenda: string;
  paginacao: Omit<ReturnType<typeof usePaginacaoTabela>, 'itens'>;
  totalGeral?: number;
}) {
  const { pagina, totalPaginas, inicio, fim, total, irPara } = paginacao;
  const primeira = pagina === 1;
  const ultima = pagina === totalPaginas;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 px-4 py-3 print:hidden sm:px-5">
      <p aria-live="polite" aria-atomic="true" className="text-xs text-muted">
        {total === 0 ? '0 resultados' : `${inicio}–${fim} de ${total}`}
        {totalGeral !== undefined && totalGeral !== total && ` · ${totalGeral} no total`}
      </p>
      {totalPaginas > 1 && (
        <nav aria-label={`Paginação: ${legenda}`} className="flex flex-wrap gap-2">
          {/* Mantém o foco no botão quando a navegação alcança a primeira ou a última página. */}
          <button type="button" aria-disabled={primeira} onClick={() => { if (!primeira) irPara(pagina - 1); }} className={botao}>Anterior</button>
          <button type="button" aria-disabled={ultima} onClick={() => { if (!ultima) irPara(pagina + 1); }} className={botao}>Próxima</button>
        </nav>
      )}
    </div>
  );
}
