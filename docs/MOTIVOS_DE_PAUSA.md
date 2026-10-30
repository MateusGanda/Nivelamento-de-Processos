# Cadastro de motivos de pausa

A tela `/painel/motivos-de-pausa` segue o padrão visual e arquitetural do cadastro de Operações: listagem, busca, ordenação, filtro por status, formulário modal, edição, ativação/desativação e validação de nome obrigatório e único.

## Lista de motivos

Os motivos são identificados **somente pelo nome, sem código ou número no início**. Use estes nomes ao cadastrar pela tela:

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

## Cadastro em um banco existente

Cadastre e mantenha os motivos pela própria tela `/painel/motivos-de-pausa`. Não é necessário executar SQL para inserir a lista oficial e não deve ser criada uma migration manual para isso.

Se já houver motivos com número no início do nome, edite-os pela tela para remover o prefixo. Se houver duplicatas ou motivos que não devam mais ser usados, inative-os pela tela em vez de apagar registros que possam estar associados ao histórico das pausas.

O script opcional `npm run seed:desenvolvimento` cria dados fictícios, incluindo estes motivos sem numeração, apenas no banco de desenvolvimento definido por `SEED_DATABASE_URL`. Não o execute no banco do site publicado.
