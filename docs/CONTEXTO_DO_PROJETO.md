# Contexto do projeto GUNP — guia para desenvolvimento

**Projeto:** Desenvolvimento de um Sistema Web para Gerenciamento de Nivelamento de Processos em Linhas de Produção (GUNP)  
**Equipe:** Mateus, Gustavo e Arthur  
**Atualizado em:** 26/10/2026
**Finalidade:** servir como contexto de referência para a equipe e para ferramentas de IA usadas no desenvolvimento. Este documento deve ser lido junto de `MODELO_CONCEITUAL_GUNP_atualizado.md`, `ARCHITECTURE.md`, `TECHNOLOGY.md` e `ROADMAP_GUNP.md`. Em caso de divergência, não inventar uma regra: identificar o conflito e pedir confirmação.

> **Estado das informações:** as decisões de domínio e tecnologia descritas como definidas refletem o entendimento atual da equipe. Em 26/10/2026 a `develop` tem os cadastros administrativos, roteiros, planos, ordens, a API e a tela da ilha de apontamento e a rota de indicadores. A tela de indicadores, o dashboard e o leitor USB continuam pendentes. O estado detalhado está na seção 8; conferir no código antes de presumir que algo está pronto.

## 1. Resumo do sistema

O GUNP é uma aplicação web para organizar cadastros e apontamentos da produção, acompanhar a execução de ordens e apoiar a análise da distribuição de carga entre postos/recursos. O sistema deve tornar os registros mais consistentes e oferecer indicadores calculados a partir dos dados registrados. Os indicadores são apoio à decisão: não se deve afirmar que houve aumento real de produtividade ou eliminação de gargalos sem validação na fábrica.

O modelo atual não é o modelo antigo de cenários com `linhas`, `estacoes`, `precedencias`, `cenarios` e `alocacoes_cenario`. A referência de domínio é o modelo conceitual consolidado, com entidades como `Setor`, `Posto`, `Operacao`, `Roteiro`, `EtapaRoteiro`, `ProdutoRoteiro`, `ProdutoEtapa`, `PlanoProducao`, `OrdemProducao`, `Execucao`, `Operador`, `EventoTempo` e `MotivoPausa`.

## 2. Objetivos e limites

- Manter cadastros de produtos, operações, roteiros, setores, postos/recursos, operadores e motivos de pausa.
- Organizar planos e ordens de produção e associar cada ordem à versão de roteiro selecionada.
- Registrar execuções das etapas, incluindo início, pausa, retomada, finalização e apontamento final de quantidades.
- Calcular tempos e indicadores a partir de eventos persistidos, distinguindo tempo corrido de tempo produtivo quando há pausas.
- Apoiar a análise da carga por posto/recurso e a visualização de indicadores, respeitando o escopo do MVP.

O GUNP não deve ser descrito como um otimizador automático de produção. Recursos fora do MVP definidos no roadmap/modelo conceitual não devem ser implementados por iniciativa própria da IA.

## 3. Vocabulário e modelo de domínio

| Entidade/conceito | Responsabilidade |
| --- | --- |
| `Produto` | Produto fabricado. |
| `Operacao` | Tipo de atividade que pode compor etapas de um roteiro. |
| `Roteiro` | Versão identificável da sequência tecnológica aplicável ao produto. |
| `EtapaRoteiro` | Etapa de uma versão de roteiro, associada a uma operação e à sua ordem nominal. |
| `ProdutoRoteiro` | Associação entre produto e roteiro, incluindo a indicação de vigência conforme o modelo. |
| `ProdutoEtapa` | Tempo padrão aplicável à combinação de produto e etapa. |
| `PlanoProducao` | Agrupa o planejamento de produção conforme o modelo conceitual. |
| `OrdemProducao` | Ordem de produção vinculada a produto e versão de roteiro; a versão escolhida deve permanecer estável para a ordem. |
| `Execucao` | Registro operacional da execução de uma etapa de uma ordem, associado a operador e posto. |
| `Operador` | Pessoa responsável pelo apontamento operacional. Não equivale a uma conta de autenticação. |
| `Setor` | Agrupamento organizacional de postos/recursos. |
| `Posto` / recurso | Recurso ou posição de produção em que uma etapa pode ser executada. Tratar como uma entidade, conforme o modelo atual. |
| `EtapaPosto` | Associação que representa quais etapas podem ser executadas em quais postos. |
| `EventoTempo` | Evento de tempo associado a uma execução, usado para registrar pausas/retomadas e derivar intervalos. |
| `MotivoPausa` | Motivo cadastrado para uma pausa. |
| `Usuario` | Conta individual de acesso administrativo. Não substituir nem reutilizar `Operador` como conta de login. |
| Terminal/ilha de produção | Terminal compartilhado com acesso restrito aos fluxos de apontamento. Não é um usuário humano individual nem tem tabela própria: o terminal é liberado pela chave da ilha (`ILHA_CHAVE`), conforme a seção 5. |

