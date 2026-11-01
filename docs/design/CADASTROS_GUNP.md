# Mapeamento e evolução dos cadastros do GUNP

Revisão em 22/10/2026, por inspeção de páginas, componentes, APIs, serviços e `src/prisma/contract.prisma`. Não houve execução de fluxos no navegador ou consulta ao banco nesta revisão.

## Direção acordada

Manter a geração automática, única e permanente dos identificadores funcionais nos próximos cadastros, com preservação dos registros antigos. A regra comum está em [identificadores-cadastros.md](../../specs/contratos/identificadores-cadastros.md); os formatos já aprovados de Operadores e Setores permanecem em [operadores-setores.md](../../specs/contratos/operadores-setores.md).

As propostas abaixo orientam a próxima especificação, uma tela por entrega. Não representam campos, endpoints ou regras adicionais já aprovados. Detalhar um cadastro deve ajudar a identificar o registro, entender sua função na produção e consultar seus vínculos. Um formulário curto pode ser adequado quando os detalhes pertencem a outra tela, como ocorre em Roteiros.

## Telas implementadas

| Tela | Dados informados hoje | Fluxos existentes | Identificação atual | Avaliação |
| --- | --- | --- | --- | --- |
| Produtos — `/painel/produtos` | Código e nome | Listar, buscar, ordenar, criar e editar código/nome | UUID interno; código manual e único | Muito simples: não mostra roteiros, vigência nem situação dos tempos padrão. Prioridade alta. |
| Postos — `/painel/postos` | Código, nome e setor obrigatório | Listar, buscar, ordenar, filtrar status, criar, editar e ativar/inativar | UUID interno; código manual e único | Básico: já tem setor e status, mas falta contexto das etapas compatíveis e geração automática. Prioridade alta. |
| Setores — `/painel/setores` | Nome e descrição opcional | Listar, buscar, ordenar e criar | UUID interno; código automático permanente | Identificação resolvida; manutenção incompleta, sem edição ou consulta dos vínculos. Prioridade média. |
| Operações — `/painel/operacoes` | Nome e descrição opcional | Listar, buscar, ordenar, criar e editar | UUID interno; nome único; sem código funcional | Formulário simples e coerente com o modelo; falta contexto de utilização nos roteiros. Prioridade média. |
| Operadores — `/painel/operadores` | Nome, setor principal e função opcional | Listar, buscar, ordenar, filtrar status, criar e editar nome/setor/função | UUID interno; matrícula automática permanente | Já detalhado nesta frente; falta ativação/inativação. Prioridade menor para novos campos. |
| Roteiros — `/painel/roteiros` e `/painel/roteiros/[id]` | Nome ao criar; etapas/operações, postos, produtos, vigência e tempos na tela de detalhe | Listagem, busca/filtro/ordenação, criação, novas versões, status e manutenção dos vínculos | UUID por versão; combinação nome/versão única; versão automática | O modal inicial é curto, mas o cadastro completo já é detalhado. Priorizar clareza e consulta, sem duplicar o fluxo. |

Todas essas telas usam a API interna e o controle administrativo existente. A presença do código e de testes no repositório não confirma deployment, aplicação de migrations ou aceite visual.

## Propostas por tela

### 1. Postos — primeira revisão recomendada

**O que melhorar:** geração automática permanente do código; setor apresentado por código e nome; consulta das etapas/roteiros em que o posto é compatível; explicação dos efeitos da edição de setor e da inativação. Esses vínculos já existem em `EtapaPosto` e podem enriquecer a consulta sem criar relação fixa com operador.

O formulário atual carrega setores uma vez ao montar o componente. Em falha, orienta fechar e reabrir, mas isso não dispara nova carga. A revisão deve oferecer nova tentativa real e atualização dos setores disponíveis. Hoje o DTO do posto e seu seletor mostram somente o nome do setor, apesar de o código já existir na API de setores.

**A definir no contrato:** base e formato do código, grupo da sequência, participação do setor de origem, fallback e tratamento dos códigos manuais existentes. Avaliar descrição opcional apenas se houver informação de identificação do recurso que o nome não comporte; esse campo não existe hoje. Avaliar como apresentar vínculos e o impacto da troca de setor sem alterar execuções históricas.

