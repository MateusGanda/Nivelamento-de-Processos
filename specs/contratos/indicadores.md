# Contrato de consulta dos indicadores

Versão de trabalho 0.1 — 04/10/2026. Responsável: Mateus. Revisão: Gustavo (contrato) e Arthur (dados do banco).

**Status: proposta para revisão.** A rota não está implementada. As fórmulas estão em `modules/indicators/domain/` e são testadas sem banco (`npm test`). Os exemplos em `exemplos/` usam dados fictícios.

Este contrato usa os nomes da proposta de modelo de banco. Se o schema mudar, este documento muda junto.

## Consulta

```text
GET /api/indicadores?inicio=<instante>&fim=<instante>&postoId=<uuid>
```

| Parâmetro | Obrigatório | Regra |
| --- | --- | --- |
| `inicio` | sim | ISO 8601 com fuso explícito. Inclusivo. |
| `fim` | sim | ISO 8601 com fuso explícito. Exclusivo. Posterior a `inicio`. |
| `postoId` | não | Sem ele, a resposta traz todos os postos ativos da linha piloto. |

O servidor valida filtros e permissão, lê o banco e aplica as funções de cálculo. O navegador nunca consulta o banco.

Respostas de erro: `400` para filtro inválido, `401`/`403` para falta de acesso, `404` para posto inexistente. O formato do corpo de erro segue o padrão que a equipe definir para toda a API.

## Convenções

- **Indisponível é `null`.** Dado ausente ou denominador zero nunca vira `0`. Zero significa zero medido.
- **Durações** em segundos. **Quantidades** em pares inteiros. **Percentuais** de 0 a 100, sem arredondamento; a tela formata.
- **Instantes** em ISO 8601 UTC. `meta.fuso` informa o fuso de exibição.
- **Ocupação acima de 100%** é carga planejada superior à disponibilidade. Não é gargalo comprovado.
- **Tempo sem informação** não é ociosidade.
- Valores planejados continuam identificados como planejados, mesmo quando o plano foi cadastrado com dados reais.

## Resposta

Exemplo completo: [`exemplos/indicadores-caso-base.json`](exemplos/indicadores-caso-base.json).

### `meta`

| Campo | Tipo | Significado |
| --- | --- | --- |
| `origem` | `FICTICIA` \| `APONTADA` | Se os dados vêm de seed ou de apontamento real. |
| `consultadoEm` | instante | Momento da consulta no servidor. |
| `fuso` | texto | `America/Sao_Paulo` no piloto. |
| `filtros` | objeto | `inicio`, `fim` e `postoId` efetivamente aplicados. |
| `pendencias` | lista | Motivos de indisponibilidade ou alerta de qualidade (ver abaixo). |

### `producaoFinalPares`

Número. Soma dos pares bons registrados no período na **última etapa** de cada ficha. Não depende do filtro de posto e nunca soma o mesmo par em etapas sucessivas.

### `postos[]`

Cada item tem `posto` (`id`, `codigo`, `nome`) e quatro blocos.

#### `producao[]` — uma linha por ficha-etapa

Entram as etapas com produção registrada neste posto no período ou com item de plano neste posto no período.

| Campo | Tipo | Significado |
| --- | --- | --- |
| `fichaEtapaId`, `fichaCodigo`, `ordemServicoCodigo`, `produtoCodigo` | texto | Identificação. Códigos são texto e preservam zeros à esquerda. |
| `operacaoCodigo`, `operacaoNome`, `sequencia` | texto, texto, inteiro | Cópia gravada na ficha-etapa. |
| `ultimaEtapa` | booleano | Se é a última sequência da ficha. |
| `previstoFichaPares` | inteiro | Quantidade da ficha. |
| `bonsAcumuladosPares` | inteiro | Pares bons da etapa em qualquer período e posto, líquidos de correções. |
| `saldoPares` | inteiro | `previstoFichaPares − bonsAcumuladosPares`. Não depende do período. |
| `excedePrevisto` | booleano | Sinaliza inconsistência; o servidor deve impedir o excesso. |
| `bonsNoPeriodoPares`, `refugoNoPeriodoPares` | inteiro | Registrados neste posto dentro do período. |
| `planejadoNoPeriodoPares` | inteiro \| `null` | Soma dos itens de plano deste posto cujo período está inteiro dentro da consulta. |
| `cumprimentoPercentual` | número \| `null` | `bonsNoPeriodoPares ÷ planejadoNoPeriodoPares × 100`. |

Saldo e cumprimento usam previstos diferentes: o saldo é da ficha inteira; o cumprimento é do plano do período.

#### `tempos[]` — uma linha por operador

Tempos apontados neste posto, recortados ao período. Operadores não são somados: a soma seria horas-pessoa, não tempo de funcionamento do posto.

| Campo | Tipo | Significado |
| --- | --- | --- |
| `operador` | objeto | `id`, `codigoCracha`, `nome`. |
| `porCategoriaSegundos` | objeto | `PRODUTIVO`, `APOIO_PREPARACAO`, `INTERRUPCAO`, `PAUSA_PREVISTA`. |
| `porMotivo[]` | lista | `categoria`, `motivo`, `segundos` dos intervalos não produtivos. |
| `classificadoSegundos` | número | Soma das quatro categorias. |
| `naoProdutivoApontadoSegundos` | número | Soma das três categorias não produtivas. Não significa perda evitável. |
| `cobertura` | objeto \| `null` | Ver abaixo. |

