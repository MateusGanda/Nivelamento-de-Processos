# Mapeamento e evolução dos cadastros do GUNP

Revisão em 22/10/2026, por inspeção de páginas, componentes, APIs, serviços e `src/prisma/contract.prisma`. Não houve execução de fluxos no navegador ou consulta ao banco nesta revisão.

Atualização em 02/11/2026: o estado das telas foi conferido com o código da `develop`. Setores, Operações, Produtos e Operadores passaram a ter edição e ativação/inativação, e Motivos de Pausa, Planos e Ordens de Produção já têm telas. As propostas abaixo não mudaram.

## Direção acordada

Manter a geração automática, única e permanente dos identificadores funcionais nos próximos cadastros, com preservação dos registros antigos. A regra comum está em [identificadores-cadastros.md](../../specs/contratos/identificadores-cadastros.md); os formatos já aprovados de Operadores e Setores permanecem em [operadores-setores.md](../../specs/contratos/operadores-setores.md).

Os textos dos cadastros têm tamanho máximo, contado depois do trim (decisão de 04/11/2026): nomes e função do operador até 120 caracteres, descrições até 500, códigos de produto, posto e plano e número da ordem até 30, e unidade da ordem até 20. Acima disso a API responde `ENTRADA_INVALIDA` (400), e os formulários já limitam a digitação. Os identificadores gerados automaticamente seguem seus próprios formatos.

As propostas abaixo orientam a próxima especificação, uma tela por entrega. Não representam campos, endpoints ou regras adicionais já aprovados. Detalhar um cadastro deve ajudar a identificar o registro, entender sua função na produção e consultar seus vínculos. Um formulário curto pode ser adequado quando os detalhes pertencem a outra tela, como ocorre em Roteiros.

## Telas implementadas

| Tela | Dados informados hoje | Fluxos existentes | Identificação atual | Avaliação |
| --- | --- | --- | --- | --- |
| Produtos — `/painel/produtos` | Código e nome | Listar, buscar, ordenar, filtrar status, criar, editar código/nome e ativar/inativar | UUID interno; código manual e único | Muito simples: não mostra roteiros, vigência nem situação dos tempos padrão. Prioridade alta. |
| Postos — `/painel/postos` | Código, nome e setor obrigatório | Listar, buscar, ordenar, filtrar status, criar, editar e ativar/inativar | UUID interno; código manual e único | Básico: já tem setor e status, mas falta contexto das etapas compatíveis e geração automática. Prioridade alta. |
| Setores — `/painel/setores` | Nome e descrição opcional | Listar, buscar, ordenar, filtrar status, criar, editar nome/descrição e ativar/inativar | UUID interno; código automático permanente | Identificação e manutenção resolvidas; falta a consulta dos postos e operadores vinculados. Prioridade média. |
| Operações — `/painel/operacoes` | Nome e descrição opcional | Listar, buscar, ordenar, filtrar status, criar, editar e ativar/inativar | UUID interno; nome único; sem código funcional | Formulário simples e coerente com o modelo; falta contexto de utilização nos roteiros. Prioridade média. |
| Operadores — `/painel/operadores` | Nome, setor principal e função opcional | Listar, buscar, ordenar, filtrar status, criar, editar nome/setor/função e ativar/inativar | UUID interno; matrícula automática permanente | Já detalhado nesta frente. Prioridade menor para novos campos. |
| Roteiros — `/painel/roteiros` e `/painel/roteiros/[id]` | Nome ao criar; etapas/operações, postos, produtos, vigência e tempos na tela de detalhe | Listagem, busca/filtro/ordenação, criação, novas versões, status e manutenção dos vínculos | UUID por versão; combinação nome/versão única; versão automática | O modal inicial é curto, mas o cadastro completo já é detalhado. Priorizar clareza e consulta, sem duplicar o fluxo. |
| Motivos de Pausa — `/painel/motivos-de-pausa` | Nome e descrição opcional | Listar, buscar, ordenar, filtrar status, criar, editar e ativar/inativar | UUID interno; nome único; sem código funcional | Entregue no padrão de Operações; a ilha mostra só os motivos ativos. A categoria do motivo continua como proposta em aberto. |
| Planos de Produção — `/painel/planos-de-producao` | Código, descrição e período opcionais | Listar, buscar, criar e editar | UUID interno; código manual e único | Funcional; a geração automática do código ainda depende de contrato. |
| Ordens de Produção — `/painel/ordens-de-producao` | Número, plano, produto, versão do roteiro, quantidade e unidade | Listar, buscar, criar e editar; a etapa atual de cada ordem aparece em Indicadores | UUID interno; número único, com sugestão do próximo no formato OP-0001 | Funcional; a versão do roteiro fica gravada na ordem. |

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

**A definir no contrato:** se `Produto.codigo` representa apenas identificação interna ou também uma referência já usada pela empresa; formato automático e estratégia para preservar essa referência. Avaliar descrição opcional e unidade padrão somente com necessidade confirmada: esses campos não existem em Produto, e hoje `unidade` pertence à Ordem. A ativação/inativação já existe (`Produto.ativo`).

**Limites:** não mover o tempo padrão para Produto ou Operação como valor universal. Não criar vínculo obrigatório direto entre Produto e Setor; o contexto produtivo passa pelo roteiro, etapas e postos. Não transformar a revisão em estoque, ficha comercial ou catálogo de variações sem requisito.

**Arquivos de referência:** [formulário](../../modules/products/presentation/components/product-form-dialog.tsx), [tela](../../modules/products/presentation/components/products-screen.tsx), [domínio](../../modules/products/domain/produto.ts), [vínculos no roteiro](../../modules/routings/presentation/components/roteiro-produtos-section.tsx). APIs: GET/POST `/api/produtos` e PATCH `/api/produtos/[id]`.