Consultar `MODELO_CONCEITUAL_GUNP_atualizado.md` para relações e regras detalhadas. Não criar entidades alternativas ou duplicadas sem antes comparar com esse modelo.

## 4. Regras de negócio que não podem ser contrariadas

- A ordem congela a versão do roteiro selecionada; alterações posteriores no roteiro não devem mudar silenciosamente uma ordem já criada. Por isso, quando um roteiro já tem ordens, suas etapas e os tempos padrão dos produtos com ordens nessa versão ficam travados; a mudança é feita em uma nova versão (decisão de 19/10/2026).
- Depois que a ordem tem execuções, a quantidade e a unidade não podem mudar, porque a baixa é conferida com elas.
- Cadastros usados por outros registros não são apagados: `Produto`, `Operacao`, `Setor`, `Posto`, `Roteiro` e `Operador` têm `ativo`. Um cadastro inativo não entra em vínculos novos, mas continua nos registros que já o usam (decisão da equipe de 22/10/2026).
- A sequência das etapas do roteiro é nominal/organizacional no MVP; não presumir um motor de precedências ou otimização que não esteja definido no modelo atual.
- Não há baixa parcial. No apontamento de baixa, as quantidades finais devem representar a quantidade total da ordem: `boa + retrabalho + refugo = quantidade da OrdemProducao`.
- Não registrar quantidades incrementais a cada evento de execução. O apontamento final segue a regra do modelo conceitual.
- Pode haver várias execuções associadas à mesma ordem e etapa, mas apenas uma baixa efetiva para a combinação definida pelo modelo.
- Estados de execução: `EM_EXECUCAO`, `PAUSADA` e `FINALIZADA`. A execução finalizada é terminal; não reabri-la silenciosamente.
- Transições previstas: `EM_EXECUCAO → PAUSADA`, `PAUSADA → EM_EXECUCAO` e `EM_EXECUCAO → FINALIZADA`.
- Não persistir `NAO_INICIADA` como estado de execução; a interface pode inferi-lo quando ainda não há execução.
- Trocar de operação finaliza a execução atual e inicia outra, de acordo com o fluxo validado.
- Um operador não pode manter duas execuções abertas simultaneamente, incluindo execuções pausadas. A regra é garantida também pelo banco (índice único parcial `Execucao_operador_aberta_unica`).
- O operador é responsável pelo apontamento; não presumir que seja a única pessoa trabalhando no posto.
- O tempo produtivo deve ser calculado considerando intervalos ativos e eventos de pausa/retomada, não simplesmente como `finalização - início` quando houve pausas.
- Uma etapa pode ser executada em mais de um posto compatível, conforme as associações do modelo.
- Regras que atravessam múltiplos registros devem ser validadas na camada de serviço, idealmente dentro de transações. Restrições de banco existentes devem ser preservadas.

Antes de alterar regras ou schema, explicar a necessidade e aguardar autorização explícita quando a alteração ultrapassar o escopo já acordado.

## 5. Usuários, operadores e ilha de produção

A solução de acesso discutida separa autenticação de apontamento operacional:

1. **Usuário administrativo (`Usuario`):** conta individual com autenticação e autorização no servidor para acessar funções administrativas. No MVP atual, o único papel é `ADMIN`.
2. **Operador:** registro de domínio usado para identificar quem está realizando o apontamento. Não precisa ter senha ou login individual no MVP.
3. **Ilha/terminal compartilhado:** interface em `/ilha`, com acesso limitado às rotas `/api/ilha/*`. Não usa a sessão administrativa. O terminal é liberado uma vez com a chave da ilha (variável `ILHA_CHAVE`, decisão de 25/10/2026): o servidor grava um cookie HttpOnly derivado da chave, válido por 30 dias. Trocar a chave bloqueia todos os terminais. Chave errada recebe uma resposta atrasada, para dificultar tentativas em sequência.
4. **Identificação do operador:** a matrícula (digitada ou lida como código) identifica o operador para associar os registros. É identificação, não autenticação nem concessão de privilégios administrativos. Só operador ativo é aceito, e cada matrícula age somente sobre as próprias execuções.
5. **Identificação temporária na interface:** a tela da ilha limpa a identificação pelo botão Sair. A limpeza por inatividade ainda não tem regra definida. Uma inatividade da interface, por si só, não pode alterar o estado persistido de uma execução; em especial, não deve pausar ou finalizar automaticamente uma execução sem regra explícita.
6. **Autorização real:** não confiar apenas em esconder botões no frontend. A API verifica o cookie do terminal em cada rota da ilha e a sessão de ADMIN ativo em cada rota administrativa.