`cobertura` é do **operador no período, em todos os postos**, porque a janela prevista é do operador. Campos: `janelaSegundos`, `classificadoSegundos`, `semInformacaoSegundos`, `pausasProgramadasExcluidasSegundos`, `coberturaPercentual` (`null` se a janela no período for zero). Fica `null` enquanto não houver janela cadastrada para o operador.

Só entram intervalos encerrados. Execução aberta gera pendência e será tratada como valor provisório em entrega posterior.

#### `tempoMedioPorPar[]` — uma linha por produto e operação

| Campo | Tipo | Significado |
| --- | --- | --- |
| `produtoCodigo`, `operacaoCodigo` | texto | Agrupamento. |
| `execucoesEncerradas` | inteiro | Execuções deste posto encerradas dentro do período. |
| `produtivoSegundos`, `paresBons` | número, inteiro | Totais das execuções **inteiras**, sem recorte. |
| `segundosPorPar` | número \| `null` | `produtivoSegundos ÷ paresBons`. `null` com zero pares. |

Não é o ciclo da linha e pode incluir tempo gasto em pares refugados.

#### `carga[]` — uma linha por plano do posto

Entram os planos cujo período cruza a consulta. Cada plano mantém o próprio período; não há rateio.

| Campo | Tipo | Significado |
| --- | --- | --- |
| `planoPostoId`, `periodoInicio`, `periodoFim` | texto, instante, instante | Identificação do plano. |
| `disponibilidadeSegundos` | inteiro | Informada uma vez por posto e período. |
| `itens[]` | lista | `fichaEtapaId`, `fichaCodigo`, `operacaoCodigo`, `quantidadePlanejadaPares`, `tempoPadraoSegundosPorPar` (\| `null`), `cargaSegundos` (\| `null`), `postoDiferenteDoPrevisto`. |
| `referenciasPendentes` | inteiro | Itens sem tempo padrão. |
| `cargaSegundos` | número \| `null` | Soma dos itens. `null` se houver referência pendente. |
| `ocupacaoPlanejadaPercentual` | número \| `null` | `cargaSegundos ÷ disponibilidadeSegundos × 100`. `null` sem carga ou com disponibilidade zero. |

### Pendências

Cada item de `meta.pendencias` tem `codigo` e os identificadores a que se refere.

| Código | Quando aparece | Efeito |
| --- | --- | --- |
| `SEM_PLANO` | Posto sem plano no período. | `carga` vazia; `planejadoNoPeriodoPares` e cumprimento `null`. |
| `PLANO_PARCIAL_NO_PERIODO` | Plano cruza a consulta sem estar inteiro dentro dela. | Aparece em `carga`, mas não entra no cumprimento. |
| `SEM_TEMPO_PADRAO` | Item de plano sem tempo padrão. | Carga e ocupação do plano `null`. |
| `SEM_JANELA_OPERADOR` | Operador sem janela prevista no período. | `cobertura` `null`. |
| `EXECUCAO_ABERTA` | Execução não finalizada no período. | Intervalo aberto fora dos totais. |

## Dados que a consulta precisa do banco

Lista para conferência com o schema. Todas as leituras são filtradas pelo período e, quando informado, pelo posto.

| Bloco | Tabelas | Campos | Fase do banco |
| --- | --- | --- | --- |
| Postos | `Posto` | `id`, `codigo`, `nome`, `ativo` | 1 |
| Identificação da etapa | `FichaEtapa`, `Ficha`, `OrdemServico`, `Produto` | `sequencia`, `codigoOperacaoSnapshot`, `nomeOperacaoSnapshot`, `postoPrevistoId`, `Ficha.codigoLeitura`, `Ficha.quantidadePares`, `OrdemServico.codigo`, `Produto.codigo` | 1 |
| Produção | `RegistroProducao`, `Execucao` | `paresBons`, `paresRefugo`, `dataHora`, `Execucao.postoId`, `Execucao.fichaEtapaId` | 2 |
| Tempos | `IntervaloApontamento`, `Execucao`, `Operador` | `categoria`, `motivo`, `inicio`, `fim`, `Execucao.operadorId`, `Execucao.postoId`, `Operador.codigoCracha`, `Operador.nome` | 2 |
| Tempo médio | `Execucao` e os dois acima | `status`, `fim`, todos os intervalos produtivos e registros da execução | 2 |
| Carga | `PlanoPosto`, `PlanoPostoItem`, `FichaEtapa` | `periodoInicio`, `periodoFim`, `disponibilidadeSegundos`, `quantidadeParesPlanejada`, `tempoPadraoSegundosPorParSnapshot` | 3 |
| Cobertura | `JanelaOperador` | janela prevista e pausas programadas do operador | 4 |

Com a fase 1 já dá para responder postos e identificação das etapas. Produção e tempos dependem da fase 2, carga da fase 3 e cobertura da fase 4; até lá esses blocos saem vazios ou `null` com a pendência correspondente.

## Pontos em aberto

- **Origem dos dados:** de onde vem `FICTICIA` ou `APONTADA` (marca no seed, configuração do ambiente)?
- **Correções:** como um registro corrigido entra em "líquido de correções" (estorno ou substituição)?
- **Instante da produção:** o filtro de período usa `dataHora` (ocorrência), não `createdAt` (gravação). Confirmar com Gustavo.
- **Tempo médio por par:** selecionar execuções pelo `fim` dentro do período. Confirmar.
- **Intervalo de duração zero:** hoje o cálculo rejeita. Pausa e retomada no mesmo instante podem ocorrer?
- **Filtros adicionais:** produto, operação e operador ficam para a entrega de filtros (27/10).
- **Linha:** com mais de uma linha cadastrada, será preciso um filtro `linhaId`.
