# Pendências e fundamentos do modelo de dados

Atualizado em 26/10/2026. Responsável: Mateus.

O modelo de dados está em `src/prisma/contract.prisma` e as regras consolidadas em `docs/domain/MODELO_CONCEITUAL_GUNP_atualizado.md` e `docs/CONTEXTO_DO_PROJETO.md`; este documento não os repete. Ele guarda duas coisas que não estão em outro lugar do repositório: as respostas da empresa que fundamentaram o modelo e a lista de decisões ainda abertas. O script `docs/sql/schema.sql` mostra o banco que resulta das migrations.

As recomendações da seção "Decisões em aberto" são sugestões para a equipe avaliar, não decisões tomadas.

## Respostas do Ricardo (06/10/2026)

1. Ficha de Produção e Ordem de Produção são sinônimos. "Ficha" é o nome do documento físico.
2. A ficha representa uma quantidade definida de um único produto: é um lote físico. O mesmo produto pode estar em várias fichas.
3. Não é preciso controlar a execução individual por operador. Muitas atividades são feitas por células. O que importa é saber em qual etapa a ficha está e quando ocorreu a baixa.
4. O tempo padrão pertence a uma tarefa de uma etapa do processo e pode variar conforme o produto. O tempo de giro entre etapas, medido em dias, é outro conceito.
5. O posto está ligado a uma etapa do processo, não a uma pessoa, e os postos se organizam em setores.
6. Não existe baixa parcial: até a baixa, 100% da quantidade está pendente na etapa; na baixa, 100% é considerada produzida.

## Decisões em aberto

A numeração antiga foi mantida para não quebrar referências; os itens 1, 2, 4 e 6 foram resolvidos e estão em "Resolvido na implementação".

| # | Pendência | Por que importa | Recomendação | Quem decide |
| --- | --- | --- | --- | --- |
| 3 | **Entrada do tempo padrão.** O sistema trabalha com segundos por unidade produzida (decisão de 07/10). | Se a empresa registra em minutos ou centésimos de minuto, o valor precisa ser convertido ao cadastrar. | Perguntar à empresa em que unidade ela registra e converter no cadastro ou na importação. | Empresa informa |
| 5 | **Correção de apontamento.** Não há histórico de correção. | Uma baixa errada precisa ser corrigida sem perder o registro original. | Definir antes do piloto. | Equipe |
| 7 | **Categoria do motivo de pausa.** `MotivoPausa` só tem nome e descrição. | O painel não separa pausa prevista de interrupção. | Avaliar um campo de categoria. | Equipe |
| 8 | **Linha de produção.** O setor é o nível mais alto. | Com mais de uma linha, falta um agrupador. | Deixar para depois do piloto. | Equipe |
| 9 | **Limpeza da identificação na ilha por inatividade.** Hoje a identificação do operador só é limpa pelo botão Sair. | Outra pessoa pode usar a tela com a identificação anterior. A limpeza não pode pausar nem finalizar a execução. | Definir o tempo e o que a tela faz ao limpar; não alterar o banco. | Equipe |
| 10 | **Inativação de operador ao mesmo tempo que um início na ilha.** A regra "operador com execução aberta não pode ser inativado" é conferida antes da gravação, como as demais regras de cadastro. | Em um pedido exatamente simultâneo, o operador pode ficar inativo com uma execução aberta. Para corrigir, basta reativá-lo, encerrar a execução e inativá-lo de novo. | Avaliar na etapa de testes (10/11) travar o registro do operador nas duas transações. | Equipe |
| 11 | **Exclusão de ordem sem execuções.** A ordem não pode ser excluída. | Uma ordem criada por engano fica na lista e no plano. | Decidir se a exclusão é permitida enquanto a ordem não tem execuções. | Equipe |

## Decidido

