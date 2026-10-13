# ROADMAP — GUNP

> Roadmap operacional do MVP do GUNP — Sistema Web para Gerenciamento de Nivelamento de Processos em Linhas de Produção.
>
> **Estado atual:** modelo conceitual validado, `contract.prisma` concluído, migration inicial gerada e aplicada corretamente no PostgreSQL. A partir deste ponto começa o desenvolvimento funcional da aplicação.

## 1. Objetivo

Este documento organiza o desenvolvimento do GUNP em etapas executáveis, com dependências, critérios de conclusão e regras para uso de IA no VSCode. A regra central é: **implementar uma etapa pequena, validar e somente então avançar**.

## 2. Escopo do MVP

### Incluído

- [ ] Estrutura da aplicação e API
- [ ] Cadastros de Produtos, Operações, Setores, Postos, Operadores e Motivos de Pausa
- [ ] Roteiros versionados e Etapas
- [ ] Produto–Roteiro
- [ ] Tempo padrão por Produto + Etapa
- [ ] Compatibilidade Etapa–Posto
- [ ] Planos e Ordens de Produção
- [ ] Execução de etapas
- [ ] INICIO, PAUSA, RETOMADA e FINALIZACAO
- [ ] Troca de operação
- [ ] Baixa com boa/retrabalho/refugo
- [ ] Cálculo de tempos
- [ ] Indicadores
- [ ] Dashboard
- [ ] Seed/dados demonstrativos
- [ ] Testes das regras críticas
- [ ] Integração ponta a ponta
- [ ] Deploy e preparação da apresentação

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

Regras já protegidas pelo banco incluem uma única BAIXA por Ordem + Etapa, um único roteiro vigente por Produto, consistência entre status/finalização, quantidades obrigatórias na BAIXA e motivo obrigatório em PAUSA.

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

- [ ] Confirmar estrutura do projeto
- [ ] Configurar `.env`
- [x] Confirmar conexão PostgreSQL (validada durante a criação/aplicação da migration; revalidar no ambiente de cada integrante)
- [x] Confirmar Prisma 8
- [x] Criar módulo de acesso ao banco (módulo Prisma existente; confirmar seu uso na estrutura atual antes de criar outro)
- [ ] Definir tratamento padrão de erros
- [ ] Definir validação de entrada
- [ ] Definir respostas da API
- [ ] Definir logs
- [ ] Definir estados de loading/error no frontend
- [ ] Confirmar lint/typecheck
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

- [ ] Conferir convenções de nomes existentes contra `ARCHITECTURE.md`
- [x] Responsabilidades das camadas documentadas em `ARCHITECTURE.md` (aplicar, não redocumentar)
- [ ] Definir/confirmar contrato de resposta e tratamento de erros sem criar padrão global não aprovado
- [ ] Criar primeira rota
- [ ] Criar primeiro componente funcional

# 7. FASE 3 — Cadastros básicos

Esta é a **primeira grande frente funcional**, conforme a estratégia da equipe.

## 7.1 Operações

- [ ] Listar
- [ ] Criar
- [ ] Editar
- [ ] Ativar/desativar
- [ ] Validar nome obrigatório e duplicidade

## 7.2 Produtos

- [ ] Listar
- [ ] Criar
- [ ] Editar
- [ ] Validar código único
- [ ] Validar nome

## 7.3 Setores

Entrega parcial: criação/listagem em `/painel/setores` e GET/POST `/api/setores`, com nome obrigatório e único, descrição opcional, busca e ordenação. Edição continua pendente. Sem alterações de schema, migrations ou vínculo com operadores nesta entrega. Escritas dos testes são limitadas a repositórios de teste.

- [x] Listar
- [x] Criar
- [ ] Editar
- [x] Validar nome único

## 7.4 Postos

- [ ] Listar
- [ ] Criar
- [ ] Editar
- [ ] Associar a setor
- [ ] Ativar/inativar
- [ ] Validar código único

## 7.5 Operadores

Entrega parcial: criação/listagem em `/painel/operadores` e GET/POST `/api/operadores`, com busca, filtro de status e ordenação. Edição e ativação/inativação continuam pendentes; não considerar o cadastro completo por essa entrega. As evidências de validação devem acompanhar cada implementação.

- [ ] Listar
- [ ] Criar
- [ ] Editar
- [ ] Ativar/inativar
- [ ] Validar matrícula única

## 7.6 Motivos de pausa

- [ ] Listar
- [ ] Criar
- [ ] Editar
- [ ] Ativar/inativar
- [ ] Validar nome único

