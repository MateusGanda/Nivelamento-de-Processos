# ROADMAP — GUNP

> Roadmap operacional do MVP do GUNP — Sistema Web para Gerenciamento de Nivelamento de Processos em Linhas de Produção.
>
> **Estado atual (26/10/2026):** cadastros administrativos, roteiros, planos, ordens, a API e a tela da ilha de apontamento e a rota de indicadores estão na `develop` e no site publicado. Faltam a tela de indicadores, o dashboard, o leitor USB e o teste do fluxo ponta a ponta. As marcações abaixo refletem o código nessa data; conferir o repositório antes de presumir que algo está pronto.

## 1. Objetivo

Este documento organiza o desenvolvimento do GUNP em etapas executáveis, com dependências, critérios de conclusão e regras para uso de IA no VSCode. A regra central é: **implementar uma etapa pequena, validar e somente então avançar**.

## 2. Escopo do MVP

### Incluído

- [x] Estrutura da aplicação e API
- [x] Cadastros de Produtos, Operações, Setores, Postos, Operadores e Motivos de Pausa
- [x] Roteiros versionados e Etapas
- [x] Produto–Roteiro
- [x] Tempo padrão por Produto + Etapa
- [x] Compatibilidade Etapa–Posto
- [x] Planos e Ordens de Produção
- [x] Execução de etapas
- [x] INICIO, PAUSA, RETOMADA e FINALIZACAO
- [x] Troca de operação
- [x] Baixa com boa/retrabalho/refugo
- [x] Cálculo de tempos
- [ ] Indicadores (cálculo e rota prontos; falta a tela)
- [ ] Dashboard
- [x] Seed/dados demonstrativos
- [x] Testes das regras críticas
- [ ] Integração ponta a ponta
- [ ] Deploy e preparação da apresentação (deploy da `develop` na Vercel em funcionamento; apresentação pendente)

### Fora do MVP

Dependências entre etapas, otimização automática, sensores, integração com máquinas, controle detalhado de todos os trabalhadores de uma célula, capacidade avançada de postos, previsão sofisticada, leitor físico de QR/código de barras como requisito obrigatório, permissões granulares e funcionalidades adicionais não aprovadas. A identificação do operador por QR/código pode fazer parte do fluxo da ilha; o leitor físico é opcional e a digitação manual deve continuar disponível.

## 3. Estado atual

- [x] Modelo relacional definido
- [x] `contract.prisma` definido
- [x] `npx prisma contract emit`
- [x] Migration inicial gerada
- [x] Migration validada
- [x] Migration aplicada no PostgreSQL
- [x] PKs/FKs
- [x] UNIQUEs
- [x] CHECKs principais
- [x] Índices parciais
- [x] Migrations de 21/10 a 26/10/2026 aplicadas no banco do site e no banco de desenvolvimento: código do setor, setor principal e função do operador, `ativo` em operação/produto/setor, datas do plano como texto e uma execução aberta por operador

Regras já protegidas pelo banco incluem uma única BAIXA por Ordem + Etapa, um único roteiro vigente por Produto, consistência entre status/finalização, quantidades obrigatórias na BAIXA, motivo obrigatório em PAUSA e uma única execução aberta (em execução ou pausada) por operador.

---

# 4. Estratégia geral

```text
Infraestrutura
    ↓
Cadastros básicos
    ↓
Roteiros e tempos
    ↓
Planejamento
    ↓
Ordens de produção
    ↓
Fluxo de execução
    ↓
Eventos e tempos
    ↓
Indicadores
    ↓
Dashboard
    ↓
Integração ponta a ponta
    ↓
Testes
    ↓
Seed / demonstração
    ↓
Deploy / apresentação
```

Não construir o dashboard completo antes de existir dado real produzido pelo fluxo de execução.

# 5. FASE 1 — Estrutura da aplicação

**Objetivo:** garantir que todos consigam executar o projeto e que a base técnica esteja organizada.

