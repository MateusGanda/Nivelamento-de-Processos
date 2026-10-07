# Pendências e fundamentos do modelo de dados

Atualizado em 07/10/2026. Responsável: Mateus.

O modelo de dados está em `src/prisma/contract.prisma` e as regras consolidadas em `docs/AI_CONTEXT.md`; este documento não os repete. Ele guarda duas coisas que não estão em outro lugar do repositório: as respostas da empresa que fundamentaram o modelo e a lista de decisões ainda abertas.

Nada aqui é decisão tomada. As recomendações são sugestões para a equipe avaliar.

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
| 1 | **Baixa efetiva.** Uma execução `FINALIZADA` é sempre a baixa da etapa? Como distinguir a finalização por troca de operação da finalização com baixa? | Sem isso não dá para dizer em qual etapa a ordem está, nem calcular produção e carga pendente. | Os cálculos de indicadores já adotam: a baixa é a execução finalizada que informa as quantidades (ver `contratos/indicadores.md`). Falta a equipe confirmar e registrar no `AI_CONTEXT.md`. | Equipe |
| 2 | **Quantidades com padrão zero.** `quantidadeBoa`, `quantidadeRetrabalho` e `quantidadeRefugo` nascem com 0. | Zero produzido e "ainda não informado" ficam iguais no banco. | Não bloqueia os cálculos: uma baixa válida soma a quantidade da ordem, que é maior que zero. Campos nulos deixariam o banco mais claro, mas é opcional. | Equipe (altera o contrato) |
| 3 | **Entrada do tempo padrão.** O sistema trabalha com segundos por unidade produzida (decisão de 07/10). | Se a empresa registra em minutos ou centésimos de minuto, o valor precisa ser convertido ao cadastrar. | Perguntar à empresa em que unidade ela registra e converter no cadastro ou na importação. | Empresa informa |
| 4 | **Proteção contra reenvio.** Não há identificador de solicitação em `Execucao` nem em `EventoTempo`. | O `ARCHITECTURE.md` exige que duplo clique ou reenvio não dupliquem evento nem baixa. | Definir junto com os comandos de apontamento. | Equipe |
| 5 | **Correção de apontamento.** Não há histórico de correção. | Uma baixa errada precisa ser corrigida sem perder o registro original. | Definir antes do piloto. | Equipe |
| 6 | **Inativação de cadastros.** `Produto`, `Operacao` e `Setor` não têm `ativo`. | Cadastros usados em ordens não podem ser apagados. | Avaliar `ativo` nos três. | Equipe |
| 7 | **Categoria do motivo de pausa.** `MotivoPausa` só tem nome. | O painel não separa pausa prevista de interrupção. | Avaliar um campo de categoria. | Equipe |
| 8 | **Linha de produção.** O setor é o nível mais alto. | Com mais de uma linha, falta um agrupador. | Deixar para depois do piloto. | Equipe |

## Decidido

- **Unidade do tempo padrão (07/10):** `tempoPadrao` é em segundos por unidade produzida, na unidade da ordem, e não por lote.

## Já resolvido pelo contrato

- Toda ordem pertence a um plano de produção (`planoProducaoId` obrigatório).
- `status` da execução e `tipo` do evento são enumerações.
- `Roteiro(nome, versao)`, `EtapaRoteiro(roteiroId, ordem)`, `ProdutoRoteiro(produtoId, roteiroId)` e `ProdutoEtapa(produtoId, etapaRoteiroId)` são únicos.
- Tabelas de usuário e permissão ficam por conta da solução de autenticação.
