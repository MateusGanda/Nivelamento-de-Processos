# Contrato de consulta dos indicadores

Versão de trabalho 0.2 — 06/10/2026. Responsável: Mateus. Revisão: Gustavo (contrato) e Arthur (dados do banco).

**Status: proposta para revisão.** A rota não está implementada. Esta versão segue o modelo de banco de 06/10 ([`MODELO_BANCO_MVP.md`](../MODELO_BANCO_MVP.md)) e substitui a 0.1. Os exemplos em `exemplos/` usam dados fictícios.

## O que mudou em relação à versão 0.1

- **Sem baixa parcial.** A produção de uma etapa é a baixa única da ordem; saiu o "realizado parcial".
- **Posição das ordens** virou bloco próprio: é a informação mais pedida pela empresa.
- **Tempos por posto**, não por operador. O operador é só o responsável pelo apontamento, e a etapa pode ser feita por uma célula.
- **Pausas por motivo**, sem as categorias apoio, interrupção e pausa prevista, que o modelo não tem.
- **Cobertura saiu.** O modelo não tem janela prevista de trabalho.
- **Ocupação por posto saiu.** O modelo não tem disponibilidade de posto. Entrou a carga pendente por etapa.
- **Quantidades decimais com unidade**, em vez de pares inteiros.

## Consulta

```text
GET /api/indicadores?inicio=<instante>&fim=<instante>&setorId=<uuid>&postoId=<uuid>
```

| Parâmetro | Obrigatório | Regra |
| --- | --- | --- |
| `inicio` | sim | ISO 8601 com fuso explícito. Inclusivo. |
| `fim` | sim | ISO 8601 com fuso explícito. Exclusivo. Posterior a `inicio`. |
| `setorId` | não | Restringe aos postos do setor. |
| `postoId` | não | Restringe a um posto. |

O servidor valida filtros e permissão, lê o banco e aplica as funções de cálculo. O navegador nunca consulta o banco.

Respostas de erro: `400` para filtro inválido, `401`/`403` para falta de acesso, `404` para setor ou posto inexistente. O formato do corpo de erro segue o padrão que a equipe definir para toda a API.

## Convenções

- **Indisponível é `null`.** Dado ausente ou denominador zero nunca vira `0`. Zero significa zero medido.
- **Durações** em segundos. **Percentuais** de 0 a 100, sem arredondamento; a tela formata.
- **Quantidades** são decimais e sempre acompanhadas da `unidade` da ordem. Quantidades de unidades diferentes não são somadas.
- **Instantes** em ISO 8601 UTC. `meta.fuso` informa o fuso de exibição.
- **Tempo é da execução, não da pessoa.** Como a etapa pode ser feita por uma célula, o tempo registrado não mede o esforço de um operador nem serve para avaliar desempenho individual.
- **Ausência de apontamento não é ociosidade.**
- **Carga pendente é uma estimativa** feita com o tempo padrão. Não comprova gargalo.

## Dois tipos de informação

- **Do período:** `producao`, `producaoFinal`, `tempos` e `tempoMedio` consideram só o que aconteceu entre `inicio` e `fim`.
- **Do momento da consulta:** `ordens` e `cargaPendente` mostram a situação atual, independentemente do período.

## Resposta

Exemplo completo: [`exemplos/indicadores-caso-base.json`](exemplos/indicadores-caso-base.json).

### `meta`

| Campo | Tipo | Significado |
| --- | --- | --- |
| `origem` | `FICTICIA` \| `APONTADA` | Se os dados vêm de seed ou de apontamento real. |
| `consultadoEm` | instante | Momento da consulta no servidor. |
| `fuso` | texto | `America/Sao_Paulo` no piloto. |
| `filtros` | objeto | `inicio`, `fim`, `setorId` e `postoId` efetivamente aplicados. |
| `pendencias` | lista | Motivos de indisponibilidade ou alerta de qualidade (ver abaixo). |

### `ordens[]` — posição de cada ordem

Uma linha por ordem de produção que ainda tem etapa sem baixa ou que teve baixa no período.