- [x] Confirmar estrutura do projeto (`modules/<módulo>/{domain,application,infrastructure,presentation}`)
- [x] Configurar `.env` (variáveis documentadas em `.env.example`, sem valores reais)
- [x] Confirmar conexão PostgreSQL (validada durante a criação/aplicação da migration; revalidar no ambiente de cada integrante)
- [x] Confirmar Prisma 8
- [x] Criar módulo de acesso ao banco (módulo Prisma existente; confirmar seu uso na estrutura atual antes de criar outro)
- [x] Definir tratamento padrão de erros (`{ erro: { codigo, mensagem } }`, ver `TECHNOLOGY.md`)
- [x] Definir validação de entrada (no domínio de cada módulo; corpos com campos não previstos são recusados)
- [x] Definir respostas da API
- [ ] Definir logs
- [x] Definir estados de loading/error no frontend
- [x] Confirmar lint/typecheck (também na verificação do GitHub Actions)
- [ ] Confirmar execução local para toda a equipe

**Concluído quando:** uma máquina nova instala, configura, conecta ao banco, inicia a aplicação e executa uma chamada simples ao banco.

# 6. FASE 2 — Arquitetura

A organização obrigatória é um monólito modular com princípios pragmáticos de Clean Architecture. `ARCHITECTURE.md` é a fonte normativa para fronteiras de módulos, camadas e direção das dependências; este roadmap não deve redefinir essas regras. Consulte também `TECHNOLOGY.md` para decisões de stack.

Sugestão de organização por domínio:

```text
src/
├── modules/
│   ├── produtos/
│   ├── operacoes/
│   ├── roteiros/
│   ├── planos/
│   ├── ordens/
│   ├── execucoes/
│   └── indicadores/
├── shared/
│   ├── errors/
│   ├── validation/
│   └── database/
└── routes/
```

No frontend, separar `app`, `components`, `features`, `lib` e `types` conforme a arquitetura já existente. Não criar abstrações só por seguir este exemplo.

A estrutura adotada no código difere desta sugestão: os módulos ficam em `modules/` na raiz, com nomes em inglês (`products`, `operations`, `sectors`, `workstations`, `operators`, `routings`, `production-plans`, `production-orders`, `executions`, `indicators`, `access`), e as rotas e páginas ficam em `app/`.

- [x] Conferir convenções de nomes existentes contra `ARCHITECTURE.md`
- [x] Responsabilidades das camadas documentadas em `ARCHITECTURE.md` (aplicar, não redocumentar)
- [x] Definir/confirmar contrato de resposta e tratamento de erros sem criar padrão global não aprovado
- [x] Criar primeira rota
- [x] Criar primeiro componente funcional

# 7. FASE 3 — Cadastros básicos

Esta é a **primeira grande frente funcional**, conforme a estratégia da equipe.

## 7.1 Operações

Entrega de listagem, criação, edição e ativação/inativação em `/painel/operacoes`, com GET/POST `/api/operacoes`, PATCH `/api/operacoes/[id]` e PATCH `/api/operacoes/[id]/status`. Nome obrigatório e único, descrição opcional, busca, filtro de status e ordenação. Detalhes e limites de verificação em `docs/design/OPERACOES_GUNP.md`.

- [x] Listar
- [x] Criar
- [x] Editar
- [x] Ativar/desativar
- [x] Validar nome obrigatório e duplicidade

## 7.2 Produtos

Página `/painel/produtos`, com GET/POST `/api/produtos`, PATCH `/api/produtos/[id]` e PATCH `/api/produtos/[id]/status`.

- [x] Listar
- [x] Criar
- [x] Editar
- [x] Ativar/inativar
- [x] Validar código único
- [x] Validar nome

## 7.3 Setores

Página `/painel/setores`, com GET/POST `/api/setores`, PATCH `/api/setores/[id]` (nome e descrição) e PATCH `/api/setores/[id]/status`. Código automático permanente, nome único, descrição opcional, busca e ordenação. Contrato: specs/contratos/operadores-setores.md.

- [x] Listar
- [x] Criar
- [x] Editar
- [x] Ativar/inativar
- [x] Validar nome único
- [x] Gerar código funcional único automaticamente