Não há cadastro de terminais nem papéis além de `ADMIN`. Se forem necessários, a decisão deve ser tomada pela equipe antes da implementação.

## 6. QR Code e leitor USB

O QR/código é um meio de identificar operador ou ordem no fluxo de apontamento, não um mecanismo de autenticação. Caso seja utilizado leitor USB em modo teclado (HID/keyboard wedge), a interface recebe o código no campo em foco e envia a informação à API para validação. A tela da ilha mantém o foco no campo de matrícula quando nenhum outro campo está em uso, e a leitura apenas mostra a situação do operador, sem executar ações. Nenhum leitor foi adquirido ou testado até 26/10/2026. O hardware não deve ser tratado como requisito estrutural do domínio: a aplicação deve permitir validar o fluxo por entrada manual durante desenvolvimento e testes, se compatível com os requisitos acordados.

## 7. Arquitetura e tecnologias definidas

- **Frontend e aplicação web:** Next.js, React e TypeScript.
- **API:** endpoints REST por Route Handlers do Next.js em `/api/*`.
- **Persistência:** PostgreSQL hospedado no Neon.
- **ORM/acesso a dados:** Prisma 8, conforme a configuração atual do projeto.
- **Estilo arquitetural obrigatório:** monólito modular (Modular Monolith), com princípios pragmáticos de Clean Architecture. É uma única aplicação Next.js, um deploy e um banco; não separar domínios em microserviços.
- **Fluxo conceitual:** React UI → API REST interna → Presentation → Application/use cases → Domain → Infrastructure → Prisma/PostgreSQL.
- **Presentation:** páginas e componentes React, Route Handlers, validação do formato de entrada, autenticação/autorização no limite da requisição e mapeamento de erros para HTTP. Não contém regras de negócio nem consultas Prisma.
- **Application:** use cases que coordenam uma intenção de negócio, permissões, contratos de persistência, transações e idempotência. Não importa Prisma e não depende de `Request`/`Response`.
- **Domain:** entidades, estados, invariantes, regras e cálculos puros. Não conhece Next.js, React, HTTP, Prisma ou PostgreSQL.
- **Infrastructure:** implementações concretas de repositórios, Prisma, PostgreSQL e mecanismos técnicos aprovados. O código Prisma fica somente nesta camada.
- **Dependências:** Presentation → Application → Domain; Infrastructure implementa contratos usados pelo núcleo. A composição pode ocorrer na borda da aplicação, sem fazer os use cases dependerem de Prisma.
- **Transações e concorrência:** ações que alteram vários registros e precisam ocorrer integralmente devem usar transação. Troca de operação deve fechar a execução anterior e abrir a próxima atomicamente. A regra de no máximo uma execução aberta por operador precisa ser garantida também contra solicitações concorrentes, não apenas no frontend.
- **Idempotência:** comandos críticos devem evitar duplicação por duplo clique, retry ou reenvio de requisição.
- **Pragmatismo:** não criar interfaces, camadas, services ou mappers que apenas repassem chamadas; não introduzir microserviços, Redis, GraphQL, CQRS completo, event sourcing ou infraestrutura distribuída sem aprovação explícita.

`ARCHITECTURE.md` é a referência normativa para fronteiras de camada, dependências e padrões de implementação. `TECHNOLOGY.md` define a stack; `ROADMAP_GUNP.md` define fases e tarefas. Se o código existente divergir desses documentos, apontar a divergência e pedir decisão antes de uma reestruturação transversal.

## 8. Estado conhecido da implementação

Estado da `develop` em 26/10/2026 (após o pull request 55):

- **Banco:** schema em `src/prisma/contract.prisma` e migrations versionadas em `migrations/app/`. Todas foram aplicadas no banco do site publicado e no banco de desenvolvimento da equipe. Desde 21/10 entraram: código do setor; setor principal e função do operador; `ativo` em `Operacao` e `Produto`; `ativo` em `Setor`; datas do plano como texto `AAAA-MM-DD` (sem mudança de coluna); e o índice que impede duas execuções abertas por operador.
- **Restrições do banco:** unicidade de baixa efetiva por ordem e etapa, um roteiro vigente por produto, consistência entre estado e finalização, motivo obrigatório na pausa e uma execução aberta por operador. Nem todas as invariantes podem ser garantidas por constraints; as validações de serviço e as transações continuam necessárias.
- **Acesso administrativo:** `/login` personalizado e `/painel` com menu lateral, identificação e logout. Todas as páginas e rotas administrativas verificam a sessão e o ADMIN ativo no servidor.
- **Cadastros com página e API:**
  - Produtos, Operações, Postos e Motivos de Pausa: listar, criar, editar e ativar/inativar. Somente motivos ativos aparecem na pausa da ilha.
  - Setores: código automático permanente, edição de nome e descrição e ativar/inativar.
  - Operadores: matrícula automática permanente, setor principal, função opcional e edição. A ativação/inativação de operadores ainda não tem tela nem rota.
