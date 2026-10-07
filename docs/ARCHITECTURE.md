# GUNP - Arquitetura para SDD

## 1. Objetivo e força das decisões

Este documento define como o GUNP deve ser estruturado. Ele é uma referência **normativa** para pessoas e agentes de IA que implementam tarefas orientadas por especificação (SDD).

As regras abaixo usam esta classificação:

- **Obrigatório**: deve ser seguido em qualquer task, salvo alteração explícita desta documentação ou da especificação da task.
- **Convenção**: padrão preferencial. Pode ser ajustado quando a task justificar a mudança e ela for registrada.
- **A definir**: não há decisão suficiente. Não assumir, implementar ou introduzir uma solução sem validação da equipe.

Em caso de conflito, a especificação aprovada da task define o comportamento funcional; este documento define os limites arquiteturais para implementá-lo. Mudanças transversais devem atualizar este documento antes ou junto com o código.

## 2. Estilo arquitetural

**Obrigatório:** o GUNP é um **Modular Monolith** com princípios pragmáticos de **Clean Architecture**.

Ele é uma única aplicação Next.js, com um deploy e um banco de dados, organizada internamente por capacidades do negócio. Não é um conjunto de microserviços e não deve ser separado em aplicações independentes para cada domínio.

Clean Architecture é usada para proteger regras de negócio e reduzir acoplamento com framework, HTTP e banco. Ela não é uma exigência de criar camadas, interfaces ou arquivos que não tenham responsabilidade real.

Princípios obrigatórios:

- organizar código por módulo/domínio antes de organizá-lo por tipo técnico global;
- manter regras de negócio independentes de React, Next.js, HTTP, Prisma e PostgreSQL;
- fazer dependências apontarem para o núcleo do negócio, e não para detalhes técnicos;
- preferir a menor solução que preserve regras, consistência e testabilidade;
- tratar persistência, autorização e integrações como detalhes substituíveis da infraestrutura.

Não introduzir sem justificativa aprovada: microserviços, mensageria, Redis, GraphQL, CQRS completo, event sourcing, event-driven architecture complexa, Kubernetes ou componentes de infraestrutura distribuída.

## 3. Módulos e fronteiras de domínio

Um **módulo** responde a “de qual capacidade do negócio este código faz parte?”. Ele não é uma etapa da execução de uma requisição.

**Convenção:** organizar módulos por capacidades tais como cadastro e estrutura da produção, fichas e operações, execuções e apontamentos, cenários de nivelamento, indicadores e acesso. Os nomes finais e as fronteiras exatas devem seguir as especificações aprovadas; não criar módulos, entidades ou fluxos novos por conveniência.

Um módulo pode conter as seguintes responsabilidades:

```text
modules/<modulo>/
  domain/
  application/
  infrastructure/
  presentation/
```

Essa árvore é uma convenção de organização, não um requisito para que todo módulo tenha todas as pastas. Um CRUD simples pode ter uma estrutura menor, desde que não coloque regras de negócio ou acesso ao banco em lugares errados.

**Obrigatório:** código que pertence claramente a um domínio fica no módulo correspondente. Uma área `shared/` só pode conter elementos realmente transversais, por exemplo erros genéricos, tipos utilitários e validação técnica. Validações técnicas reutilizáveis, como `shared/validation.ts`, ficam nessa área; cálculos e regras de negócio continuam no módulo que os possui. `shared/` não deve virar destino para regras de negócio sem dono.

## 4. Responsabilidades das camadas

### Domain

O **Domain** responde a “o que o negócio permite ou proíbe?”. Ele contém conceitos, entidades, value objects, estados, invariantes, regras e funções puras do negócio.

Exemplos do GUNP:

- uma execução pode estar em `EM_EXECUCAO`, `PAUSADA` ou `FINALIZADA`;
- uma execução finalizada não pode ser retomada;
- um operador não pode ter duas execuções abertas, inclusive se uma estiver pausada;
- uma operação de um cenário deve ser alocada exatamente uma vez;
- a alocação deve respeitar linha, roteiro e precedência;
- demanda, tempo disponível e tempo padrão precisam ser positivos;
- cálculos de takt, carga, ciclo estimado, capacidade e eficiência devem ser funções puras e reproduzíveis.

**Obrigatório:** o Domain não importa nem conhece Next.js, React, HTTP, Prisma, PostgreSQL ou objetos específicos de request/response. Regras que precisam sobreviver a uma troca de interface ou banco não podem ficar em componentes, handlers ou queries.

### Application e Use Cases

A camada **Application** responde a “qual ação o sistema executa e quais passos ela coordena?”. Cada use case representa uma intenção do sistema, não apenas uma chamada ao banco.