## 7.4 Postos

Página `/painel/postos`, com GET/POST `/api/postos`, PATCH `/api/postos/[id]` e PATCH `/api/postos/[id]/status`. Setor inativo não recebe posto novo.

- [x] Listar
- [x] Criar
- [x] Editar
- [x] Associar a setor
- [x] Ativar/inativar
- [x] Validar código único

## 7.5 Operadores

Criação, listagem e edição em /painel/operadores e GET/POST /api/operadores + PATCH /api/operadores/[id]. Matrícula automática permanente, setor principal nos novos cadastros (somente setor ativo), função opcional, preservação dos legados e filtro de status.

- [x] Listar
- [x] Criar
- [x] Editar nome, setor e função
- [ ] Ativar/inativar
- [x] Gerar matrícula única automaticamente
- [x] Preservar matrícula após transferência e edição do nome

## 7.6 Motivos de pausa

Página `/painel/motivos-de-pausa`, com GET/POST `/api/motivos-de-pausa`, PATCH `/api/motivos-de-pausa/[id]` e PATCH `/api/motivos-de-pausa/[id]/status`, em `modules/pause-reasons`. A ilha lista somente os motivos ativos. Lista proposta em `docs/MOTIVOS_DE_PAUSA.md`.

- [x] Listar
- [x] Criar
- [x] Editar
- [x] Ativar/inativar
- [x] Validar nome único

**Definition of Done:** cada cadastro possui listagem, criação, edição, validação, tratamento de erro, loading, estado vazio e feedback de sucesso/erro.

# 8. FASE 4 — Roteiros

O roteiro é uma das partes centrais do domínio.

Páginas `/painel/roteiros` e `/painel/roteiros/[id]`, com `/api/roteiros` e sub-rotas, em `modules/routings`. Quando o roteiro já tem ordens, as etapas e os tempos dos produtos com ordens ficam travados e a mudança é feita em uma nova versão, que copia a anterior (decisão de 19/10/2026).

## Criar roteiro

- [x] Nome
- [x] Versão
- [x] Ativo/inativo

## Etapas

- [x] Adicionar operação
- [x] Definir ordem
- [x] Reordenar etapas
- [x] Validar pertencimento ao roteiro

## Produto–Roteiro

- [x] Associar produto a roteiro
- [x] Definir roteiro vigente
- [x] Manter histórico
- [x] Impedir mais de um vigente por produto

## Tempo padrão

O tempo padrão pertence à combinação **Produto + Etapa do Roteiro**, e não à Operação de forma universal.

- [x] Cadastrar
- [x] Editar
- [x] Validar valor
- [x] Associar corretamente

## Etapa–Posto

- [x] Associar etapa a posto
- [x] Remover associação
- [x] Visualizar postos compatíveis

**Concluído quando:** é possível cadastrar Produto → Roteiro → Etapas → Operações → Tempo padrão → Postos sem editar o banco manualmente.

# 9. FASE 5 — Planejamento

## Plano de Produção

Página `/painel/planos-de-producao`, com `/api/planos-de-producao` e `/api/planos-de-producao/[id]`.

- [x] Criar
- [x] Editar
- [x] Listar
- [x] Visualizar
- [x] Definir período
- [x] Validar datas

## Ordem de Produção

Página `/painel/ordens-de-producao`, com `/api/ordens-de-producao` e `/api/ordens-de-producao/[id]`. Depois que a ordem tem execuções, a quantidade e a unidade não mudam. A exclusão de ordem sem execuções não está implementada e depende de decisão da equipe.

- [x] Criar
- [x] Selecionar produto
- [x] Selecionar roteiro
- [x] Informar quantidade/unidade
- [x] Associar ao plano
- [x] Gerar/informar número único
- [x] Listar
- [x] Visualizar

**Regra crítica:** a Ordem congela a versão de roteiro escolhida. Alterações posteriores no roteiro vigente não modificam Ordens existentes.

Validar produto, roteiro, compatibilidade Produto–Roteiro, quantidade, plano e número único.

# 10. FASE 6 — API de execução

