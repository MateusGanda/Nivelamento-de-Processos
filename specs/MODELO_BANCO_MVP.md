# Proposta de modelo de banco do MVP

Versão de trabalho — 04/10/2026. Autor: Mateus. Para: Arthur (banco) e Gustavo (fluxo de apontamento).

**A fase 1 está fechada e é o que precisamos para 06/10.** As fases 2 e 3 estão em revisão com o Gustavo; a estrutura deve se manter, mas alguns detalhes podem mudar. Os nomes podem ser adaptados ao padrão do código, desde que as regras de negócio sejam preservadas.

## Decisões de escopo

- `OrdemServico` e `Ficha` são entidades diferentes.
- Hipótese de trabalho, a confirmar com a empresa: uma Ordem de Serviço pode conter várias Fichas.
- Cada Ficha representa um produto/referência e uma quantidade em pares. Se uma ordem tiver produtos diferentes, cada um fica em uma Ficha própria.
- Cada Produto tem um roteiro vigente, formado por operações em sequência. Não teremos entidade `Roteiro` separada no MVP.
- Ao criar uma Ficha, as etapas do roteiro são copiadas para `FichaEtapa` (sequência, operação, tempo padrão e posto previsto). Alterações futuras no roteiro não alteram fichas já criadas.
- A quantidade prevista de cada etapa é a `quantidadePares` da Ficha; não há quantidade própria por etapa.
- Um Operador pode executar várias operações ao longo do dia, mas só uma execução aberta por vez, inclusive pausada.
- O Posto é um local físico da linha, independente do Operador.
- O leitor USB funciona como teclado: o sistema recebe o código digitado e localiza a Ficha ou o Operador.
- Comparação de cenários fica fora do MVP.

## Fase 1 — entrega de 06/10 (fechada)

### Linha — linha ou área produtiva

`id`, `codigo` único, `nome`, `ativo`.

### Posto — estação física da linha

`id`, `linhaId`, `codigo`, `nome`, `sequencia`, `ativo`.

Único: `(linhaId, codigo)`.

### Produto — produto ou referência produzida

`id`, `codigo` único, `descricao`, `ativo`.

### Operacao — catálogo de operações

`id`, `codigo` único, `nome`, `descricao`, `ativo`.

### OperacaoProduto — etapa do roteiro de um produto

`id`, `produtoId`, `operacaoId`, `postoPrevistoId`, `sequencia`, `tempoPadraoSegundosPorPar` (**pode ser nulo**), `tempoPadraoFonte` (opcional), `tempoPadraoData` (opcional), `ativo`.

Único: `(produtoId, sequencia)`. Quando informado, o tempo padrão deve ser maior que zero.

### OrdemServico — agrupador das Fichas

`id`, `codigo` único, `dataCriacao`, `dataPrevistaEntrega` (opcional), `status`, `createdAt`, `updatedAt`.

Status sugeridos: `ABERTA`, `CONCLUIDA`, `CANCELADA`. Não armazenar total de pares; ele é a soma das Fichas.

### Ficha — produção de um Produto dentro da Ordem de Serviço

`id`, `codigoLeitura` único, `ordemServicoId`, `produtoId`, `quantidadePares`, `status`, `dataPrevista` (opcional), `createdAt`, `updatedAt`.

Status sugeridos: `ABERTA`, `CONCLUIDA`, `CANCELADA`. `quantidadePares` inteiro maior que zero.

### FichaEtapa — cópia de uma etapa do roteiro aplicada à Ficha

`id`, `fichaId`, `operacaoProdutoId`, `sequencia`, `codigoOperacaoSnapshot`, `nomeOperacaoSnapshot`, `tempoPadraoSegundosPorParSnapshot` (**pode ser nulo**), `postoPrevistoId`, `createdAt`.

Único: `(fichaId, sequencia)`. A mesma operação pode aparecer mais de uma vez, em sequências diferentes. Sem campo de status: a situação da etapa é derivada da produção registrada.

### Seed da fase 1

Uma linha, poucos postos, um produto com roteiro, uma ordem e pelo menos uma ficha com etapas. Todos os dados fictícios.

## Fase 2 — fluxo de apontamento (em revisão com Gustavo)

### Usuario — acesso ao painel de gestão

`id`, `nome`, `email` único, `perfil` (`ADMIN` ou `GESTOR`), `ativo`, `createdAt`, `updatedAt`.

Campos de credencial e sessão ficam a critério do Arthur, conforme a biblioteca de autenticação escolhida. Não vamos construir autenticação própria.

### Operador — pessoa que realiza as operações

`id`, `codigoCracha` único, `nome`, `ativo`, `createdAt`, `updatedAt`.

### Execucao — trabalho de um Operador em uma FichaEtapa

`id`, `fichaEtapaId`, `operadorId`, `postoId` (posto real), `status` (`EM_EXECUCAO`, `PAUSADA`, `FINALIZADA`), `inicio`, `fim` (opcional), `solicitacaoId` único, `createdAt`.

O posto da execução registra onde o trabalho ocorreu; pode ser diferente do previsto.

### IntervaloApontamento — intervalo de tempo dentro de uma execução

