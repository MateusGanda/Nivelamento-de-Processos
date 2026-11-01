# Padrão de identificadores dos cadastros

Versão 1.0 — 22/10/2026. Diretriz aprovada: manter nos próximos cadastros a geração automática e permanente adotada em Operadores e Setores.

## Alcance e estado

Este contrato define o comportamento comum dos identificadores funcionais internos. Cada entidade mantém seu UUID como chave interna e seus relacionamentos por ID. O termo matrícula é usado para pessoas; outros cadastros usam código ou número conforme o domínio.

A geração já está implementada em Setores e Operadores, conforme [operadores-setores.md](operadores-setores.md). Produtos e Postos ainda recebem códigos manuais e editáveis. A adequação deles será feita em entregas próprias, uma tela por vez. Este documento não altera as APIs existentes nem confirma aplicação de migrations no banco da equipe.

O padrão comum é a geração no servidor, a unicidade e a permanência. O formato `INICIAIS[SEQUÊNCIA]-CODIGO_DO_SETOR` pertence ao Operador; não deve ser copiado para todas as entidades. As máscaras, bases e relações usadas por cada novo gerador precisam constar no contrato específico antes da implementação.

## Regras para as próximas entregas

1. Gerar o identificador no servidor ao criar o registro. O administrador informa os dados do cadastro, sem escolher a sequência nem editar o identificador gerado. POST e PATCH devem rejeitar esse campo quando a API do módulo for adaptada.
2. Manter o valor após alteração de nome, descrição, função, setor ou outros dados. Um segmento derivado de um vínculo representa a origem; o vínculo atual é consultado pelo relacionamento, nunca deduzido do código.
3. Preservar identificadores antigos, IDs e referências. A mudança para geração automática afeta novos registros; não converter códigos existentes silenciosamente. Registros inativos e valores legados continuam reservados.
4. Consultar os valores reservados e escolher o próximo número do grupo definido no contrato. Não usar quantidade de registros + 1, reutilizar lacunas nem limitar a sequência ao tamanho dos exemplos visuais.
5. Confirmar a unicidade por constraint no banco. Em colisão concorrente da constraint do identificador, consultar novamente, recalcular e repetir até dez tentativas. Esgotamento retorna 409 recuperável. Outros conflitos mantêm seu erro próprio, sem entrar nesse retry.
6. Quando houver base derivada de texto, definir normalização de acentos, caixa, espaços e pontuação, nomes curtos, ausência de letras e fallback. A normalização do gerador não altera a grafia do nome nem redefine a unicidade dos demais campos.
7. Definir explicitamente se a sequência é global ou por grupo. A matrícula ou código completo deve ser único dentro de sua entidade; isso não exige uma sequência compartilhada entre entidades.
8. Exibir o identificador confirmado pela API após gravar e permitir sua consulta e busca. O formulário informa que a geração é automática; uma eventual prévia não representa reserva.
9. Manter a regra pura no Domain, a coordenação e as tentativas na Application e Prisma/tradução de constraints na Infrastructure. A interface consome REST e não gera o valor definitivo.

Se futuramente houver exclusão física, o contrato deve prever como manter a reserva dos identificadores. Não introduzir exclusão que permita reaproveitá-los.

## Aplicação por entidade

| Cadastro | Estado verificado em 22/10/2026 | Próximo contrato |
| --- | --- | --- |
| Operador | Matrícula automática permanente; setor principal e função; legados preservados | Manter o formato e as regras aprovadas em Operadores e Setores. |
| Setor | Código automático permanente, com base do nome e sequência | Manter o código também quando a edição de setor for entregue. |
| Posto | Código manual obrigatório, inclusive editável; setor obrigatório | Adaptar para código automático permanente. Definir base, uso do setor de origem, sequência, fallback e compatibilidade dos códigos antigos. |
| Produto | Código manual obrigatório e editável | Adaptar a identificação interna ao padrão automático. Confirmar se o código atual também representa referência da empresa/SKU e como preservá-la, sem confundi-la com o identificador interno. |
| Operação | Nome único e descrição; sem código funcional | Avaliar a necessidade de código no contrato da revisão. Se adotado, será automático e permanente; não adicionar campo apenas para repetir a matrícula do operador. |
| Roteiro | Nome + versão; versão 1 inicial e próximas versões geradas no servidor | Preservar o versionamento existente. Versão é revisão do processo, não matrícula; um eventual código de família exige contrato próprio. |
| Plano de Produção / Ordem de Produção | Campos `codigo` / `numero` existem no modelo; telas ainda provisórias | Planejar geração automática com formato, escopo de sequência e preservação do histórico antes das telas. |
| Motivo de Pausa | Modelo tem nome, descrição e status; tela ainda provisória | Não exigir código manual na futura tela. Avaliar se um código funcional é necessário. |
| Usuário administrativo | API e bootstrap recebem matrícula manual usada no login; sem tela de cadastro | Planejar separadamente a identificação automática para futuros usuários. Sem vínculo de setor no modelo; não aplicar o gerador de Operador nem alterar logins existentes sem contrato de compatibilidade. |

Nenhum formato novo para Posto, Produto, Plano, Ordem ou Usuário está fechado neste documento. A diretriz de automação está definida; esses contratos precisam resolver o significado e o formato do identificador antes de mudar código.

## Compatibilidade e aceite por cadastro

Antes da implementação, registrar entrada/saída da API, campos proibidos, nomes de constraints, regra de geração, registros legados e consumidores afetados, incluindo seed e futura importação CSV. Referências externas eventualmente informadas pelo usuário devem ter significado próprio definido em contrato; não podem sobrescrever o identificador interno gerado.

Se houver alteração de schema, preparar migration versionada, sem reconstrução de tabelas; preencher valores necessários antes de NOT NULL/UNIQUE e verificar preservação dos dados em banco isolado. Aplicação no banco da equipe e execução de seed são etapas separadas, com autorização específica.

Verificar nomes curtos, acentos, bases iguais, fallback, colisões antigas/inativas, concorrência, dez tentativas, rejeição de valor manual e permanência após edições/transferências. Validar autorização, formulários, busca, confirmação do identificador, foco, erros e responsividade. Rodar os checks afetados e registrar limitações. Validar uma entrega antes de começar a seguinte.

O [mapeamento dos cadastros](../../docs/design/CADASTROS_GUNP.md) organiza as telas existentes e as propostas de detalhamento.