**Limites:** manter Setor → Posto e Etapa ↔ Posto. Não cadastrar operador fixo, capacidade avançada, manutenção de máquinas ou permissões de operação por setor. Novos campos e regras exigem especificação própria.

**Arquivos de referência:** [formulário](../../modules/workstations/presentation/components/workstation-form-dialog.tsx), [tela](../../modules/workstations/presentation/components/workstations-screen.tsx), [serviço](../../modules/workstations/application/postos.ts), [domínio](../../modules/workstations/domain/posto.ts). APIs: GET/POST `/api/postos`, PATCH `/api/postos/[id]` e PATCH `/api/postos/[id]/status`.

### 2. Produtos — segunda revisão recomendada

**O que melhorar:** identificação interna automática e consulta do contexto produtivo: roteiros associados, versão vigente e preenchimento dos tempos padrão por produto/etapa. Os relacionamentos existem; a tela de Produtos hoje mostra somente código, nome e datas. Os vínculos e tempos são mantidos em Roteiros, e a revisão pode oferecer resumo e acesso ao local de manutenção.

**A definir no contrato:** se `Produto.codigo` representa apenas identificação interna ou também uma referência já usada pela empresa; formato automático e estratégia para preservar essa referência. Avaliar descrição opcional e unidade padrão somente com necessidade confirmada: esses campos não existem em Produto, e hoje `unidade` pertence à Ordem. Avaliar inativação conforme a pendência já existente do modelo; Produto não possui `ativo`.

**Limites:** não mover o tempo padrão para Produto ou Operação como valor universal. Não criar vínculo obrigatório direto entre Produto e Setor; o contexto produtivo passa pelo roteiro, etapas e postos. Não transformar a revisão em estoque, ficha comercial ou catálogo de variações sem requisito.

**Arquivos de referência:** [formulário](../../modules/products/presentation/components/product-form-dialog.tsx), [tela](../../modules/products/presentation/components/products-screen.tsx), [domínio](../../modules/products/domain/produto.ts), [vínculos no roteiro](../../modules/routings/presentation/components/roteiro-produtos-section.tsx). APIs: GET/POST `/api/produtos` e PATCH `/api/produtos/[id]`.

### 3. Setores — completar manutenção e contexto

**O que melhorar:** edição de nome/descrição, mantendo o código permanente; consulta de postos e operadores do setor principal, com identificação e status desses registros. As relações já existem, mas não são mostradas nessa tela. Contagens devem vir dos dados persistidos, sem sugerir limite de capacidade ou total de pessoas trabalhando naquele momento.

**A definir no contrato:** formato da consulta de vínculos e API de edição. Avaliar ativação/inativação separadamente, pois Setor não possui `ativo`; isso exige definir o efeito sobre postos e novos vínculos. Não substituir o código após renomear o setor.

Referências: [design atual](SETORES_GUNP.md), [tela](../../modules/sectors/presentation/components/sectors-screen.tsx) e [contrato atual](../../specs/contratos/operadores-setores.md). API existente: GET/POST `/api/setores`.

### 4. Operações — explicar utilização no processo

**O que melhorar:** consulta das etapas e versões de roteiro que usam a operação; visibilidade do impacto de renomear ou alterar a descrição de uma operação compartilhada. Nome e descrição podem continuar sendo suficientes no formulário; o detalhamento principal está nos vínculos.

**A definir no contrato:** necessidade de código funcional automático, apresentação dos vínculos e eventual inativação. Operacao não possui `codigo` nem `ativo`. Não assumir setor único, posto obrigatório ou tempo padrão universal: essas informações não pertencem ao cadastro atual de operação.

Referências: [design atual](OPERACOES_GUNP.md), [tela](../../modules/operations/presentation/components/operations-screen.tsx) e [domínio](../../modules/operations/domain/operacao.ts). APIs: GET/POST `/api/operacoes` e PATCH `/api/operacoes/[id]`.

### 5. Operadores — consolidar o contrato entregue

O cadastro já informa quem é a pessoa, seu setor principal e função, com matrícula automática. A próxima melhoria de manutenção é ativar/inativar; o banco já possui `ativo`, mas não há ação de status nessa tela/API. O contrato dessa ação precisa definir o que ocorre se houver execução aberta ou pausada antes de liberá-la.