Exemplos: iniciar, pausar, retomar, finalizar ou trocar uma execução; registrar baixa; duplicar cenário; mover uma operação; importar dados; consultar indicadores.

Um use case pode:

1. validar a intenção e as permissões recebidas;
2. obter os dados necessários por contratos de persistência;
3. aplicar comportamento do Domain;
4. coordenar escrita, transação e idempotência quando necessárias;
5. retornar um resultado independente de HTTP.

**Obrigatório:** use cases não usam Prisma diretamente e não retornam `Response` ou dependem de `Request`. Eles não devem concentrar regras que pertencem naturalmente às entidades ou funções do Domain.

### Presentation

A camada **Presentation** responde a “como o sistema recebe ou apresenta esta interação?”. No GUNP ela inclui:

- páginas, componentes e estados de interface React;
- Route Handlers da API do Next.js;
- parsing e validação de formato de entrada;
- autenticação e autorização no limite da requisição;
- mapeamento entre resultado da aplicação, erros e resposta HTTP.

**Obrigatório:** a rota é o ponto que escolhe explicitamente o use case. Não há descoberta automática da ação. Por exemplo, uma rota de criação chama o use case de criação e uma rota de pausa chama o use case de pausa definido na task.

Presentation não contém regra de negócio, consultas Prisma ou decisões de transação. Também não presume que uma validação de formulário substitui a validação no servidor.

### Infrastructure

A camada **Infrastructure** responde a “como isso é executado tecnicamente?”. Ela contém detalhes concretos de tecnologia, incluindo implementações Prisma, acesso ao PostgreSQL, mecanismos de autenticação, importação de arquivos, relógio e integrações externas quando aprovadas.

**Obrigatório:** Infrastructure implementa contratos necessários ao núcleo; ela não deve decidir regras de negócio. O código Prisma fica nesta camada, nunca em componentes React, entidades do Domain, use cases ou handlers HTTP.

## 5. Direção das dependências e composição

**Obrigatório:** dependências de código devem seguir esta direção conceitual:

```text
Presentation -> Application -> Domain
Infrastructure -> contratos usados por Application/Domain
```

Infrastructure pode depender das tecnologias externas e implementar contratos definidos para a necessidade do use case. O núcleo não depende da implementação Prisma.

```text
Use Case -> ExecutionRepository (contrato)
PrismaExecutionRepository -> ExecutionRepository
PrismaExecutionRepository -> Prisma -> PostgreSQL
```

É permitido que Presentation reúna a implementação de infraestrutura e o use case para atender uma rota. Essa é a composição da aplicação; ela não autoriza o use case a importar Prisma.

**Convenção:** manter contratos próximos do módulo e da camada que precisa deles. Não criar um container de injeção de dependências, uma interface ou um adapter apenas para repetir uma chamada sem ganho de isolamento, teste ou troca de detalhe técnico.

## 6. Frontend e backend no mesmo Next.js

**Obrigatório:** frontend e backend pertencem ao mesmo projeto Next.js e ao mesmo monólito, mas permanecem separados por responsabilidade.

```text
React UI -> REST API interna -> Application -> Domain -> Infrastructure
```

O frontend consome a API REST interna. Ele não acessa Prisma nem o banco diretamente. A co-localização no mesmo repositório e deploy não elimina a fronteira entre interface, API e regras de negócio.

Como a UI e a API interna têm a mesma origem, não criar configuração de CORS sem uma necessidade externa especificada.

## 7. API REST

**Obrigatório:** a comunicação entre frontend e backend usa API REST.

- rotas representam recursos e operações de forma consistente;
- métodos HTTP devem refletir a intenção da operação;
- identificadores e parâmetros devem ser extraídos e validados na Presentation;
- respostas devem usar um contrato estável definido pela task;
- erros de validação, autorização, inexistência, conflito e falha inesperada devem ser mapeados de forma consistente.

Operações de mudança de estado podem usar endpoints de ação quando a intenção não for uma atualização genérica, por exemplo uma pausa ou retomada de execução. O nome e o contrato exatos dos endpoints são **A definir por task**; não inventá-los fora de um requisito.

Formato padronizado de erros, versionamento de API, paginação e convenções exatas de `PUT` versus `PATCH` são **A definir**. Não introduzir um padrão global sem decisão registrada.

## 8. Repositories e persistência

Um **repository** é um contrato que expressa a necessidade de leitura ou persistência do módulo, sem expor o detalhe do banco ao use case.

**Obrigatório quando houver regra ou orquestração relevante:** Application usa contracts/repositories para acessar persistência; Infrastructure fornece a implementação Prisma.

