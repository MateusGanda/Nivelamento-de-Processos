# Contexto permanente para IA — GUNP

## Finalidade e precedência

Este documento orienta agentes de desenvolvimento que trabalhem no GUNP (VS Code/Copilot/Codex). Ele consolida o estado conhecido do MVP e deve ser lido antes de alterar domínio, persistência ou arquitetura.

Fonte principal do domínio: `sources/MODELO_CONCEITUAL_GUNP_atualizado.md`. As decisões nele registradas e neste documento devem ser preservadas. Materiais conceituais anteriores podem conter hipóteses superadas; não devem ser usados para reconciliar, completar ou contradizer a fonte principal.

Quando houver lacuna ou ambiguidade, registre-a e peça alinhamento. Não transforme uma interpretação em entidade, campo, restrição, endpoint ou fluxo automático. Uma mudança de domínio só vale quando aprovada e registrada explicitamente.

## Objetivo do GUNP e limites do MVP

GUNP é um sistema web para gerenciamento e acompanhamento de processos produtivos. Ele estrutura produtos, operações e roteiros e registra a execução da produção por ordem, etapa, operador, posto/recurso, tempo e resultado de quantidade. O objetivo é um MVP funcional para o TCC, priorizando simplicidade, rastreabilidade e análise posterior.

O sistema registra o que ocorreu. No MVP, roteiro não é um motor rígido de workflow: a sequência de suas etapas é nominal/organizacional e não cria dependências, bloqueios ou liberações automáticas.

Não implementar sem requisito explícito:

- dependências entre etapas, otimização ou balanceamento automático;
- sensores, câmeras ou integração com máquinas;
- controle detalhado de todos os operadores de uma célula;
- capacidade avançada de postos/máquinas;
- tempo de giro entre etapas ou previsão sofisticada;
- QR Code, código de barras, permissões granulares ou estruturas detalhadas de pedidos de venda;
- fluxo separado de retrabalho e indicadores avançados além do necessário ao TCC.

## Arquitetura e stack

O GUNP é um monólito modular em uma aplicação Next.js, guiado pragmaticamente por Clean Architecture. O frontend React consome uma API REST interna; ele não acessa Prisma ou PostgreSQL diretamente. Regras de negócio não devem depender de React, Next.js, HTTP, Prisma ou PostgreSQL. Prisma pertence à Infrastructure; handlers e componentes são Presentation; casos de uso orquestram Application; invariantes pertencem ao Domain.

- Next.js, React e TypeScript;
- Tailwind CSS e shadcn/ui;
- API REST interna;
- Prisma 8 e PostgreSQL.

Não introduzir bibliotecas, infraestrutura distribuída, microserviços, filas, cache, GraphQL, CQRS/event sourcing, autenticação, testes ou padrões adicionais sem decisão registrada. `ARCHITECTURE.md` e `TECHNOLOGY.md` complementam este contexto em assuntos arquiteturais e tecnológicos; não substituem o modelo conceitual atualizado.

## Prisma 8 — estado e regras obrigatórias

O projeto usa o fluxo de contratos do Prisma 8, não o fluxo legado de `schema.prisma`.

| Arquivo | Papel esperado |
| --- | --- |
| `prisma.config.ts` | Configuração do Prisma e conexão PostgreSQL via `DATABASE_URL`; aponta para o contrato. |
| `src/prisma/contract.prisma` | Contrato do modelo de dados; deve começar com `// use prisma-8`. |
| `src/prisma/db.ts` | Camada de acesso/conexão usada pela Infrastructure. |

Estado em 08/10/2026: o contrato foi revisado, o `prisma.config.ts` usa `@prisma/cli-engine` e `@prisma/orm-postgres/config`, `npx prisma contract emit` foi executado e a migration inicial `migrations/app/20261008T1833_init` foi aplicada no PostgreSQL da equipe. `npx prisma db verify` confere o banco contra o contrato sem alterar nada; `npx prisma db migrate` aplica migrations pendentes.

Não reintroduzir `schema.prisma`, blocos `generator client` ou `datasource` no contrato. Não trocar o fluxo por comandos, sintaxe ou configuração de versões antigas do Prisma. Tipos PostgreSQL do contrato seguem a sintaxe do Prisma 8, como `Uuid`, `Numeric(12, 2)`, `Date` e `TimestamptzString`, conforme a necessidade já modelada.

Antes de criar ou aplicar uma migration, validar que ela representa somente decisões consolidadas. Não usar uma migration para "resolver" pendências de domínio.

## Entidades e significado