- **Unidade do tempo padrão (07/10):** `tempoPadrao` é em segundos por unidade produzida, na unidade da ordem, e não por lote.
- **Roteiro com ordens (19/10):** as etapas ficam travadas e a mudança é feita em uma nova versão; os tempos padrão de um produto travam quando ele tem ordens na versão.
- **Cadastros inativos em vez de excluídos (22/10):** `ativo` em `Operacao`, `Produto` e `Setor`, além dos que já tinham (`Posto`, `Roteiro`, `Operador`, `MotivoPausa`).
- **Datas do plano como texto (22/10):** `PlanoProducao.dataInicio` e `dataFim` usam `DateString` (`AAAA-MM-DD`), sem mudar a coluna `date` do banco.
- **Acesso da ilha pela chave do terminal (25/10):** sem tabela de terminais nem papel novo; detalhes no `docs/technology/TECHNOLOGY.md`. Um usuário por terminal pode ser reavaliado se a empresa precisar controlar ou auditar terminal por terminal.
- **Motivos de pausa sem número no nome (26/10):** o motivo é identificado só pelo nome; a lista proposta está em `docs/MOTIVOS_DE_PAUSA.md`.
- **Operador com execução aberta não pode ser inativado (26/10):** a ilha recusa operador inativo, e a execução não poderia mais ser encerrada.

## Resolvido na implementação

- **1. Quantidade negativa na baixa (26/10).** O comando de baixa da ilha recusa quantidade negativa e mais de duas casas decimais. O banco não tem restrição para isso; quem gravar direto no banco não passa por essa validação.
- **2. Uma execução aberta por operador (26/10).** Índice único parcial `Execucao_operador_aberta_unica` em `Execucao (operadorId)` para status diferente de `FINALIZADA`, migration `20261026T0258_execucao_aberta_unica_por_operador`. Vale também com pedidos simultâneos: um deles recebe conflito.
- **4. Proteção contra reenvio (26/10).** Sem identificador de solicitação: o início é protegido pelo índice da pendência 2, a baixa pelo índice de baixa única, e pausa, retomada, troca e baixa só mudam a execução se ela ainda estiver no estado esperado. A tela da ilha também ignora um segundo clique durante o envio. Um reenvio não duplica evento nem baixa, mas recebe conflito (409) em vez de repetir a resposta anterior.
- **6. Inativação de cadastros (22/10).** `ativo` em `Operacao` e `Produto` (migration `20261022T1323_add_ativo_operacao_produto`) e em `Setor` (migration `20261022T1349_add_ativo_setor`).
- **Soma das quantidades na baixa (26/10).** `boa + retrabalho + refugo = quantidade da ordem` é conferida no comando de baixa, que só grava se a execução ainda estiver em andamento. A quantidade da ordem não muda depois que ela tem execuções. O banco não confere a soma.

## Já resolvido pelo contrato

- **Baixa efetiva (08/10).** `Execucao.tipoFinalizacao` distingue `BAIXA` de `TROCA_OPERACAO`. O banco garante uma única baixa por ordem e etapa, com as três quantidades; troca de operação e execução aberta ficam sem quantidades.
- **Quantidades sem padrão zero (08/10).** As três quantidades passaram a aceitar nulo, então "não informado" e "zero produzido" não se confundem mais.
- Pausa exige motivo, e cada produto tem um único roteiro vigente.
- Toda ordem pertence a um plano de produção (`planoProducaoId` obrigatório).
- `status` da execução e `tipo` do evento são enumerações.
- `Roteiro(nome, versao)`, `EtapaRoteiro(roteiroId, ordem)`, `ProdutoRoteiro(produtoId, roteiroId)` e `ProdutoEtapa(produtoId, etapaRoteiroId)` são únicos.
- **Usuários administrativos (12/10).** A tabela `Usuario`, com o papel `ADMIN`, entrou no contrato. `Usuario` e `Operador` são entidades distintas.
- **Setor principal, função e matrícula automática (21/10).** Decisões e implementação em `contratos/operadores-setores.md`: `Setor.codigo` permanente; `Operador.funcao` e `setorPrincipalId` opcionais no banco para legados, setor obrigatório nos novos cadastros, matrícula automática permanente.

Todas as migrations até `20261026T0258_execucao_aberta_unica_por_operador` estão aplicadas no banco do site publicado e no banco de desenvolvimento da equipe.