**Convenção:** métodos de repository devem expressar a necessidade do negócio, como buscar execução aberta de um operador, salvar uma execução ou consultar alocações de um cenário. Não transformar um repository em um espelho genérico de toda a API do ORM.

Restrições que o banco consegue garantir devem existir também no banco: chaves únicas, chaves estrangeiras, obrigatoriedade e demais invariantes relacionais aplicáveis. A validação da API e do Domain complementa essas restrições; ela não as substitui.

Para histórico reproduzível, alterações em tempos padrão, roteiros ou cenários não podem mudar silenciosamente resultados já usados. A estratégia concreta entre snapshot e versionamento imutável é **A definir** quando a task afetar esse comportamento.

## 9. Transações, idempotência e concorrência

### Transações

**Obrigatório:** ações que alteram vários dados e precisam ocorrer integralmente usam transação.

Caso obrigatório: uma troca de operação deve fechar a execução anterior e abrir a próxima como uma unidade atômica. A implementação concreta da transação pertence à Infrastructure; a necessidade de atomicidade pertence ao comportamento definido pelo use case.

### Idempotência

**Obrigatório para comandos críticos:** duplo clique, reenvio por falha de rede e retry não podem duplicar eventos, execução ou produção. Comandos críticos devem aceitar ou gerar um identificador único de solicitação e persistir tratamento suficiente para reconhecer uma repetição.

O formato do identificador, a retenção e a resposta de repetição são **A definir**, desde que a especificação da task não os defina.

### Concorrência

**Obrigatório:** a consistência não pode depender do frontend. Concorrência deve ser protegida tanto no fluxo da aplicação quanto na persistência quando necessário.

Para o piloto, a regra é: cada operador possui no máximo uma execução aberta, inclusive quando pausada. Duas solicitações concorrentes não podem violar essa regra.

A técnica de controle (restrição parcial, lock, controle otimista ou combinação) é **A definir** conforme o esquema e a task. Escolher a alternativa mínima que mantenha a garantia no PostgreSQL e cobri-la com teste.

## 10. Fluxo de uma requisição

Exemplo conceitual de uma pausa de execução:

```text
Usuário na ilha
  -> POST REST para a rota definida
  -> Presentation valida formato, identidade e autorização
  -> PauseExecutionUseCase coordena a ação
  -> Domain valida a transição de estado
  -> repository persiste pela Infrastructure
  -> Prisma executa no PostgreSQL
  -> Presentation devolve resposta HTTP
```

Esse é um mapa de responsabilidades, não uma sequência rígida para qualquer leitura simples. Consultas e CRUDs sem regra relevante podem ser menores, mas não devem quebrar as fronteiras obrigatórias acima.

## 11. Simplicidade proporcional ao MVP

**Obrigatório:** aplicar a arquitetura com pragmatismo.

Não criar:

- abstrações sem consumidor ou sem responsabilidade clara;
- interfaces, services ou mappers que apenas repassam chamadas;
- uma entidade complexa para dados sem comportamento de domínio;
- padrões distribuídos para um único deploy;
- funcionalidades fora do escopo, como câmeras, sensores, otimização automática, app nativo ou sincronização offline completa.

Manter o núcleo priorizado: produção, tempos, carga por posto, execução/apontamento e persistência. Se o leitor USB estiver indisponível, a digitação manual continua sendo o caminho de contingência. O leitor atua como teclado e fornece um identificador; ele não substitui validação, API, persistência nem confirmação da ação.

## 12. Regras operacionais para IA em tasks SDD

Antes de implementar uma task, a IA deve:

1. ler a especificação da task e estes documentos;
2. identificar módulo, entrada, saída, regras, autorização, persistência e testes afetados;
3. reutilizar contratos, estruturas e convenções já existentes;
4. manter cálculos independentes de tela e banco;
5. definir o tratamento de erro e os casos de concorrência/idempotência quando a ação for crítica;
6. testar regras de negócio, transições e condições de falha relevantes;
7. registrar uma lacuna em vez de assumir comportamento não definido.

A IA não deve:

- acessar Prisma fora da Infrastructure;
- colocar regra de negócio na Presentation;
- tratar o use case como depósito de toda regra;
- criar endpoints, entidades, papéis, módulos ou integrações sem requisito;
- alterar contratos compartilhados, banco ou fronteiras de módulo sem comunicar a mudança na especificação;
- interpretar ausência de apontamento como ociosidade;
- afirmar ganho de produtividade real a partir de cálculo ou simulação.

Uma task está pronta quando funciona com persistência quando aplicável, trata os erros relevantes, possui testes proporcionais ao risco e pode ser demonstrada no fluxo definido.