Primeira fase crítica do sistema real.

Fluxo:

```text
Operador → Ordem → Etapa → Posto → Iniciar → EM_EXECUCAO
```

Implementada em `modules/executions`, com as rotas `/api/ilha/*`, acessíveis somente pelo terminal liberado com a chave da ilha.

- [x] Endpoint para iniciar
- [x] Validar operador
- [x] Validar Ordem
- [x] Validar etapa
- [x] Validar posto
- [x] Validar compatibilidade etapa/posto
- [x] Validar que etapa pertence ao roteiro da Ordem
- [x] Criar `Execucao`
- [x] Criar `EventoTempo` INICIO

**Regra:** operador não pode possuir duas execuções abertas; `PAUSADA` continua ocupando o operador. Garantida também pelo índice único parcial `Execucao_operador_aberta_unica`.

# 11. FASE 7 — Pausa e retomada

## Pausa

`EM_EXECUCAO → PAUSADA`

- [x] Validar execução aberta
- [x] Exigir motivo
- [x] Alterar status
- [x] Criar EventoTempo PAUSA
- [x] Registrar horário

## Retomada

`PAUSADA → EM_EXECUCAO`

- [x] Validar execução pausada
- [x] Alterar status
- [x] Criar EventoTempo RETOMADA
- [x] Registrar horário

Não permitir ações em execução finalizada e não permitir PAUSA sem motivo.

# 12. FASE 8 — Finalização e baixa

## Troca de operação

```text
EM_EXECUCAO → FINALIZADA / TROCA_OPERACAO
```

- [x] Finalizar execução
- [x] Criar FINALIZACAO
- [x] Não registrar quantidades
- [x] Permitir nova execução

## Baixa

```text
EM_EXECUCAO → FINALIZADA / BAIXA
```

Informar boa, retrabalho e refugo e validar, na transação:

```text
boa + retrabalho + refugo = quantidade da Ordem
```

- [x] Não permitir baixa parcial
- [x] Uma única baixa efetiva por Ordem + Etapa
- [x] Execução finalizada é terminal
- [x] TROCA_OPERACAO não recebe quantidades
- [x] BAIXA exige as três quantidades

# 13. FASE 9 — Eventos e cálculo de tempo

Uma execução pode possuir:

```text
INICIO → PAUSA → RETOMADA → PAUSA → RETOMADA → FINALIZACAO
```

Criar funções puras para (em `modules/indicators/domain`):

- [x] duração total
- [x] tempo de pausa
- [x] tempo produtivo
- [x] quantidade produzida
- [x] comparação com tempo padrão, quando aplicável

**Regra:** tempo produtivo é derivado dos intervalos ativos. Não usar simplesmente `FINALIZACAO - INICIO` quando existem pausas. Ausência de eventos não prova ociosidade.

Testar execução sem pausa, uma pausa, múltiplas pausas, retomada, limites e eventos inválidos.

# 14. FASE 10 — Ilha de apontamento

Fluxo:

```text
Identificação → Ordem → Etapa → Posto → INICIAR
                                      ↓
                       execução ativa
                       ├─ PAUSAR
                       ├─ RETOMAR
                       ├─ TROCAR
                       └─ FINALIZAR/BAIXAR
```

Exibir operador, ordem, produto, etapa, operação, posto, tempo decorrido, status e ações.

Implementar estados de loading, vazio, execução ativa, pausada, erro e sucesso.

Implementada em `/ilha` (pull requests 54 e 55). O terminal é liberado pela chave da ilha; o operador é identificado pela matrícula, digitada ou lida. Pendentes: limpar a identificação por inatividade (precisa de regra da equipe), link da ilha a partir do painel e teste do fluxo no site depois de cadastrar os motivos de pausa.

- [x] Identificação por matrícula
- [x] Escolha de ordem, etapa e posto
- [x] Iniciar, pausar com motivo, retomar, trocar e dar baixa
- [x] Tempo produtivo e de pausa na tela
- [x] Estados de carregamento, vazio, execução ativa, pausada, erro e sucesso
- [ ] Limpeza da identificação por inatividade