| Entidade | Significado |
| --- | --- |
| Produto | Item fabricado. |
| Operação | Atividade produtiva reutilizável; não tem tempo padrão universal. |
| Roteiro | Definição versionada do processo, composta por etapas em sequência nominal. |
| EtapaRoteiro | Ocorrência de uma operação em uma versão de roteiro. |
| ProdutoRoteiro | Associação Produto–Roteiro que preserva histórico e identifica a versão vigente. |
| ProdutoEtapa | Associação Produto–EtapaRoteiro que define o tempo padrão no contexto do produto. |
| PlanoProducao | Agrupador do planejamento. |
| OrdemProducao | Produção de uma quantidade de um único produto; referencia e congela o roteiro usado. |
| Execucao | Apontamento/execução de uma etapa de uma Ordem; registra responsável pelo apontamento, posto, estado, eventos de tempo e resultado. Não prova que o operador produziu toda a quantidade sozinho. |
| Operador | Responsável pelo apontamento. |
| Setor | Organiza postos/recursos. |
| Posto | Recurso/local produtivo identificável. No MVP, posto e recurso são uma entidade; uma máquina identificável pode ser um posto. |
| EtapaPosto | Associação de compatibilidade entre etapa e posto. |
| EventoTempo | Fato temporal de execução: `INICIO`, `PAUSA`, `RETOMADA` ou `FINALIZACAO`. |
| MotivoPausa | Classificação padronizada de uma pausa. |

## Relacionamentos consolidados

```text
Produto N:N Roteiro                 via ProdutoRoteiro
Roteiro 1:N EtapaRoteiro            EtapaRoteiro N:1 Operacao
Produto + EtapaRoteiro              -> ProdutoEtapa (tempo padrão)
PlanoProducao 1:N OrdemProducao
OrdemProducao N:1 Produto e N:1 Roteiro
OrdemProducao 1:N Execucao
Execucao N:1 EtapaRoteiro, Operador e Posto
Setor 1:N Posto
EtapaRoteiro N:N Posto              via EtapaPosto
Execucao 1:N EventoTempo
EventoTempo N:0..1 MotivoPausa
```

Uma Ordem mantém o roteiro explicitamente referenciado, mesmo se a versão vigente do Produto mudar depois. Nunca atualizar retroativamente uma Ordem para o roteiro vigente.

## Regras de negócio consolidadas

### Ordem e quantidade

- Uma Ordem representa uma quantidade de um único Produto.
- Não há baixa parcial nem lançamentos incrementais de quantidade no MVP.
- Quando houver baixa efetiva de uma etapa, ela considera 100% da quantidade da Ordem.
- O resultado é dividido em `boa`, `retrabalho` e `refugo`, respeitando `boa + retrabalho + refugo = quantidade da Ordem`.
- A baixa efetiva de uma etapa ocorre somente uma vez, embora a Ordem possa ter várias Execuções para a mesma etapa.

### Execução, operador e troca de operação

- Estados persistidos: `EM_EXECUCAO`, `PAUSADA` e `FINALIZADA`; não existe `NAO_INICIADA` persistido. A ausência de execução pode ser exibida como não iniciada.
- Transições permitidas: `EM_EXECUCAO -> PAUSADA`, `PAUSADA -> EM_EXECUCAO` e `EM_EXECUCAO -> FINALIZADA`.
- Uma execução `FINALIZADA` é terminal e não recebe novos eventos.
- Troca de operação finaliza a execução atual e cria outra; não criar um mecanismo adicional de troca.
- Um Operador não pode manter duas execuções abertas simultaneamente. `PAUSADA` continua aberta e ocupa o operador.
- O vínculo de Operador expressa responsabilidade pelo apontamento, não autoria individual de toda a produção da célula.

### Tempo e pausa

- Toda execução possui um `INICIO` e uma `FINALIZACAO`; pode ter várias `PAUSAS` e `RETOMADAS`.
- Uma `PAUSA` possui MotivoPausa.
- Tempo produtivo é derivado dos intervalos ativos; não inferir ociosidade somente pela ausência de eventos.

### Posto/recurso e roteiro

- Uma etapa pode ser executada em vários postos compatíveis; um posto recebe várias execuções ao longo do tempo.
- Não tratar um conjunto de máquinas como um único posto sem que seja realmente um recurso identificável.
- A posição da etapa no roteiro não bloqueia ou libera outras etapas no MVP.

## Finalização, troca de operação e baixa efetiva

A tensão entre `FINALIZADA`, troca de operação e baixa efetiva foi resolvida no contrato em 08/10/2026 com o campo `Execucao.tipoFinalizacao`:

- `tipoFinalizacao` é `TROCA_OPERACAO` ou `BAIXA` e só existe em execução `FINALIZADA`; execução `EM_EXECUCAO` ou `PAUSADA` fica com o campo nulo.
- A baixa efetiva de uma etapa é a Execução finalizada com `tipoFinalizacao = BAIXA`. `FINALIZADA` sozinha não equivale à baixa.
- As quantidades `boa`, `retrabalho` e `refugo` são gravadas no momento da baixa e são obrigatórias nela. Troca de operação e execução aberta não têm quantidades.
- Só pode existir uma baixa por `(ordemProducaoId, etapaRoteiroId)`. As demais Execuções da mesma etapa continuam permitidas como histórico.

