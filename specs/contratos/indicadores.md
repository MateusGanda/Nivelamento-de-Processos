# Contrato de consulta dos indicadores

Versão de trabalho 0.3 — 07/10/2026. Responsável: Mateus. Revisão: Gustavo (contrato) e Arthur (dados do banco).

**Status: proposta para revisão.** A rota não está implementada. Esta versão segue o contrato do banco em `src/prisma/contract.prisma` e as regras de `docs/AI_CONTEXT.md`. As decisões ainda abertas estão em [`PENDENCIAS_MODELO.md`](../PENDENCIAS_MODELO.md). Os exemplos em `exemplos/` usam dados fictícios.

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
- **Tempo padrão** em segundos por unidade produzida, na unidade da ordem. Não é por lote: a carga de um lote é a quantidade vezes o tempo padrão.
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
| `etapasInconsistentes` | inteiro | Etapas com quantidade informada que não forma uma baixa válida. |
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
| `tempoPadraoSegundos` | decimal \| `null` | `ProdutoEtapa.tempoPadrao`, em segundos por unidade. `null` quando não cadastrado. |

É média ponderada pela quantidade, não média de médias. Inclui o tempo gasto em unidades de retrabalho e refugo. Como o tempo padrão também é em segundos por unidade, `segundosPorUnidade` e `tempoPadraoSegundos` são diretamente comparáveis.

### `cargaPendente[]` — por etapa

Trabalho ainda sem baixa, estimado pelo tempo padrão. É a base para comparar a carga entre etapas e apoiar o nivelamento.

| Campo | Tipo | Significado |
| --- | --- | --- |
| `produtoCodigo`, `etapaRoteiroId`, `ordem`, `operacaoNome`, `unidade` | texto, texto, inteiro, texto, texto | Agrupamento. |
| `ordensPendentes` | inteiro | Ordens sem baixa nesta etapa. |
| `quantidadePendente` | decimal | Soma das quantidades dessas ordens. |
| `tempoPadraoSegundos` | decimal \| `null` | `ProdutoEtapa.tempoPadrao`, em segundos por unidade. |
| `cargaPendenteSegundos` | número \| `null` | `quantidadePendente × tempoPadraoSegundos`. `null` sem tempo padrão; nunca zero presumido. |
| `postosCompativeis[]` | lista | `id`, `codigo`, `nome` dos postos de `EtapaPosto`. |

A carga é por etapa, não por posto: a mesma etapa pode ser feita em vários postos, e o modelo não diz em qual ela será feita. Também não há ocupação percentual, porque o modelo não tem disponibilidade de posto.

### Pendências

Cada item de `meta.pendencias` tem `codigo` e os identificadores a que se refere.

| Código | Quando aparece | Efeito |
| --- | --- | --- |
| `SEM_TEMPO_PADRAO` | Produto e etapa sem registro em `ProdutoEtapa`. | `tempoPadraoSegundos` e `cargaPendenteSegundos` ficam `null`. |
| `EXECUCAO_ABERTA` | Execução não finalizada no período. | O intervalo aberto fica fora dos totais. |
| `ETAPA_SEM_POSTO` | Etapa sem nenhum posto em `EtapaPosto`. | `postosCompativeis` vazio. |
| `BAIXA_INCONSISTENTE` | Etapa com quantidade informada que não forma uma baixa válida (ver regra de baixa). | A etapa conta como sem baixa e entra em `etapasInconsistentes`. |

## Dados que a consulta precisa do banco