# 15. FASE 11 — Leitor USB

Implementar somente depois do fluxo manual funcionar.

- [ ] Campo sempre focado
- [ ] Leitura do código
- [ ] Validação
- [ ] Busca
- [ ] Confirmação
- [ ] Fallback manual

O leitor USB HID apenas fornece um identificador; não deve conter regra de negócio. Uma leitura isolada não é prova de produtividade.

# 16. FASE 12 — Indicadores

Implementar como funções independentes da UI e do banco.

As funções estão em `modules/indicators/domain` e a rota `GET /api/indicadores` lê o banco (contrato em `specs/contratos/indicadores.md`). Falta a tela; os filtros `setorId` e `postoId` ainda são recusados.

Indicadores mínimos:

- [x] Produção
- [x] Boa
- [x] Retrabalho
- [x] Refugo
- [x] Tempo produtivo
- [x] Tempo de pausa
- [x] Tempo total
- [x] Tempo padrão
- [x] Carga por posto
- [ ] Carga relativa/utilização (participação de cada posto na carga implementada; utilização fora do MVP, conforme o contrato)
- [ ] Takt/ciclo, se permanecer no recorte final

Para cada indicador documentar entrada, fórmula, unidade, exemplo manual e teste.

# 17. FASE 13 — Dashboard

Construir depois dos indicadores.

- [ ] Seleção do plano
- [ ] Período
- [ ] Produto
- [ ] Produção
- [ ] Tempos
- [ ] Carga por posto
- [ ] Operações
- [ ] Alertas explicáveis
- [ ] Filtros por período/setor/posto/produto/operação
- [ ] Loading/erro/sem dados

Não colocar números fictícios dentro dos componentes. Mock/seed deve ficar na camada de dados.

# 18. FASE 14 — Cenários e nivelamento

Implementar somente após núcleo de produção e indicadores.

```text
Configuração atual → Copiar → Cenário → Alterar distribuição → Recalcular → Comparar
```

- [ ] Criar cenário
- [ ] Preservar referência
- [ ] Alterar alocações
- [ ] Validar
- [ ] Recalcular
- [ ] Comparar
- [ ] Exibir diferenças

O sistema apoia análise; não deve afirmar que realizou otimização automática.

# 19. FASE 15 — Seed

Criar dados fictícios para todo o fluxo (`npm run seed:desenvolvimento`, somente no banco de desenvolvimento):

- [x] Setores
- [x] Postos
- [x] Operações
- [x] Produtos
- [x] Roteiros
- [x] Etapas
- [x] Produto–Roteiro
- [x] Tempos
- [x] Etapa–Posto
- [x] Operadores
- [x] Motivos
- [x] Planos
- [x] Ordens
- [x] Execuções
- [x] Eventos
- [x] Baixas

O seed deve permitir demonstrar Cadastro → Roteiro → Ordem → Execução → Pausa → Retomada → Baixa → Indicadores → Dashboard.

# 20. FASE 16 — Testes

Priorizar regras de negócio.

Em 26/10/2026 os testes automatizados (`npm test`, com `node:test`) cobrem domínio, casos de uso e rotas HTTP de cada módulo, com repositórios simulados, além de um teste opcional das migrations dos cadastros de operadores e setores em PostgreSQL embarcado. As demais regras de banco e as de concorrência foram conferidas manualmente em bancos PostgreSQL descartáveis, criados pelas migrations, sem teste automatizado. Por isso os itens abaixo continuam abertos até a etapa de testes (10/11) registrar a evidência.

## Banco

- [ ] UNIQUE
- [ ] FKs
- [ ] CHECKs
- [ ] índices parciais

## API

- [ ] criação
- [ ] atualização
- [ ] validações
- [ ] transações
- [ ] erros

## Execução

- [ ] iniciar
- [ ] pausar
- [ ] retomar
- [ ] finalizar
- [ ] trocar
- [ ] baixar
- [ ] impedir baixa duplicada
- [ ] impedir duas execuções abertas
- [ ] impedir alteração após finalização

## Quantidades