- **Roteiros:** versões, etapas, postos de cada etapa, produtos, versão vigente por produto e tempo padrão por produto e etapa. A nova versão copia etapas, postos, produtos (sem vigência) e tempos.
- **Planos de produção:** código, descrição e período opcional validado.
- **Ordens de produção:** número único (o sistema sugere OP-0001, OP-0002…), plano, produto ativo, versão do roteiro ligada ao produto, quantidade e unidade.
- **Ilha de apontamento:** `/ilha` e `/api/ilha/*`, com identificação por matrícula, início, pausa com motivo, retomada, troca de operação e baixa com boa, retrabalho e refugo. A tela mostra o tempo produtivo e o de pausa com a mesma regra dos indicadores. Mudanças de estado são condicionais no banco: duas ações simultâneas sobre a mesma execução não passam juntas, e a segunda recebe conflito.
- **Indicadores:** `GET /api/indicadores` lê o banco e calcula produção, tempos e carga por posto (contrato em `specs/contratos/indicadores.md`). Ainda não há tela; o item Indicadores do painel é provisório.
- **Dados fictícios:** `npm run seed:desenvolvimento` popula um banco de desenvolvimento com o fluxo completo, incluindo execuções, pausas e baixas. Não usar no banco do site publicado.
- **Pendentes:** tela de indicadores (os itens Execução e Indicadores do painel são provisórios), dashboard, leitor USB, limpeza da identificação da ilha por inatividade e ativação/inativação de operadores.
- Os contratos de códigos de setor e matrículas automáticas estão em `specs/contratos/operadores-setores.md`. Cadastros antigos mantêm matrículas e podem permanecer sem setor até regularização.
- Não inferir que uma tarefa está concluída só porque aparece em um plano ou roadmap. Atualizar o status apenas após inspecionar o repositório ou receber confirmação da equipe.

## 9. Diretrizes para a IA no VS Code/Codex

Antes de implementar uma tarefa:

1. Ler este arquivo, `MODELO_CONCEITUAL_GUNP_atualizado.md`, `ARCHITECTURE.md`, `TECHNOLOGY.md` e `ROADMAP_GUNP.md`.
2. Inspecionar o código, schema, migrações e testes existentes; distinguir estado real do repositório de planos/documentação.
3. Identificar as entidades e regras já existentes antes de propor alterações.
4. Implementar apenas o escopo solicitado, em mudanças pequenas e coerentes com a arquitetura atual.
5. Não inventar campos, entidades, estados, endpoints ou regras de negócio. Quando houver lacuna ou conflito entre documentos, explicar e perguntar.
6. Não alterar schema ou migrações sem explicar antes o impacto e obter autorização explícita.
7. Não colocar regras críticas apenas no frontend nem importar Prisma no frontend.
8. Não substituir APIs ausentes por dados mockados para aparentar que a funcionalidade está pronta.
9. Incluir validações, tratamento de erros e testes relevantes; respeitar transações para operações que alteram vários registros.
10. Ao terminar, resumir arquivos alterados, decisões tomadas, testes executados e pendências. Não declarar testes executados se não foram realmente executados.

## 10. Organização da equipe

A divisão de responsabilidades abaixo é uma orientação de trabalho para paralelizar tarefas, não uma separação rígida de arquitetura:

- **Gustavo:** interface e fluxo da ilha de produção, leitor/código de identificação e execução/apontamentos.
- **Arthur:** estrutura da aplicação, banco/schema, autenticação quando definida, cadastros e importação CSV conforme escopo.
- **Mateus:** cálculos, testes matemáticos, indicadores, carga por posto e exportações conforme escopo.

Os contratos entre frontend e API, os tipos de entrada/saída e as regras de domínio devem ser combinados antes de tarefas paralelas dependerem umas das outras. Usar branches e PRs para integrar mudanças e evitar que dois integrantes alterem simultaneamente o mesmo schema sem coordenação.

## 11. Fontes e precedência documental

- `MODELO_CONCEITUAL_GUNP_atualizado.md`: referência principal para entidades, relações e regras de domínio.
- `ARCHITECTURE.md`: referência normativa para estilo arquitetural, camadas, direção das dependências, persistência, transações, concorrência e instruções de implementação por IA.
- `TECHNOLOGY.md`: stack e decisões técnicas.
- `ROADMAP_GUNP.md`: fases, tarefas, critérios de conclusão e orientações de implementação.

Os documentos acadêmicos iniciais e o plano de trabalho não são fontes de decisão técnica para a implementação atual. Se houver divergência entre as fontes técnicas, o schema, as migrações ou o código, não presumir qual está correta: registrar a diferença e resolver com a equipe antes de uma mudança estrutural.
