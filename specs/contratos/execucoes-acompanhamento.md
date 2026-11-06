# Contrato do acompanhamento das execuções

Versão 1.1 — 05/11/2026. Responsável: Mateus.

Versão 1.1: campo `tempoPadraoSegundos` e sinais de atenção na tela (seção "Atenção").

**Status: implementado.** A página `/painel/execucoes` mostra as execuções abertas (em execução ou pausadas) e se atualiza sozinha. É somente leitura: nenhuma ação sobre a execução é feita pelo painel. Proposta aprovada pela equipe em 05/11/2026, para a etapa 9.

## Rota

`GET /api/execucoes`, somente para administrador ativo (mesma autorização de `/api/indicadores`). Não recebe parâmetros; os filtros são feitos na tela.

```json
{
  "meta": { "consultadoEm": "2026-11-05T14:05:00.000Z" },
  "execucoes": [{
    "id": "uuid", "status": "PAUSADA",
    "operador": { "matricula": "OF2-MON1", "nome": "Operador Fictício 5" },
    "ordem": { "id": "uuid", "numero": "OP-0004", "quantidade": 50, "unidade": "un" },
    "produto": { "codigo": "PRD-002", "nome": "Produto B" },
    "etapa": { "id": "uuid", "ordem": 2, "operacao": "Montagem" },
    "posto": { "id": "uuid", "codigo": "MON-01", "nome": "Montagem 1" },
    "setor": "Montagem",
    "tempoPadraoSegundos": 45,
    "eventos": [
      { "tipo": "INICIO", "dataHora": "2026-11-05T11:30:00.000Z", "motivo": null },
      { "tipo": "PAUSA", "dataHora": "2026-11-05T12:00:00.000Z", "motivo": "Falta de material" }
    ]
  }]
}
```

- **Lista:** execuções com status diferente de `FINALIZADA`, da mais antiga (primeiro `INICIO`) para a mais recente. Uma execução esquecida aberta aparece no topo.
- **`setor`:** setor do posto da execução.
- **`tempoPadraoSegundos`:** tempo padrão da etapa para o produto da ordem, em segundos por unidade (`ProdutoEtapa.tempoPadrao`); `null` se não estiver cadastrado.
- **`eventos`:** em ordem de data, com o nome do motivo nas pausas, no mesmo formato da ilha.
- **`meta.consultadoEm`:** horário do servidor na consulta. A tela conta o tempo a partir dele, e não do relógio do computador.
- **Erros** no formato `{ erro: { codigo, mensagem } }`: `400 ENTRADA_INVALIDA` com parâmetros, `401 NAO_AUTENTICADO` sem sessão, `403 SEM_AUTORIZACAO` para usuário inativo e `500 ERRO_INTERNO` sem detalhes. Todas as respostas com `Cache-Control: no-store`.

## Tela

- Tabela no computador e cartões abaixo de 1024 px: situação (com motivo e horário da pausa atual), operador, ordem e produto, etapa, posto e setor, início, tempo produtivo e tempo em pausa até agora.
- Os tempos usam a mesma regra da ilha e dos indicadores (`tempoDecorrido`): produtivo são os intervalos ativos e pausa são os intervalos pausados.
- Filtros por situação (todas, em execução, pausadas, com a contagem de cada) e por setor.
- Atualiza ao abrir, a cada 30 s com a aba visível, ao voltar para a aba e pelo botão **Atualizar**. Uma falha numa atualização mantém a lista anterior e informa de quando são os dados.
- Aviso fixo: o tempo é da execução e não mede o desempenho de uma pessoa.
- O botão **Abrir a ilha de apontamento** continua na página.

## Atenção

Decisão de 05/11/2026. A tela destaca a execução (faixa e texto em amarelo) e a conta no filtro **Com atenção** quando:

- **Acima do previsto:** o tempo produtivo até agora passa do previsto para a ordem, `tempoPadraoSegundos × quantidade`. Sem tempo padrão (ou com zero) não há comparação. A pausa não conta como tempo produtivo.
- **Iniciada em outro dia:** o primeiro `INICIO` é de um dia anterior ao de hoje, no horário de Brasília. É o sinal de uma execução esquecida aberta.

Os sinais só destacam a execução: não mudam o banco nem a execução, e não avaliam a pessoa. A comparação com o previsto usa a mesma base dos indicadores (tempo padrão por unidade).

## Fora deste contrato

- Encerrar, pausar ou alterar uma execução pelo painel. Encerrar uma execução esquecida seria uma regra nova (novo tipo de finalização, migração e regra para o tempo) e depende de decisão da equipe.
- Mostrar as execuções na ilha. A ilha continua mostrando somente a execução do operador identificado.

## Arquivos

- Rota: `app/api/execucoes/route.ts`; handler: `modules/executions/presentation/http-painel.ts`.
- Caso de uso: `ExecucoesService.listarAbertas` em `modules/executions/application/execucoes.ts`; consulta: `listarExecucoesAbertas` em `modules/executions/infrastructure/prisma-execucao-repository.ts`.
- Tela: `modules/executions/presentation/components/execucoes-acompanhamento.tsx`, com as funções puras em `modules/executions/presentation/acompanhamento.ts`.
- Testes: `tests/unit/executions/acompanhamento.test.ts` e a rota sem login em `tests/integration/access/login-http.test.ts`.