`id`, `execucaoId`, `categoria` (`PRODUTIVO`, `APOIO_PREPARACAO`, `INTERRUPCAO`, `PAUSA_PREVISTA`), `motivo` (obrigatório quando não produtivo), `inicio`, `fim` (opcional), `solicitacaoId` único, `createdAt`.

Motivos iniciais sugeridos, a confirmar com Gustavo:

| Categoria | Motivos |
| --- | --- |
| Apoio/preparação | preparação, troca de modelo |
| Interrupção | falta de material, falha de equipamento, espera |
| Pausa prevista | intervalo previsto |

**Para o Gustavo:** a especificação previa eventos com intervalos derivados. Aqui gravamos o intervalo direto, como única fonte de verdade. Se concordar, atualizamos o `MVP_APONTAMENTO.md`.

### RegistroProducao — apontamentos incrementais de quantidade

`id`, `execucaoId`, `paresBons`, `paresRefugo`, `dataHora`, `solicitacaoId` único, `createdAt`.

Cada registro é um incremento; nunca sobrescrever. Os dois campos são inteiros não negativos e a soma deve ser maior que zero.

## Fase 3 — carga por posto (em revisão)

### PlanoPosto — disponibilidade de um Posto em um período

`id`, `postoId`, `periodoInicio`, `periodoFim`, `disponibilidadeSegundos`, `createdByUsuarioId`, `createdAt`, `updatedAt`.

Único: `(postoId, periodoInicio)`. A disponibilidade é informada uma vez por posto e período; períodos do mesmo posto não se sobrepõem (validar na aplicação).

### PlanoPostoItem — quantidade planejada de uma etapa naquele posto e período

`id`, `planoPostoId`, `fichaEtapaId`, `quantidadeParesPlanejada`.

Único: `(planoPostoId, fichaEtapaId)`. Se o posto do plano for diferente do posto previsto da etapa, o sistema avisa, mas **não bloqueia**: planejar uma etapa em outro posto é justamente a decisão de nivelamento.

## Fase 4 — previstas, ainda sem detalhamento

- `JanelaOperador`: janela prevista do operador e pausas programadas. Sem ela não há cobertura nem tempo "sem apontamento".
- `Correcao`: autor, motivo, instante e valores antes/depois. Define quais registros de produção são válidos.

## Relacionamentos principais

```text
Linha 1 ── N Posto

Produto 1 ── N OperacaoProduto N ── 1 Operacao
Posto   1 ── N OperacaoProduto

OrdemServico 1 ── N Ficha N ── 1 Produto
Ficha 1 ── N FichaEtapa N ── 1 OperacaoProduto
Posto 1 ── N FichaEtapa

Operador 1 ── N Execucao N ── 1 FichaEtapa
Posto    1 ── N Execucao
Execucao 1 ── N IntervaloApontamento
Execucao 1 ── N RegistroProducao

Posto      1 ── N PlanoPosto
PlanoPosto 1 ── N PlanoPostoItem N ── 1 FichaEtapa
Usuario    1 ── N PlanoPosto
```

## Regras de cálculo e validação

- Quantidades são inteiros em pares. Tempos padrão e disponibilidade são inteiros em segundos. A unidade real dos tempos da empresa ainda precisa ser confirmada.
- Tempo padrão ausente: a carga daquela etapa fica indisponível. Nunca tratar como zero.
- Carga planejada do posto: soma de `quantidadeParesPlanejada × tempoPadraoSegundosPorParSnapshot` dos itens do plano.
- Ocupação planejada: `carga ÷ disponibilidade × 100`. Disponibilidade ausente ou zero resulta em indisponível.
- Tempo produtivo: soma dos intervalos `PRODUTIVO`.
- Tempos não produtivos: somente intervalos apontados, apresentados por categoria e motivo. Pausa prevista não é perda.
- Períodos sem apontamento aparecem como "sem apontamento"; não inferir ociosidade.
- Tempo médio produtivo por par bom: `tempo produtivo ÷ pares bons` das execuções encerradas da mesma operação e produto. Não é o ciclo da linha.
- Produção acima da quantidade da Ficha naquela etapa é rejeitada.
- Timestamps em UTC no banco, exibidos em `America/Sao_Paulo`.

## Restrições técnicas

- IDs do tipo UUID.
- Índices nas chaves estrangeiras e nos campos de busca: códigos de Ficha, Produto, Operador e Ordem de Serviço; status e períodos.
- Não apagar registros já usados em produção; marcar cadastros como inativos.
- Uma execução não pode terminar antes de começar; intervalos do mesmo Operador não se sobrepõem.
- **Uma execução aberta por Operador, garantida também no banco:** índice único parcial em `operadorId` para execuções não finalizadas (SQL na migração). O mesmo vale para um intervalo aberto por execução.
- **Reenvio não duplica:** o `solicitacaoId` único faz a repetição de uma solicitação ser reconhecida em vez de gravar de novo.
- Transações ao iniciar, pausar, retomar ou finalizar uma execução e ao registrar produção.

## Fora do MVP

Comparação de cenários, câmeras/visão computacional, sensores/IoT, controle de estoque, compras, folha de pagamento e funcionalidades genéricas de PCP.