| Campo | Tipo | Significado |
| --- | --- | --- |
| `ordemId`, `numero` | texto | Identificação. O número é texto e preserva zeros à esquerda. |
| `produtoCodigo`, `produtoNome` | texto | Produto da ordem. |
| `quantidade`, `unidade` | decimal, texto | Tamanho do lote. |
| `planoCodigo` | texto \| `null` | Plano de produção que agrupa a ordem. |
| `etapasTotal`, `etapasBaixadas` | inteiro | Etapas do roteiro da ordem e quantas já têm baixa. |
| `etapaAtual` | objeto \| `null` | Primeira etapa sem baixa, pela ordem do roteiro: `etapaRoteiroId`, `ordem`, `operacaoNome`. `null` quando todas têm baixa. |
| `emExecucao` | booleano | Se há execução aberta na etapa atual. |
| `ultimaBaixaEm` | instante \| `null` | Momento da baixa mais recente. |

A ordem das etapas é só nominal. `etapaAtual` é a primeira sem baixa, mas o sistema não impede que uma etapa posterior seja baixada antes.

### `producao[]` — baixas do período por produto e etapa

| Campo | Tipo | Significado |
| --- | --- | --- |
| `produtoCodigo`, `etapaRoteiroId`, `ordem`, `operacaoNome` | texto, texto, inteiro, texto | Agrupamento. |
| `ultimaEtapa` | booleano | Se é a última etapa do roteiro. |
| `unidade` | texto | Unidade das quantidades. |
| `ordensBaixadas` | inteiro | Ordens que tiveram baixa nesta etapa no período. |
| `quantidadeBoa`, `quantidadeRetrabalho`, `quantidadeRefugo` | decimal | Somas das baixas do período. |

A baixa pertence ao período pelo instante do evento `FINALIZACAO` da execução que a registrou.

### `producaoFinal[]` — por produto

Soma da `quantidadeBoa` das baixas do período na **última etapa** de cada roteiro: `produtoCodigo`, `unidade`, `quantidadeBoa`. O mesmo lote nunca é somado em etapas sucessivas. Não depende do filtro de setor ou posto.

### `tempos[]` — por posto

Tempos das execuções do posto, recortados ao período.

| Campo | Tipo | Significado |
| --- | --- | --- |
| `posto` | objeto | `id`, `codigo`, `nome`, `setorNome`. |
| `produtivoSegundos` | número | Soma dos intervalos entre `INICIO` ou `RETOMADA` e a `PAUSA` ou `FINALIZACAO` seguinte. |
| `pausaSegundos` | número | Soma dos intervalos entre `PAUSA` e `RETOMADA`. |
| `pausasPorMotivo[]` | lista | `motivoNome`, `segundos`, `ocorrencias`. |
| `execucoesFinalizadas`, `execucoesAbertas` | inteiro | Execuções do posto no período. |

Só entram intervalos fechados. Uma execução aberta gera pendência e não recebe horário de término presumido. Pausa não é automaticamente perda: o motivo é que permite interpretar.

### `tempoMedio[]` — por produto e etapa

| Campo | Tipo | Significado |
| --- | --- | --- |
| `produtoCodigo`, `etapaRoteiroId`, `operacaoNome`, `unidade` | texto | Agrupamento. |
| `execucoesConsideradas` | inteiro | Execuções finalizadas com baixa dentro do período. |
| `produtivoSegundos` | número | Tempo produtivo das execuções **inteiras**, sem recorte. |
| `quantidadeBoa` | decimal | Soma das baixas dessas execuções. |
| `segundosPorUnidade` | número \| `null` | `produtivoSegundos ÷ quantidadeBoa`. `null` com quantidade boa zero. |
| `tempoPadrao` | decimal \| `null` | Valor de `PRODUTO_ETAPA`. `null` quando não cadastrado. |

É média ponderada pela quantidade, não média de médias. Inclui o tempo gasto em unidades de retrabalho e refugo. A comparação com `tempoPadrao` só vale depois de definida a unidade do tempo padrão.

### `cargaPendente[]` — por etapa

Trabalho ainda sem baixa, estimado pelo tempo padrão. É a base para comparar a carga entre etapas e apoiar o nivelamento.

| Campo | Tipo | Significado |
| --- | --- | --- |
| `produtoCodigo`, `etapaRoteiroId`, `ordem`, `operacaoNome`, `unidade` | texto, texto, inteiro, texto, texto | Agrupamento. |
| `ordensPendentes` | inteiro | Ordens sem baixa nesta etapa. |
| `quantidadePendente` | decimal | Soma das quantidades dessas ordens. |
| `tempoPadrao` | decimal \| `null` | Valor de `PRODUTO_ETAPA`. |
| `cargaPendente` | número \| `null` | `quantidadePendente × tempoPadrao`. `null` sem tempo padrão; nunca zero presumido. |
| `postosCompativeis[]` | lista | `id`, `codigo`, `nome` dos postos de `ETAPA_POSTO`. |

