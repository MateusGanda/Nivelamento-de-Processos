# Padrão de identificadores dos cadastros

Versão 1.1 — 24/11/2026. Diretriz aprovada: manter nos próximos cadastros a geração automática e permanente adotada em Operadores e Setores.

## Alcance e estado

Este contrato define o comportamento comum dos identificadores funcionais internos. Cada entidade mantém seu UUID como chave interna e seus relacionamentos por ID. O termo matrícula é usado para pessoas; outros cadastros usam código ou número conforme o domínio.

A geração está implementada em Setores e Operadores, conforme [operadores-setores.md](operadores-setores.md), e em Postos, Produtos, Planos e Ordens, conforme o contrato abaixo. A mudança não altera schema nem exige migration; preserva os valores já persistidos. Não confirma deployment ou execução de seed no banco da equipe.

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

| Cadastro | Estado atualizado em 24/11/2026 | Próximo contrato |
| --- | --- | --- |
| Operador | Matrícula automática permanente; setor principal e função; legados preservados | Manter o formato e as regras aprovadas em Operadores e Setores. |
| Setor | Código automático permanente, com base do nome e sequência | Manter o código permanente na edição de nome/descrição, já entregue. |
| Posto | Código automático permanente `PST-0001`; nome e setor obrigatórios | Sequência global da entidade, independente do setor e nome. Legados preservados. |
| Produto | Código interno automático permanente `PRD-0001`; nome obrigatório | Sem campo adicional de SKU; legados preservados. |
| Operação | Nome único e descrição; sem código funcional | Avaliar a necessidade de código no contrato da revisão. Se adotado, será automático e permanente; não adicionar campo apenas para repetir a matrícula do operador. |
| Roteiro | Nome + versão; versão 1 inicial e próximas versões geradas no servidor | Preservar o versionamento existente. Versão é revisão do processo, não matrícula; um eventual código de família exige contrato próprio. |
| Plano de Produção / Ordem de Produção | Código automático permanente `PLN-0001` e número automático permanente `OP-0001` | Sequência global independente por entidade; sem sugestão do número no navegador. Legados preservados. |
| Motivo de Pausa | Tela entregue; identificado só pelo nome, sem código | Avaliar se um código funcional é necessário; não exigir código manual. |
| Usuário administrativo | API e bootstrap recebem matrícula manual usada no login; sem tela de cadastro | Planejar separadamente a identificação automática para futuros usuários. Sem vínculo de setor no modelo; não aplicar o gerador de Operador nem alterar logins existentes sem contrato de compatibilidade. |

## Contrato de Postos, Produtos, Planos e Ordens

Decisão de 24/11/2026: identificadores internos automáticos e permanentes, sem opção manual. As quatro sequências são independentes e globais por entidade, sem nome, setor, produto, plano, data ou ano como grupo. O UUID continua sendo a chave de relacionamento e do QR da ordem.

| Entidade | Campo retornado | Prefixo | Constraint existente |
| --- | --- | --- | --- |
| Posto | `codigo` | `PST-` | `Posto_codigo_key` |
| Produto | `codigo` | `PRD-` | `Produto_codigo_key` |
| Plano | `codigo` | `PLN-` | `PlanoProducao_codigo_key` |
| Ordem | `numero` | `OP-` | `OrdemProducao_numero_key` |

O gerador considera todos os registros, inclusive inativos. Somente o prefixo exato em maiúsculas seguido de dígitos participa do cálculo. `PRD-001` reserva o sufixo 1; valores como `PRD-X` e outros formatos permanecem intactos, sem participar do máximo. O próximo valor usa o maior sufixo + 1, mínimo de quatro dígitos e aritmética inteira sem perda de precisão (`BigInt`): `9999` é seguido por `10000`. Não preencher lacunas nem truncar valores. Não há exclusão física no cadastro que permita reaproveitar identificadores.

Cada gravação é protegida pela constraint existente. A aplicação tenta até dez gravações, relendo os reservados e recalculando após cada colisão específica de identificador. Só essa violação vira o erro de reserva que permite retry; erros de outros campos, vínculos e infraestrutura não repetem a criação. Após dez colisões, a API retorna 409 recuperável.

### Entradas e respostas HTTP

Autorização administrativa, URLs, status de criação (201), alteração (200) e formato de resposta são preservados. POST e PATCH rejeitam `codigo` ou `numero` com 400, inclusive se o valor for igual ao atual, nulo ou acompanhado de campos válidos. GET e respostas de gravação continuam retornando o identificador confirmado e os mesmos IDs e vínculos.

| Rota base | POST: campos aceitos | PATCH `/[id]`: campos aceitos |
| --- | --- | --- |
| `/api/postos` | `nome`, `setorId` | `nome`, `setorId` |
| `/api/produtos` | `nome` | `nome` |
| `/api/planos-de-producao` | `descricao`, `dataInicio`, `dataFim` (opcionais; `{}` é válido) | `descricao`, `dataInicio`, `dataFim` |
| `/api/ordens-de-producao` | `planoId`, `produtoId`, `roteiroId`, `quantidade`, `unidade` | `planoId`, `quantidade`, `unidade` |

Edições continuam exigindo ao menos um campo permitido. Os tipos de criação pública não recebem identificador; os tipos de persistência incluem o valor gerado pelo serviço. Permanecem as regras de setor/produto/roteiro ativos, período válido do plano, versão do roteiro congelada na ordem e bloqueio de quantidade/unidade depois de execuções.

### Interface e compatibilidade

No cadastro, o formulário explica a geração automática e não apresenta entrada para o identificador. Na edição, exibe o valor atual somente para leitura. O primeiro campo editável recebe foco. O sucesso usa o identificador retornado pela API; se a gravação foi confirmada e a recarga falhar, a mensagem mantém o código/número e orienta recarregar sem repetir a operação. Listagem, busca, ordenação e ficha com QR continuam usando os valores persistidos, inclusive legados.

Nenhum registro existente é recodificado: IDs, códigos/números, timestamps e relacionamentos permanecem. Edições normais atualizam apenas seus campos e `updatedAt`. Os scripts de população usam os geradores para novos identificadores; aliases dos cenários continuam resolvendo os vínculos por ID. Sua execução e alterações no banco exigem autorização separada. Dados legados fixos de testes permanecem para validar compatibilidade. Importações futuras devem omitir o identificador público e seguir a geração do serviço.

O formato de Usuário administrativo continua fora desta entrega, preservando os logins existentes.

## Compatibilidade e aceite por cadastro

Antes da implementação, registrar entrada/saída da API, campos proibidos, nomes de constraints, regra de geração, registros legados e consumidores afetados, incluindo seed e futura importação CSV. Referências externas eventualmente informadas pelo usuário devem ter significado próprio definido em contrato; não podem sobrescrever o identificador interno gerado.

Se houver alteração de schema, preparar migration versionada, sem reconstrução de tabelas; preencher valores necessários antes de NOT NULL/UNIQUE e verificar preservação dos dados em banco isolado. Aplicação no banco da equipe e execução de seed são etapas separadas, com autorização específica.

Verificar nomes curtos, acentos, bases iguais, fallback, colisões antigas/inativas, concorrência, dez tentativas, rejeição de valor manual e permanência após edições/transferências. Validar autorização, formulários, busca, confirmação do identificador, foco, erros e responsividade. Rodar os checks afetados e registrar limitações. Validar uma entrega antes de começar a seguinte.

O [mapeamento dos cadastros](../../docs/design/CADASTROS_GUNP.md) organiza as telas existentes e as propostas de detalhamento.