Testar correto, acima, abaixo, zero, decimais e negativos para:

`boa + retrabalho + refugo = quantidade da Ordem`

## Tempo

Testar sem pausa, uma pausa, múltiplas pausas, retomada e finalização.

# 21. FASE 17 — Integração ponta a ponta

O fluxo obrigatório deve ser:

```text
Cadastrar produto
→ Operações
→ Roteiro
→ Etapas
→ Tempo padrão
→ Posto
→ Plano
→ Ordem
→ Operador
→ Início
→ Pausa
→ Retomada
→ Finalização
→ Baixa
→ Indicadores
→ Dashboard
```

Se esse fluxo funcionar sem intervenção manual no banco, o núcleo do MVP é demonstrável.

# 22. FASE 18 — Qualidade

## Frontend

- [ ] Erros compreensíveis
- [ ] Loading
- [ ] Empty states
- [ ] Confirmações
- [ ] Formulários consistentes
- [ ] Tabelas
- [ ] Responsividade
- [ ] Acessibilidade básica

## Backend

- [ ] Erros padronizados
- [ ] Validação
- [ ] Transações
- [ ] Logs
- [ ] Concorrência
- [ ] Queries eficientes

# 23. FASE 19 — Performance

Medir antes de otimizar:

- [ ] tempo da API
- [ ] tempo das queries
- [ ] quantidade de queries por tela
- [ ] carregamento do dashboard

Separar diagnóstico entre frontend, API, serviço e banco. Não assumir que uma query é o gargalo sem medir.

# 24. FASE 20 — Segurança mínima

- [ ] Credenciais fora do Git
- [ ] `.env` protegido
- [ ] Inputs validados
- [ ] Endpoints sensíveis protegidos
- [ ] Erros sem stack trace para usuário
- [ ] Dados reais da empresa somente com autorização

Permissões granulares completas permanecem fora do MVP.

# 25. FASE 21 — Deploy

A `develop` é publicada na Vercel a cada merge. O GitHub Actions executa instalação, lint, tipos, testes e build em cada pull request.

Antes do deploy:

- [x] Build
- [x] Typecheck
- [x] Lint
- [x] Migration validada
- [x] Variáveis de ambiente
- [x] Banco de produção separado (banco do site separado da branch de desenvolvimento no Neon)
- [x] Seed controlado (somente por `SEED_DATABASE_URL`, nunca no banco do site)
- [ ] Logs
- [ ] Fluxo ponta a ponta

Não executar seed destrutivo em produção sem confirmação explícita.

# 26. FASE 22 — Apresentação

Roteiro recomendado:

1. Problema.
2. Cadastro rápido.
3. Roteiro e tempos.
4. Ordem de produção.
5. Apontamento: início → pausa → retomada → finalização.
6. Resultado: produção e tempos.
7. Dashboard.
8. Cenário/nivelamento, se implementado.

O sistema deve apresentar capacidade calculada como teórica; não afirmar ganho real de produtividade sem estudo de campo autorizado.

# 27. Divisão da equipe

A divisão abaixo é a orientação original. Na prática, parte das tarefas foi redistribuída conforme o prazo de cada etapa (por exemplo, a ilha foi feita junto com o cadastro de ordens); o histórico de cada entrega está nos pull requests.

## Gustavo — apontamento e produção

- [x] Ilha de apontamento
- [x] Início
- [x] Pausa
- [x] Retomada
- [x] Finalização
- [x] Troca de operação
- [ ] Leitor USB
- [x] Integração do fluxo de tempos

## Arthur — estrutura, banco e cadastros

- [x] Estrutura da aplicação
- [x] API base
- [x] Prisma
- [x] Cadastros
- [x] Roteiros
- [x] Produtos
- [x] Operações
- [x] Planos
- [x] Ordens
- [x] Autenticação, se necessária
- [ ] Importação CSV, se permanecer no escopo

## Mateus — cálculos e análise

- [x] Funções de cálculo
- [x] Testes matemáticos
- [ ] Indicadores (rota pronta; falta a tela)
- [x] Carga por posto
- [ ] Dashboard
- [ ] Filtros
- [ ] Exportação
- [ ] Cenários/comparações