Preservar operadores antigos sem setor e o processo de regularização, matrículas antigas/inativas e permanência após transferência. Evitar acrescentar CPF, endereço, telefone, cargo estruturado ou outros dados de RH sem requisito produtivo. QR/leitura e apontamentos continuam na frente da ilha.

Referências: [design atual](OPERADORES_GUNP.md), [formulário](../../modules/operators/presentation/components/operator-form-dialog.tsx) e [contrato](../../specs/contratos/operadores-setores.md). APIs: GET/POST `/api/operadores` e PATCH `/api/operadores/[id]`.

### 6. Roteiros — preservar o fluxo já detalhado

O cadastro começa com nome e abre a versão 1 ativa, sem etapas. O detalhe já permite montar/reordenar etapas, escolher operações, definir postos compatíveis, associar produtos, indicar vigência e informar tempos padrão em segundos por unidade. Novas versões copiam etapas, postos, produtos e tempos, sem torná-los vigentes automaticamente. Etapas ficam travadas quando há ordens; tempos ficam travados para produtos com ordens naquela versão.

**Melhorias para avaliar:** resumo do que falta preencher, indicação mais clara de etapas sem postos e produtos sem tempos, e consulta de uso. Não transformar esses avisos em novos bloqueios de negócio sem contrato. Não adicionar matrícula ao roteiro nem digitação manual de versão. Preservar a sequência nominal e o congelamento da versão usada nas ordens.

Referências: [criação](../../modules/routings/presentation/components/routing-create-dialog.tsx), [detalhe](../../modules/routings/presentation/components/routing-detail-screen.tsx), [produtos/tempos](../../modules/routings/presentation/components/roteiro-produtos-section.tsx), [serviço](../../modules/routings/application/roteiros.ts) e [API](../../modules/routings/presentation/http.ts). Falta um documento de design específico de Roteiros; o roadmap passa a refletir os fluxos encontrados, sem declarar novo aceite.

## Destinos que ainda não são cadastros implementados

| Destino | Estado observado | Preparação necessária |
| --- | --- | --- |
| Motivos de Pausa | Página provisória; modelo com nome, descrição e `ativo` | Especificar cadastro e manutenção; categoria é proposta em aberto. Não contar como tela simples já entregue. |
| Planos de Produção | Página provisória; modelo com código, descrição e período opcional | Contrato de geração automática de código, datas e associação de ordens. |
| Ordens de Produção | Página provisória; modelo com número, plano, produto, roteiro, quantidade e unidade | Contrato do número automático e congelamento do roteiro, com validações dos relacionamentos e da quantidade. |
| Usuários administrativos | API e bootstrap existentes; sem tela e sem item no menu | Contrato separado de credenciais e matrícula automática futura, preservando logins; não reutilizar lotação ou gerador de Operador. |

Motivos, Planos e Ordens podem ter sua preparação administrativa sem depender da interface da ilha. A revisão de Operadores precisa considerar as regras de execução para a futura inativação. Execução e Indicadores também são destinos provisórios, mas não são cadastros básicos; Indicadores já possui API.

## Sequência e critérios para cada entrega

Ordem sugerida: **Postos → Produtos → Setores → Operações → Operadores → revisão de Roteiros**. É uma recomendação, sem iniciar automaticamente todas as telas. Se a regra de um cadastro depender de resposta da empresa, especificar a dúvida antes de implementar essa parte.

Para cada tela, fechar o contrato com campos necessários, vínculos, identificador, criação/edição/status, erros, compatibilidade e impacto de schema. Priorizar consulta dos dados e relações já existentes antes de acrescentar atributos. Definir estados de carregamento, falha com nova tentativa, vazio, sucesso, foco e busca por código/nome/dados relevantes. Confirmar identificadores somente após a gravação.

Implementar e validar uma entrega antes de passar à seguinte: testes proporcionais às regras, migrations em banco isolado quando necessárias, lint, typecheck, build e navegador nos tamanhos definidos pelo projeto. Não aplicar migrations nem executar seed automaticamente. Esta revisão é documental e não executou essas validações funcionais.