**Definition of Done:** cada cadastro possui listagem, criação, edição, validação, tratamento de erro, loading, estado vazio e feedback de sucesso/erro.

# 8. FASE 4 — Roteiros

O roteiro é uma das partes centrais do domínio.

## Criar roteiro

- [ ] Nome
- [ ] Versão
- [ ] Ativo/inativo

## Etapas

- [ ] Adicionar operação
- [ ] Definir ordem
- [ ] Reordenar etapas
- [ ] Validar pertencimento ao roteiro

## Produto–Roteiro

- [ ] Associar produto a roteiro
- [ ] Definir roteiro vigente
- [ ] Manter histórico
- [ ] Impedir mais de um vigente por produto

## Tempo padrão

O tempo padrão pertence à combinação **Produto + Etapa do Roteiro**, e não à Operação de forma universal.

- [ ] Cadastrar
- [ ] Editar
- [ ] Validar valor
- [ ] Associar corretamente

## Etapa–Posto

- [ ] Associar etapa a posto
- [ ] Remover associação
- [ ] Visualizar postos compatíveis

**Concluído quando:** é possível cadastrar Produto → Roteiro → Etapas → Operações → Tempo padrão → Postos sem editar o banco manualmente.

# 9. FASE 5 — Planejamento

## Plano de Produção

- [ ] Criar
- [ ] Editar
- [ ] Listar
- [ ] Visualizar
- [ ] Definir período
- [ ] Validar datas

## Ordem de Produção

- [ ] Criar
- [ ] Selecionar produto
- [ ] Selecionar roteiro
- [ ] Informar quantidade/unidade
- [ ] Associar ao plano
- [ ] Gerar/informar número único
- [ ] Listar
- [ ] Visualizar

**Regra crítica:** a Ordem congela a versão de roteiro escolhida. Alterações posteriores no roteiro vigente não modificam Ordens existentes.

Validar produto, roteiro, compatibilidade Produto–Roteiro, quantidade, plano e número único.

# 10. FASE 6 — API de execução

Primeira fase crítica do sistema real.

Fluxo:

```text
Operador → Ordem → Etapa → Posto → Iniciar → EM_EXECUCAO
```

- [ ] Endpoint para iniciar
- [ ] Validar operador
- [ ] Validar Ordem
- [ ] Validar etapa
- [ ] Validar posto
- [ ] Validar compatibilidade etapa/posto
- [ ] Validar que etapa pertence ao roteiro da Ordem
- [ ] Criar `Execucao`
- [ ] Criar `EventoTempo` INICIO

**Regra:** operador não pode possuir duas execuções abertas; `PAUSADA` continua ocupando o operador.

# 11. FASE 7 — Pausa e retomada

## Pausa

`EM_EXECUCAO → PAUSADA`

- [ ] Validar execução aberta
- [ ] Exigir motivo
- [ ] Alterar status
- [ ] Criar EventoTempo PAUSA
- [ ] Registrar horário

## Retomada

`PAUSADA → EM_EXECUCAO`

- [ ] Validar execução pausada
- [ ] Alterar status
- [ ] Criar EventoTempo RETOMADA
- [ ] Registrar horário

Não permitir ações em execução finalizada e não permitir PAUSA sem motivo.

# 12. FASE 8 — Finalização e baixa

## Troca de operação

```text
EM_EXECUCAO → FINALIZADA / TROCA_OPERACAO
```

- [ ] Finalizar execução
- [ ] Criar FINALIZACAO
- [ ] Não registrar quantidades
- [ ] Permitir nova execução

## Baixa

```text
EM_EXECUCAO → FINALIZADA / BAIXA
```

Informar boa, retrabalho e refugo e validar, na transação:

```text
boa + retrabalho + refugo = quantidade da Ordem
```

- [ ] Não permitir baixa parcial
- [ ] Uma única baixa efetiva por Ordem + Etapa
- [ ] Execução finalizada é terminal
- [ ] TROCA_OPERACAO não recebe quantidades
- [ ] BAIXA exige as três quantidades

# 13. FASE 9 — Eventos e cálculo de tempo

Uma execução pode possuir:

```text
INICIO → PAUSA → RETOMADA → PAUSA → RETOMADA → FINALIZACAO
```

Criar funções puras para:

- [ ] duração total
- [ ] tempo de pausa
- [ ] tempo produtivo
- [ ] quantidade produzida
- [ ] comparação com tempo padrão, quando aplicável

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

Indicadores mínimos:

- [ ] Produção
- [ ] Boa
- [ ] Retrabalho
- [ ] Refugo
- [ ] Tempo produtivo
- [ ] Tempo de pausa
- [ ] Tempo total
- [ ] Tempo padrão
- [ ] Carga por posto
- [ ] Carga relativa/utilização
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

Criar dados fictícios para todo o fluxo:

- [ ] Setores
- [ ] Postos
- [ ] Operações
- [ ] Produtos
- [ ] Roteiros
- [ ] Etapas
- [ ] Produto–Roteiro
- [ ] Tempos
- [ ] Etapa–Posto
- [ ] Operadores
- [ ] Motivos
- [ ] Planos
- [ ] Ordens
- [ ] Execuções
- [ ] Eventos
- [ ] Baixas

O seed deve permitir demonstrar Cadastro → Roteiro → Ordem → Execução → Pausa → Retomada → Baixa → Indicadores → Dashboard.

# 20. FASE 16 — Testes

Priorizar regras de negócio.

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

Antes do deploy:

- [ ] Build
- [ ] Typecheck
- [ ] Lint
- [ ] Migration validada
- [ ] Variáveis de ambiente
- [ ] Banco de produção separado
- [ ] Seed controlado
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

## Gustavo — apontamento e produção

- [ ] Ilha de apontamento
- [ ] Início
- [ ] Pausa
- [ ] Retomada
- [ ] Finalização
- [ ] Troca de operação
- [ ] Leitor USB
- [ ] Integração do fluxo de tempos

## Arthur — estrutura, banco e cadastros

- [ ] Estrutura da aplicação
- [ ] API base
- [ ] Prisma
- [ ] Cadastros
- [ ] Roteiros
- [ ] Produtos
- [ ] Operações
- [ ] Planos
- [ ] Ordens
- [ ] Autenticação, se necessária
- [ ] Importação CSV, se permanecer no escopo

## Mateus — cálculos e análise

- [ ] Funções de cálculo
- [ ] Testes matemáticos
- [ ] Indicadores
- [ ] Carga por posto
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
- [ ] Estrutura da aplicação
- [ ] API base
- [ ] Convenções

## M2 — Cadastros

- [ ] Produtos
- [ ] Operações
- [ ] Setores
- [ ] Postos
- [ ] Operadores
- [ ] Motivos

## M3 — Processo produtivo

- [ ] Roteiros
- [ ] Etapas
- [ ] Produto–Roteiro
- [ ] Tempos
- [ ] Etapa–Posto

## M4 — Planejamento

- [ ] Planos
- [ ] Ordens

## M5 — Execução

- [ ] Início
- [ ] Pausa
- [ ] Retomada
- [ ] Troca
- [ ] Baixa
- [ ] Quantidades

## M6 — Tempos

- [ ] Eventos
- [ ] Tempo produtivo
- [ ] Tempo de pausa
- [ ] Testes matemáticos

## M7 — Interface operacional

- [ ] Ilha
- [ ] Fluxo completo
- [ ] Entrada manual
- [ ] Leitor USB, se viável

## M8 — Gestão

- [ ] Indicadores
- [ ] Dashboard
- [ ] Filtros

## M9 — Nivelamento

- [ ] Cenários
- [ ] Comparação
- [ ] Distribuição por posto

## M10 — Entrega

- [ ] Seed
- [ ] Testes
- [ ] Performance
- [ ] Deploy
- [ ] Apresentação

# 34. Primeiro sprint recomendado

Como o banco já está pronto, **não começar pelo dashboard**.

## Sprint 1 — Fundação + Cadastros

- [ ] Estrutura final
- [x] Conexão Prisma validada na migration inicial; revalidar em ambiente limpo
- [ ] API base
- [ ] Tratamento de erros
- [ ] Operações
- [ ] Produtos
- [ ] Setores
- [ ] Postos
- [ ] Operadores
- [ ] Motivos de pausa

## Sprint 2 — Roteiros

- [ ] Roteiro
- [ ] Etapas
- [ ] Produto–Roteiro
- [ ] Tempo padrão
- [ ] Etapa–Posto

## Sprint 3 — Planejamento

- [ ] Plano
- [ ] Ordem

## Sprint 4 — Execução

- [ ] Início
- [ ] Pausa
- [ ] Retomada
- [ ] Troca
- [ ] Baixa

## Sprint 5 — Indicadores

- [ ] Eventos
- [ ] Tempo produtivo
- [ ] Produção
- [ ] Carga

## Sprint 6 — Interface completa

- [ ] Ilha
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
