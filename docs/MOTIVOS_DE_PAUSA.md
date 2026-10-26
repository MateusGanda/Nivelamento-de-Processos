# Cadastro de motivos de pausa

A tela `/painel/motivos-de-pausa` usa o padrão visual e arquitetural do cadastro de Operações: listagem, busca, ordenação, filtro por status, formulário modal, edição, ativação/desativação e validação de nome obrigatório e único. O módulo fica em `modules/pause-reasons` e usa o modelo `MotivoPausa` já existente no contrato, sem migration nova.

Rotas, todas com sessão de ADMIN ativo:

- `GET /api/motivos-de-pausa` e `POST /api/motivos-de-pausa` (`{ nome, descricao? }`);
- `PATCH /api/motivos-de-pausa/[id]` (`{ nome?, descricao? }`);
- `PATCH /api/motivos-de-pausa/[id]/status` (`{ ativo }`).

Regras:

- nome obrigatório e único, com espaços das extremidades removidos; descrição opcional, vazia vira `null`;
- não há exclusão: o motivo usado em pausas é inativado;
- a ilha de apontamento lista somente motivos ativos, e a pausa com motivo inativo é recusada;
- as pausas já registradas continuam mostrando o motivo, mesmo inativo ou renomeado.

## Lista de motivos

Lista proposta para o cadastro. Os motivos são identificados só pelo nome, sem número: o identificador é gerado pelo banco, e a listagem fica em ordem alfabética.

| Nome | Descrição |
|---|---|
| Falta de material | Matéria-prima ou componentes indisponíveis. |
| Manutenção corretiva | Quebra ou falha que exige reparo. |
| Manutenção preventiva | Inspeções e manutenções programadas. |
| Ajuste de máquina/ferramenta | Regulagem, troca de ferramenta ou preparação. |
| Setup / troca de produto | Preparação para fabricar outro produto. |
| Falta de operador | Ausência ou falta de cobertura no posto. |
| Limpeza e organização | Limpeza do posto ou organização necessária. |
| Reunião/treinamento | Atividade interna que interrompe a produção. |

O seed de desenvolvimento (`npm run seed:desenvolvimento`, somente com `SEED_DATABASE_URL`) cria esses oito motivos e os usa nas pausas de exemplo.

## Cadastrar a lista em um banco existente

Cadastrar os motivos pela própria tela `/painel/motivos-de-pausa`. Motivos antigos que não devam mais ser usados são inativados na tela, sem apagar o histórico das pausas.

Não colocar scripts SQL dentro de `migrations/`: o Prisma 8 trata cada pasta ali como um espaço de migrations, e uma pasta sem os arquivos do Prisma faz `prisma db migrate`, `prisma migration status` e `prisma migration check` falharem.
