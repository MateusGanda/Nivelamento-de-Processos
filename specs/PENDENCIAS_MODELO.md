# Pendências e fundamentos do modelo de dados

Atualizado em 21/10/2026. Responsável: Mateus.

O modelo de dados está em `src/prisma/contract.prisma` e as regras consolidadas em `docs/domain/MODELO_CONCEITUAL_GUNP_atualizado.md` e `docs/CONTEXTO_DO_PROJETO.md`; este documento não os repete. Ele guarda duas coisas que não estão em outro lugar do repositório: as respostas da empresa que fundamentaram o modelo e a lista de decisões ainda abertas.

As recomendações da seção "Decisões em aberto" são sugestões para a equipe avaliar, não decisões tomadas.

## Respostas do Ricardo (06/10/2026)

1. Ficha de Produção e Ordem de Produção são sinônimos. "Ficha" é o nome do documento físico.
2. A ficha representa uma quantidade definida de um único produto: é um lote físico. O mesmo produto pode estar em várias fichas.
3. Não é preciso controlar a execução individual por operador. Muitas atividades são feitas por células. O que importa é saber em qual etapa a ficha está e quando ocorreu a baixa.
4. O tempo padrão pertence a uma tarefa de uma etapa do processo e pode variar conforme o produto. O tempo de giro entre etapas, medido em dias, é outro conceito.
5. O posto está ligado a uma etapa do processo, não a uma pessoa, e os postos se organizam em setores.
6. Não existe baixa parcial: até a baixa, 100% da quantidade está pendente na etapa; na baixa, 100% é considerada produzida.

## Decisões em aberto

| # | Pendência | Por que importa | Recomendação | Quem decide |
| --- | --- | --- | --- | --- |
| 1 | **Quantidade negativa na baixa.** O banco aceita quantidade negativa, e a documentação não diz se isso fica só na validação do comando. | Uma baixa com valor negativo pode fechar a soma e passar pela conferência. | Recusar no comando de baixa. Avaliar também uma restrição de verificação no banco. | Equipe (a restrição altera o contrato) |
| 2 | **Técnica para uma execução aberta por operador.** A regra está definida (ver "Regra definida, falta implementar"), mas o `ARCHITECTURE.md` deixa a técnica como "A definir": restrição parcial, lock, controle otimista ou combinação. Hoje o banco aceita duas execuções abertas ou pausadas do mesmo operador. | A garantia precisa valer no PostgreSQL com dois comandos ao mesmo tempo, e ser coberta por teste. | Avaliar um índice único em `Execucao (operadorId)` para execuções sem `tipoFinalizacao`, como o que já existe para a baixa. | Equipe, na tarefa de início de execução (o índice altera o contrato) |
| 3 | **Entrada do tempo padrão.** O sistema trabalha com segundos por unidade produzida (decisão de 07/10). | Se a empresa registra em minutos ou centésimos de minuto, o valor precisa ser convertido ao cadastrar. | Perguntar à empresa em que unidade ela registra e converter no cadastro ou na importação. | Empresa informa |
| 4 | **Proteção contra reenvio.** Não há identificador de solicitação em `Execucao` nem em `EventoTempo`. | O `ARCHITECTURE.md` exige que duplo clique ou reenvio não dupliquem evento nem baixa. | Definir junto com os comandos de apontamento. | Equipe |
| 5 | **Correção de apontamento.** Não há histórico de correção. | Uma baixa errada precisa ser corrigida sem perder o registro original. | Definir antes do piloto. | Equipe |
| 6 | **Inativação de cadastros.** `Produto`, `Operacao` e `Setor` não têm `ativo`. | Cadastros usados em ordens não podem ser apagados. | Avaliar `ativo` nos três. | Equipe |
| 7 | **Categoria do motivo de pausa.** `MotivoPausa` só tem nome. | O painel não separa pausa prevista de interrupção. | Avaliar um campo de categoria. | Equipe |
| 8 | **Linha de produção.** O setor é o nível mais alto. | Com mais de uma linha, falta um agrupador. | Deixar para depois do piloto. | Equipe |

## Regra definida, falta implementar

As duas regras abaixo estão no modelo conceitual, no `CONTEXTO_DO_PROJETO.md`, no `ARCHITECTURE.md` e no `AGENTS.md`. Em 13/10/2026 ainda não existe o módulo de execução, e o contrato não tem restrição para nenhuma delas.

- **Soma das quantidades na baixa.** `boa + retrabalho + refugo = quantidade da ordem`, sem baixa parcial. O `ROADMAP_GUNP.md` (Fase 8) define que a validação é feita na transação da baixa. Até o comando existir, o banco aceita baixa com soma diferente; os cálculos de indicadores apenas sinalizam a etapa como inconsistente.
- **Uma execução aberta por operador.** O operador não pode ter duas execuções abertas, e a pausada continua ocupando o operador. A regra precisa valer também com solicitações concorrentes. A técnica está na pendência 2.

## Decidido

- **Unidade do tempo padrão (07/10):** `tempoPadrao` é em segundos por unidade produzida, na unidade da ordem, e não por lote.

## Já resolvido pelo contrato

- **Baixa efetiva (08/10).** `Execucao.tipoFinalizacao` distingue `BAIXA` de `TROCA_OPERACAO`. O banco garante uma única baixa por ordem e etapa, com as três quantidades; troca de operação e execução aberta ficam sem quantidades.
- **Quantidades sem padrão zero (08/10).** As três quantidades passaram a aceitar nulo, então "não informado" e "zero produzido" não se confundem mais.
- Pausa exige motivo, e cada produto tem um único roteiro vigente.
- Toda ordem pertence a um plano de produção (`planoProducaoId` obrigatório).
- `status` da execução e `tipo` do evento são enumerações.
- `Roteiro(nome, versao)`, `EtapaRoteiro(roteiroId, ordem)`, `ProdutoRoteiro(produtoId, roteiroId)` e `ProdutoEtapa(produtoId, etapaRoteiroId)` são únicos.
- **Usuários administrativos (12/10).** A tabela `Usuario`, com o papel `ADMIN`, entrou no contrato. `Usuario` e `Operador` são entidades distintas. O acesso operacional do terminal continua pendente, conforme o `CONTEXTO_DO_PROJETO.md`.

- **Setor principal, função e matrícula automática (21/10).** Decisões e implementação em `contratos/operadores-setores.md`: Setor.codigo permanente; Operador.funcao e setorPrincipalId opcionais no banco para legados, setor obrigatório nos novos cadastros, matrícula automática permanente. Migrations preparadas e testadas em PostgreSQL isolado, sem aplicação ao banco da equipe.