| Bloco | Tabelas | Campos |
| --- | --- | --- |
| Ordens | `OrdemProducao`, `Produto`, `PlanoProducao` | `numero`, `quantidade`, `unidade`, `roteiroId`, `Produto.codigo`, `Produto.nome`, `PlanoProducao.codigo` |
| Roteiro | `EtapaRoteiro`, `Operacao` | `roteiroId`, `ordem`, `Operacao.nome` |
| Baixas | `Execucao` | `ordemProducaoId`, `etapaRoteiroId`, `postoId`, `status`, `quantidadeBoa`, `quantidadeRetrabalho`, `quantidadeRefugo` |
| Tempos | `EventoTempo`, `MotivoPausa` | `execucaoId`, `tipo`, `dataHora`, `MotivoPausa.nome` |
| Postos | `Posto`, `Setor`, `EtapaPosto` | `codigo`, `nome`, `setorId`, `Setor.nome` |
| Tempo padrão | `ProdutoEtapa` | `produtoId`, `etapaRoteiroId`, `tempoPadrao` |

## Funções de cálculo

As funções ficam em `modules/indicators/domain/`, são puras e testadas em `tests/unit/indicators/domain/` (`npm test`).

| Bloco da resposta | Função | Observação |
| --- | --- | --- |
| `tempos` | `derivarIntervalos` e `calcularTempos` (`tempos.ts`) | Os intervalos saem dos eventos de cada execução; execução aberta não recebe término presumido. |
| `tempoMedio` | `calcularTempoMedioPorUnidade` (`tempos.ts`) | Média ponderada pela quantidade boa. |
| `ordens` | `identificarBaixa` e `calcularPosicao` (`producao.ts`) | Aplicam a regra de baixa abaixo. |
| `producao` | `somarResultados` e `conferirResultado` (`producao.ts`) | Somam as baixas e conferem com a quantidade da ordem. |
| `producaoFinal` | `calcularProducaoFinal` (`producao.ts`) | Quantidade boa da última etapa do roteiro. |
| `cargaPendente` | `calcularCargaPendente` (`carga.ts`) | Resultado em segundos. |

As quantidades são somadas em centésimos, porque o banco guarda duas casas decimais. A conversão dos valores do banco (texto para número, data para milissegundos) é responsabilidade da camada de infraestrutura.

## Regra de baixa usada nos cálculos

O `docs/AI_CONTEXT.md` registra como pendência que uma execução `FINALIZADA` não equivale, sozinha, à baixa efetiva da etapa. Os cálculos adotam a regra abaixo, proposta por Mateus em 07/10/2026 e **ainda não confirmada pela equipe**:

- A baixa de uma etapa é a execução `FINALIZADA` que informa quantidades.
- Uma execução finalizada por troca de operação fica com as três quantidades em zero e não é baixa.
- A baixa vale quando é única para a ordem e a etapa e quando `boa + retrabalho + refugo` é igual à quantidade da ordem.
- Qualquer outra combinação com quantidade informada (duas execuções com quantidade, soma diferente da ordem, quantidade em execução aberta) é inconsistência: a etapa conta como sem baixa e é sinalizada.

A regra funciona com o contrato atual, em que as quantidades nascem com zero, porque uma baixa válida sempre soma a quantidade da ordem, que é maior que zero. Os blocos `ordens`, `producao`, `producaoFinal` e `cargaPendente` dependem dela; `tempos` não. Se a equipe decidir de outra forma, só `identificarBaixa` muda.

## Pontos em aberto

- **Confirmação da regra de baixa** pela equipe, com registro no `docs/AI_CONTEXT.md`.
- **Tempo médio.** O tempo de execuções sem baixa (troca de operação) entra no tempo médio da etapa?
- **Entrada do tempo padrão.** O sistema guarda segundos por unidade. Se a empresa registra em outra unidade, a conversão acontece no cadastro ou na importação.
- **Categoria de pausa.** Sem categoria em `MotivoPausa`, o painel não separa pausa prevista de interrupção.
- **Cumprimento do plano.** `PlanoProducao` tem período e agrupa ordens. Vale um indicador de ordens concluídas sobre ordens do plano?
- **Origem dos dados.** De onde vem `FICTICIA` ou `APONTADA`?
- **Correção de baixa.** Como uma baixa corrigida entra nas somas.