### 3. Setores — completar manutenção e contexto

**O que melhorar:** edição de nome/descrição, mantendo o código permanente; consulta de postos e operadores do setor principal, com identificação e status desses registros. As relações já existem, mas não são mostradas nessa tela. Contagens devem vir dos dados persistidos, sem sugerir limite de capacidade ou total de pessoas trabalhando naquele momento.

**A definir no contrato:** formato da consulta de vínculos. A edição de nome/descrição e a ativação/inativação já existem; falta documentar o efeito da inativação sobre postos e novos vínculos. Não substituir o código após renomear o setor.

Referências: [design atual](SETORES_GUNP.md), [tela](../../modules/sectors/presentation/components/sectors-screen.tsx) e [contrato atual](../../specs/contratos/operadores-setores.md). APIs existentes: GET/POST `/api/setores`, PATCH `/api/setores/[id]` e PATCH `/api/setores/[id]/status`.

### 4. Operações — explicar utilização no processo

**O que melhorar:** consulta das etapas e versões de roteiro que usam a operação; visibilidade do impacto de renomear ou alterar a descrição de uma operação compartilhada. Nome e descrição podem continuar sendo suficientes no formulário; o detalhamento principal está nos vínculos.

**A definir no contrato:** necessidade de código funcional automático e apresentação dos vínculos. Operacao não possui `codigo`; a ativação/inativação já existe (`Operacao.ativo`). Não assumir setor único, posto obrigatório ou tempo padrão universal: essas informações não pertencem ao cadastro atual de operação.

Referências: [design atual](OPERACOES_GUNP.md), [tela](../../modules/operations/presentation/components/operations-screen.tsx) e [domínio](../../modules/operations/domain/operacao.ts). APIs: GET/POST `/api/operacoes`, PATCH `/api/operacoes/[id]` e PATCH `/api/operacoes/[id]/status`.

### 5. Operadores — consolidar o contrato entregue

O cadastro já informa quem é a pessoa, seu setor principal e função, com matrícula automática. A ativação/inativação já existe e recusa a inativação de quem tem execução aberta ou pausada, que precisa ser finalizada ou baixada na ilha antes.

Preservar operadores antigos sem setor e o processo de regularização, matrículas antigas/inativas e permanência após transferência. Evitar acrescentar CPF, endereço, telefone, cargo estruturado ou outros dados de RH sem requisito produtivo. QR/leitura e apontamentos continuam na frente da ilha.

Referências: [design atual](OPERADORES_GUNP.md), [formulário](../../modules/operators/presentation/components/operator-form-dialog.tsx) e [contrato](../../specs/contratos/operadores-setores.md). APIs: GET/POST `/api/operadores`, PATCH `/api/operadores/[id]` e PATCH `/api/operadores/[id]/status`.

### 6. Roteiros — preservar o fluxo já detalhado

O cadastro começa com nome e abre a versão 1 ativa, sem etapas. O detalhe já permite montar/reordenar etapas, escolher operações, definir postos compatíveis, associar produtos, indicar vigência e informar tempos padrão em segundos por unidade. Novas versões copiam etapas, postos, produtos e tempos, sem torná-los vigentes automaticamente. Etapas ficam travadas quando há ordens; tempos ficam travados para produtos com ordens naquela versão.

**Melhorias para avaliar:** resumo do que falta preencher, indicação mais clara de etapas sem postos e produtos sem tempos, e consulta de uso. Não transformar esses avisos em novos bloqueios de negócio sem contrato. Não adicionar matrícula ao roteiro nem digitação manual de versão. Preservar a sequência nominal e o congelamento da versão usada nas ordens.

Referências: [criação](../../modules/routings/presentation/components/routing-create-dialog.tsx), [detalhe](../../modules/routings/presentation/components/routing-detail-screen.tsx), [produtos/tempos](../../modules/routings/presentation/components/roteiro-produtos-section.tsx), [serviço](../../modules/routings/application/roteiros.ts) e [API](../../modules/routings/presentation/http.ts). Falta um documento de design específico de Roteiros; o roadmap passa a refletir os fluxos encontrados, sem declarar novo aceite.

## Destinos que ainda não são cadastros implementados

| Destino | Estado observado | Preparação necessária |
| --- | --- | --- |
| Usuários administrativos | API e bootstrap existentes; sem tela e sem item no menu | Contrato separado de credenciais e matrícula automática futura, preservando logins; não reutilizar lotação ou gerador de Operador. |

Execução e Indicadores não são cadastros básicos. Indicadores tem tela com exportação em planilha e impressão; o item Execução do menu abre a ilha de apontamento (`/ilha`) em uma nova aba.

## Sequência e critérios para cada entrega

Ordem sugerida: **Postos → Produtos → Setores → Operações → Operadores → revisão de Roteiros**. É uma recomendação, sem iniciar automaticamente todas as telas. Se a regra de um cadastro depender de resposta da empresa, especificar a dúvida antes de implementar essa parte.

Para cada tela, fechar o contrato com campos necessários, vínculos, identificador, criação/edição/status, erros, compatibilidade e impacto de schema. Priorizar consulta dos dados e relações já existentes antes de acrescentar atributos. Definir estados de carregamento, falha com nova tentativa, vazio, sucesso, foco e busca por código/nome/dados relevantes. Confirmar identificadores somente após a gravação.

Implementar e validar uma entrega antes de passar à seguinte: testes proporcionais às regras, migrations em banco isolado quando necessárias, lint, typecheck, build e navegador nos tamanhos definidos pelo projeto. Não aplicar migrations nem executar seed automaticamente. Esta revisão é documental e não executou essas validações funcionais.