Todos participam da integração, revisão, testes, decisões de domínio e apresentação.

# 28. Contratos frontend/backend

Antes de uma tela depender de API, definir:

1. endpoint;
2. método;
3. parâmetros;
4. request;
5. response;
6. erros;
7. estados.

Exemplo apenas ilustrativo:

```text
POST /execucoes

Request:
{
  ordemProducaoId,
  etapaRoteiroId,
  operadorId,
  postoId
}

Response:
{
  id,
  status,
  criadoEm
}
```

O contrato real deve ser acordado pela equipe.

# 29. Regras de domínio que não podem ser alteradas casualmente

### Ordem

- Uma Ordem representa um produto.
- Não existe baixa parcial.
- A baixa representa 100% da quantidade da Ordem na etapa.
- `boa + retrabalho + refugo = quantidade da Ordem`.

### Execução

- Pode haver várias execuções para uma etapa.
- Apenas uma BAIXA efetiva.
- Estados: `EM_EXECUCAO`, `PAUSADA`, `FINALIZADA`.
- Finalizada é terminal.
- Troca de operação encerra a execução atual.
- Operador não possui duas execuções abertas.

### Tempo

- `INICIO`, `PAUSA`, `RETOMADA`, `FINALIZACAO`.
- PAUSA exige motivo.
- Tempo produtivo vem dos intervalos ativos.

### Roteiro

- É versionado.
- Ordem congela a versão.
- Alterações posteriores não alteram Ordens existentes.
- Sequência é nominal/organizacional no MVP.
- Não implementar dependências entre etapas.

### Posto

- Uma etapa pode ter vários postos compatíveis.
- Uma execução usa um posto.
- Posto e Recurso são uma entidade única no MVP.

# 30. Regras para IA no VSCode

Antes de alterar código, a IA deve:

1. Ler `ROADMAP_GUNP.md`.
2. Ler `src/prisma/contract.prisma`.
3. Respeitar o modelo conceitual.
4. Verificar o código existente.
5. Identificar a fase atual.
6. Implementar somente a menor etapa necessária.

A IA **não deve**:

- alterar schema/banco sem autorização;
- inventar entidades, campos ou estados;
- remover regras de domínio;
- criar dependências entre etapas;
- implementar funcionalidades de fases futuras;
- colocar regra crítica somente no frontend;
- duplicar cálculos;
- substituir arquitetura existente sem necessidade;
- usar mocks para esconder APIs inexistentes.

Quando uma mudança de banco for necessária, explicar antes:

```text
O que muda?
Por que muda?
Qual regra exige a mudança?
Qual impacto no modelo?
Qual impacto na migration?
```

Sempre preferir:

```text
1 funcionalidade → implementação → teste → validação → próxima
```

# 31. Prompt-base para IA

```text
Você está trabalhando no projeto GUNP.

Antes de alterar qualquer código:

1. Leia CONTEXTO_DO_PROJETO.md.
2. Leia MODELO_CONCEITUAL_GUNP_atualizado.md.
3. Leia ARCHITECTURE.md e TECHNOLOGY.md.
4. Leia ROADMAP_GUNP.md e src/prisma/contract.prisma.
5. Respeite o modelo conceitual do projeto.
4. Verifique a implementação existente.
5. Identifique a fase atual do roadmap.
6. Não implemente funcionalidades de fases futuras.

Regras:
- Não altere banco/schema sem autorização explícita.
- Não invente entidades, campos ou estados.
- Preserve as regras de negócio existentes.
- Regras críticas devem ser protegidas no backend/transação e, quando apropriado, no banco.
- Não coloque lógica crítica somente no frontend.
- Não duplique cálculos.
- Prefira implementações pequenas e testáveis.
- Verifique abstrações existentes antes de criar novas.
- Não use mocks para esconder APIs inexistentes.

Ao terminar, informe:
1. arquivos alterados;
2. o que foi implementado;
3. regras de negócio aplicadas;
4. testes executados;
5. pendências.
```