O banco garante essas quatro regras com restrições de verificação e um índice único parcial. Ele **não** garante que `boa + retrabalho + refugo` seja igual à quantidade da Ordem, nem que as quantidades sejam não negativas: essas validações pertencem à transação da baixa.

## Modelo relacional atual reportado

O contrato relacional informado no histórico contém estas tabelas: `Produto`, `Operacao`, `Roteiro`, `EtapaRoteiro`, `ProdutoRoteiro`, `ProdutoEtapa`, `PlanoProducao`, `OrdemProducao`, `Operador`, `Setor`, `Posto`, `EtapaPosto`, `Execucao`, `EventoTempo` e `MotivoPausa`.

As relações principais e identificadores relatados são:

- `Roteiro(nome, versao)` é único; `EtapaRoteiro(roteiroId, ordem)` é único.
- `ProdutoRoteiro(produtoId, roteiroId)` e `ProdutoEtapa(produtoId, etapaRoteiroId)` são únicos.
- `EtapaPosto` usa chave primária composta `(etapaRoteiroId, postoId)`.
- Códigos de Produto, PlanoProducao, OrdemProducao, Posto e matrículas de Operador são únicos; Operacao, Setor e MotivoPausa usam nome único.
- `OrdemProducao` referencia PlanoProducao, Produto e Roteiro; `Execucao` referencia OrdemProducao, EtapaRoteiro, Operador e Posto; `EventoTempo` referencia Execucao e, opcionalmente, MotivoPausa.
- `Execucao` contém `tipoFinalizacao` e os campos de resultado `quantidadeBoa`, `quantidadeRetrabalho` e `quantidadeRefugo`, todos opcionais, além de índices para suas chaves de consulta.
- Índices únicos parciais: uma baixa por `Execucao(ordemProducaoId, etapaRoteiroId)` e um roteiro vigente por `ProdutoRoteiro(produtoId)`.
- Restrições de verificação: coerência entre `status` e `tipoFinalizacao`, quantidades presentes só na baixa e MotivoPausa obrigatório em evento `PAUSA`.

Este é o modelo atual de trabalho, não autorização para acrescentar colunas ou relações. Compare qualquer alteração ao `contract.prisma` real antes de editar, pois esta cópia de contexto não substitui o arquivo versionado.

## Integridade de dados e implementação

Aplicar PKs, FKs, obrigatoriedade, unicidades e índices que o contrato consolidado já expressa. Regras que atravessam registros devem ser verificadas na camada de aplicação e, quando a técnica já estiver decidida, reforçadas no PostgreSQL com transação e mecanismo de concorrência apropriado.

Em particular:

- não impor unicidade simples em `(ordemProducaoId, etapaRoteiroId)`: múltiplas execuções legítimas são permitidas, e a unicidade vale só para a baixa;
- impedir duas execuções abertas para o mesmo operador, incluindo `PAUSADA`, também sob concorrência;
- validar que a etapa de uma Execução pertence ao Roteiro referenciado pela Ordem; isso pode exigir validação transacional se não estiver expresso por FK;
- validar compatibilidade entre EtapaRoteiro e Posto por `EtapaPosto`;
- validar sequência e coerência de EventoTempo, MotivoPausa em pausa, execução terminal sem novos eventos e a igualdade das quantidades com a quantidade da Ordem na baixa;
- tratar troca de operação como alteração atômica: fechar a execução anterior e abrir a nova na mesma transação;
- tornar comandos críticos idempotentes para que reenvios não dupliquem eventos, execuções ou produção.

Não escolher unilateralmente a técnica de constraint parcial, lock, controle otimista, idempotência ou auditoria. O requisito é a garantia; a técnica continua dependente da task e da decisão correspondente.

## Próximos passos

A revisão do contrato, a definição da baixa efetiva e a aplicação da migration inicial foram concluídas em 08/10/2026. Seguem:

1. Implementar repositories/adapters na Infrastructure, casos de uso e validações transacionais.
2. Cobrir transições, integridade, idempotência e concorrência com testes.

## Instruções diretas à IA

- Leia este arquivo, `sources/MODELO_CONCEITUAL_GUNP_atualizado.md`, `ARCHITECTURE.md` e `TECHNOLOGY.md` antes de mudanças que os afetem.
- Não invente entidades, relacionamentos, regras, estados, catálogos, endpoints, permissões ou fluxos para preencher lacunas.
- Não reinterprete nem altere uma decisão consolidada sem alinhamento explícito e atualização da documentação.
- Não use sintaxe, arquivos ou configuração legados do Prisma no projeto Prisma 8.
- Não confunda uma execução com baixa efetiva, nem ausência de eventos com ociosidade.
- Não permita que a sequência nominal do roteiro vire dependência ou bloqueio automático.
- Mantenha Prisma na Infrastructure; não acesse o banco diretamente de componentes React, handlers ou regras de domínio.
- Se um requisito entrar em conflito com este documento ou estiver ambíguo, pare, descreva o conflito e solicite a decisão necessária antes de implementar.