A carga é por etapa, não por posto: a mesma etapa pode ser feita em vários postos, e o modelo não diz em qual ela será feita. Também não há ocupação percentual, porque o modelo não tem disponibilidade de posto.

### Pendências

Cada item de `meta.pendencias` tem `codigo` e os identificadores a que se refere.

| Código | Quando aparece | Efeito |
| --- | --- | --- |
| `SEM_TEMPO_PADRAO` | Produto e etapa sem registro em `PRODUTO_ETAPA`. | `tempoPadrao` e `cargaPendente` ficam `null`. |
| `EXECUCAO_ABERTA` | Execução não finalizada no período. | O intervalo aberto fica fora dos totais. |
| `ETAPA_SEM_POSTO` | Etapa sem nenhum posto em `ETAPA_POSTO`. | `postosCompativeis` vazio. |
| `BAIXA_INCONSISTENTE` | Soma de boa, retrabalho e refugo diferente da quantidade da ordem. | A baixa aparece, sinalizada. |

## Dados que a consulta precisa do banco

| Bloco | Tabelas | Campos |
| --- | --- | --- |
| Ordens | `ORDEM_PRODUCAO`, `PRODUTO`, `PLANO_PRODUCAO` | `numero`, `quantidade`, `unidade`, `roteiroId`, `PRODUTO.codigo`, `PRODUTO.nome`, `PLANO_PRODUCAO.codigo` |
| Roteiro | `ETAPA_ROTEIRO`, `OPERACAO` | `roteiroId`, `ordem`, `OPERACAO.nome` |
| Baixas | `EXECUCAO` | `ordemProducaoId`, `etapaRoteiroId`, `postoId`, `status`, `quantidadeBoa`, `quantidadeRetrabalho`, `quantidadeRefugo` |
| Tempos | `EVENTO_TEMPO`, `MOTIVO_PAUSA` | `execucaoId`, `tipo`, `dataHora`, `MOTIVO_PAUSA.nome` |
| Postos | `POSTO`, `SETOR`, `ETAPA_POSTO` | `codigo`, `nome`, `setorId`, `SETOR.nome` |
| Tempo padrão | `PRODUTO_ETAPA` | `produtoId`, `etapaRoteiroId`, `tempoPadrao` |

## Impacto no código de cálculo

As funções de `modules/indicators/domain/` foram escritas para a versão 0.1 e precisam de ajuste antes de servir a este contrato.

| Arquivo | Situação |
| --- | --- |
| `tempos.ts` | `calcularTempos` trabalha com intervalos e quatro categorias. Falta o adaptador de eventos para intervalos, e as categorias passam a ser "produtivo" e "pausa por motivo". A parte de cobertura deixa de ser usada. `calcularTempoMedioPorPar` continua válida, mas precisa aceitar quantidade decimal. |
| `producao.ts` | `calcularProducaoFinal` continua válida. `calcularSaldo` e `calcularCumprimento` pressupõem baixa parcial e deixam de ser usadas neste contrato. |
| `carga.ts` | `calcularCarga` serve à carga pendente quando chamada sem disponibilidade. |
| `validacao.ts` | `quantidade()` exige inteiro; o modelo agora usa decimal. |
| Testes | PROD-01 (baixas de 30 e 20) e o teste de baixa parcial descrevem um comportamento que não existe mais. TEMPO-01 e TEMPO-02 continuam válidos; TEMPO-03 (cobertura) e CARGA-01 (ocupação) saem do escopo. |

## Pontos em aberto

- **Unidade do tempo padrão.** Sem ela, `cargaPendente` e a comparação com o tempo médio não têm unidade definida. Os exemplos supõem segundos por unidade.
- **Várias execuções na mesma etapa.** O tempo de execuções sem baixa entra no tempo médio da etapa?
- **Categoria de pausa.** Sem categoria em `MOTIVO_PAUSA`, o painel não separa pausa prevista de interrupção.
- **Cumprimento do plano.** `PLANO_PRODUCAO` tem período e agrupa ordens. Vale um indicador de ordens concluídas sobre ordens do plano?
- **Origem dos dados.** De onde vem `FICTICIA` ou `APONTADA`?
- **Correção de baixa.** Como uma baixa corrigida entra nas somas.