# 32. Definition of Done

Uma tarefa está concluída quando:

- [ ] código implementado;
- [ ] entrada validada;
- [ ] regra de negócio respeitada;
- [ ] erro tratado;
- [ ] loading/empty state quando aplicável;
- [ ] teste criado para regra relevante;
- [ ] typecheck passando;
- [ ] lint passando;
- [ ] fluxo manual validado;
- [ ] nenhuma funcionalidade futura foi introduzida.

# 33. Milestones

## M1 — Fundação

- [x] Banco criado
- [x] Prisma configurado
- [x] Estrutura da aplicação
- [x] API base
- [x] Convenções

## M2 — Cadastros

- [x] Produtos
- [x] Operações
- [x] Setores
- [x] Postos
- [x] Operadores
- [x] Motivos

## M3 — Processo produtivo

- [x] Roteiros
- [x] Etapas
- [x] Produto–Roteiro
- [x] Tempos
- [x] Etapa–Posto

## M4 — Planejamento

- [x] Planos
- [x] Ordens

## M5 — Execução

- [x] Início
- [x] Pausa
- [x] Retomada
- [x] Troca
- [x] Baixa
- [x] Quantidades

## M6 — Tempos

- [x] Eventos
- [x] Tempo produtivo
- [x] Tempo de pausa
- [x] Testes matemáticos

## M7 — Interface operacional

- [x] Ilha
- [ ] Fluxo completo
- [x] Entrada manual
- [ ] Leitor USB, se viável

## M8 — Gestão

- [ ] Indicadores (rota pronta; falta a tela)
- [ ] Dashboard
- [ ] Filtros

## M9 — Nivelamento

- [ ] Cenários
- [ ] Comparação
- [ ] Distribuição por posto

## M10 — Entrega

- [x] Seed
- [ ] Testes
- [ ] Performance
- [ ] Deploy
- [ ] Apresentação

# 34. Primeiro sprint recomendado

Como o banco já está pronto, **não começar pelo dashboard**.

## Sprint 1 — Fundação + Cadastros

- [x] Estrutura final
- [x] Conexão Prisma validada na migration inicial; revalidar em ambiente limpo
- [x] API base
- [x] Tratamento de erros
- [x] Operações
- [x] Produtos
- [x] Setores
- [x] Postos
- [x] Operadores
- [x] Motivos de pausa

## Sprint 2 — Roteiros

- [x] Roteiro
- [x] Etapas
- [x] Produto–Roteiro
- [x] Tempo padrão
- [x] Etapa–Posto

## Sprint 3 — Planejamento

- [x] Plano
- [x] Ordem

## Sprint 4 — Execução

- [x] Início
- [x] Pausa
- [x] Retomada
- [x] Troca
- [x] Baixa

## Sprint 5 — Indicadores

- [x] Eventos
- [x] Tempo produtivo
- [x] Produção
- [x] Carga

## Sprint 6 — Interface completa

- [x] Ilha
- [ ] Dashboard
- [ ] Integração

# 35. Marco principal do MVP

O MVP deve permitir, sem intervenção manual no banco:

```text
CADASTRAR
  ↓
Produto → Operações → Roteiro → Etapas → Tempo → Posto
  ↓
Plano → Ordem
  ↓
EXECUTAR
  ↓
Operador → Início → Pausa → Retomada → Finalização → Baixa
  ↓
CALCULAR
  ↓
Tempos → Produção → Carga → Indicadores
  ↓
VISUALIZAR
  ↓
Dashboard
```

Esse é o fluxo de prioridade máxima. Funcionalidades que não contribuem para ele devem ficar abaixo do fluxo principal até que o núcleo esteja funcionando.

# 36. Princípio final

O GUNP não precisa ser um sistema industrial completo para cumprir seu objetivo acadêmico. O foco do MVP é demonstrar, de forma verificável:

> **dados estruturados → processo produtivo → execução/apontamento → tempos → indicadores → análise da distribuição da carga.**

A complexidade deve ser adicionada somente quando houver necessidade real do domínio ou exigência do escopo do TCC.
