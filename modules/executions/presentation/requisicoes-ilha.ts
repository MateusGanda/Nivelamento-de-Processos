type EfeitosRequisicao<T> = {
  iniciar: () => void;
  concluir: (resultado: T) => void;
  falhar: (erro: unknown) => void;
  finalizar: () => void;
};

// Uma resposta só pode atualizar a identificação enquanto seu pedido ainda é o atual.
// O signal cancela consultas; invalidar não desfaz gravações já enviadas ao servidor.
export function criarControleRequisicoesIlha() {
  let atual: AbortController | null = null;

  return {
    emAndamento: () => atual !== null,

    invalidar() {
      const anterior = atual;
      atual = null;
      anterior?.abort();
    },

    async executar<T>(acao: (signal: AbortSignal) => Promise<T>, efeitos: EfeitosRequisicao<T>): Promise<void> {
      if (atual) return;
      const pedido = new AbortController();
      atual = pedido;
      try {
        efeitos.iniciar();
        const resultado = await acao(pedido.signal);
        if (atual === pedido) efeitos.concluir(resultado);
      } catch (erro) {
        if (atual === pedido) efeitos.falhar(erro);
      } finally {
        // Um pedido invalidado não pode liberar os controles de um pedido mais novo.
        if (atual === pedido) {
          atual = null;
          efeitos.finalizar();
        }
      }
    },
  };
}
