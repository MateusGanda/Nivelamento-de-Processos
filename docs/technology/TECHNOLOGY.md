# GUNP - Tecnologia para SDD

## 1. Objetivo e status das decisões

Este documento define a stack conhecida do GUNP e o papel de cada tecnologia. Ele deve ser lido junto com `ARCHITECTURE.md` antes de implementar uma task SDD.

Classificação usada:

- **Obrigatório**: tecnologia ou prática decidida para o projeto.
- **A definir**: ainda não existe decisão. Não escolher uma biblioteca, serviço ou padrão por conta própria.
- **Não introduzir sem justificativa**: só pode entrar com requisito claro, impacto avaliado e decisão registrada.

| Área | Status | Decisão atual |
| --- | --- | --- |
| Framework web e servidor | Obrigatório | Next.js (App Router) |
| Interface | Obrigatório | React |
| Ícones | Padrão adotado | Lucide React (`lucide-react`), com imports individuais |
| Linguagem | Obrigatório | TypeScript |
| Comunicação UI-servidor | Obrigatório | API REST interna |
| Persistência | Obrigatório | Prisma 8 e PostgreSQL (Neon no ambiente atual) |
| Autenticação administrativa | Obrigatório como capacidade | Auth.js (Credentials Provider), JWT de 12 horas e Argon2id |
| Testes automatizados | Obrigatório | Framework e comandos **A definir** |
| Qualidade estática | Necessária | Ferramentas e configuração **A definir** |

As versões efetivamente instaladas devem ser verificadas no `package.json` e no lockfile antes de serem alteradas. Prisma 8 é a versão adotada no fluxo atual do projeto. Não inferir versões de outras dependências sem inspecionar os arquivos do repositório.

## 2. Next.js

**Obrigatório:** Next.js é o framework da aplicação única do GUNP. Ele hospeda a interface React e a API no servidor dentro do mesmo projeto e deploy.

Papel no projeto:

- organizar páginas, rotas e navegação da aplicação web;
- oferecer Route Handlers para a API REST interna;
- executar código de servidor que compõe Presentation, Application e Infrastructure;
- manter área do gestor e ilha de apontamento na mesma aplicação.

Next.js não substitui as fronteiras arquiteturais: um Route Handler é Presentation, e componentes React não acessam banco diretamente.

O projeto utiliza o App Router do Next.js. Estratégia específica de renderização, cache, middleware e hospedagem só deve ser alterada quando a task ou uma decisão registrada justificar a mudança.

## 3. React

**Obrigatório:** React é a camada de interface.

Papel no projeto:

- apresentar dashboards, cadastros, cenários e comparação de indicadores;
- implementar a ilha compartilhada de apontamento;
- mostrar estados de carregamento, erro, vazio e confirmação de ações;
- enviar ações e consultas à API REST interna.

A interface deve exibir unidades de medida e diferenciar valores apontados de estimativas. Para o leitor USB, ela mantém um campo de leitura/digitação e confirma a ação solicitada; a leitura isolada não executa uma operação automaticamente.

Bibliotecas de componentes, gerenciamento de estado global, formulários, gráficos e notificações devem ser verificadas nas dependências já instaladas antes de escolher ou adicionar outra. Não adicionar uma por preferência pessoal ou para antecipar funcionalidades.

O padrão de ícones do GUNP é `lucide-react`: imports individuais dos ícones utilizados, traço de espessura 2 e tamanho habitual de 20–24px. A marca provisória usa `Cog` acima de “GUNP”. Ícones decorativos usam `aria-hidden`; controles compostos somente por ícone devem ter nome acessível. Não adicionar outra biblioteca de ícones sem decisão aprovada.

A apresentação administrativa usa `/login` com formulário de matrícula e senha integrado ao NextAuth v4 e `/painel` com menu lateral, cartões de módulos, identificação e logout. O layout e cada página do painel verificam sessão e ADMIN ativo no servidor; a proteção não depende somente do layout reutilizado nas navegações. Os destinos dos módulos são páginas provisórias, sem consultas de negócio ou cadastros. A configuração de navegação e os componentes ficam na Presentation do módulo de acesso. O menu mobile usa um dialog nativo, sem nova biblioteca de UI. O fundo industrial do login é um asset local gerado, sem credenciais nem textos embutidos. No mobile, sua coluna institucional fica oculta. Essas telas não definem o mecanismo de acesso da ilha.

## 4. TypeScript

**Obrigatório:** TypeScript é usado no frontend e no servidor.

Papel no projeto:

- tipar contratos de entrada e saída da API;
- modelar dados e resultados de use cases;
- tornar explícitos estados, unidades e casos de erro;
- apoiar refatoração segura entre módulos.

Não usar tipos frouxos para contornar modelagem pendente. Quando o contrato ainda não estiver definido, registrar a lacuna na task; não substituir a decisão por `any` generalizado.

A configuração TypeScript existente é a referência. O projeto deve executar a verificação de tipos disponível como parte da qualidade antes da entrega; não relaxar configurações para contornar erros de modelagem.

## 5. API REST interna

**Obrigatório:** a interface React se comunica com o servidor por uma API REST interna do Next.js.

Papel no projeto:

- receber comandos de apontamento e manutenção de dados;
- expor consultas para painel, indicadores e cadastros;
- aplicar autenticação, autorização, validação de entrada e contratos HTTP;
- encaminhar a intenção ao use case correto.

A API não é substituída por acesso direto ao banco no navegador, mesmo estando no mesmo projeto. O contrato de cada endpoint deve nascer na especificação da task, incluindo entrada, saída, erros e teste esperado.

Formato global de resposta, schema de erro, paginação, versionamento e ferramenta de documentação da API são **A definir**.

## 6. Prisma 8.0

**Obrigatório:** Prisma é a camada de acesso ao banco e de migrações no projeto.

Papel no projeto:

- definir e evoluir o esquema compatível com PostgreSQL;
- executar migrações reprodutíveis;
- implementar repositories/adapters de Infrastructure;
- participar de transações necessárias para comandos atômicos;
- viabilizar carga inicial fictícia e recriação do banco a partir dos arquivos do projeto.

Prisma deve ficar encapsulado na Infrastructure. Route Handlers, use cases, funções puras de cálculo e componentes React não chamam o cliente Prisma diretamente.

Estratégia de seed, convenções exatas de schema e forma de executar migrações em cada ambiente são **A definir**; a capacidade de recriar o banco por arquivos do projeto é obrigatória.

## 7. PostgreSQL

**Obrigatório:** PostgreSQL é o banco relacional do GUNP.

Papel no projeto:

- persistir cadastros, fichas, operações, execuções, eventos de tempo, baixas, cenários e dados necessários aos indicadores conforme escopo aprovado;
- garantir integridade com chaves, referências, obrigatoriedade e unicidade;
- sustentar transações, idempotência e concorrência em comandos críticos;
- permitir backup, restauração e demonstração com dados fictícios.

O banco deve reforçar invariantes que consegue expressar, como unicidade e relacionamentos. Não depender apenas de bloqueios da interface para evitar duplicação ou execução concorrente.

O banco de desenvolvimento atual está hospedado no Neon. A aplicação utiliza `DATABASE_URL` para a conexão, conforme a configuração atual do Prisma. Não registrar valores reais de conexão no repositório. Backup, política de retenção e configuração dos demais ambientes continuam **A definir**. Antes de mudar o provedor ou a estratégia de conexão, inspecionar `prisma.config.ts`, os arquivos Prisma e o `.env.example` (se existente).

## 8. Autenticação e autorização

**Obrigatório:** a aplicação deve ter autenticação administrativa e autorização aplicadas no servidor. O MVP usa Auth.js com Credentials Provider, matrícula e senha, sessões JWT com duração de 12 horas e Argon2id para hash e verificação de senhas.

Modelo de acesso acordado:

- `Usuario` representa uma conta individual com acesso administrativo;
- `Operador` é uma entidade de produção separada e não equivale a uma conta de login;
- a ilha é um terminal compartilhado/controlado, com permissões limitadas às ações operacionais aprovadas;
- QR Code ou código funcional identifica o operador para apontamentos, mas não autentica um usuário nem concede privilégios administrativos;
- a autorização deve ser verificada no servidor, não apenas pela visibilidade dos elementos da interface;
- limpar a identificação temporária na interface por inatividade não deve pausar nem finalizar uma execução.

O modelo de `Usuario`, o papel único `ADMIN`, a estratégia de sessão e a biblioteca de autenticação estão definidos para o MVP administrativo. As rotas administrativas devem consultar o usuário no banco a cada requisição para confirmar que permanece ativo e `ADMIN`. A modelagem e o acesso do terminal/ilha, os papéis adicionais e permissões granulares continuam pendentes. Não implementar criptografia própria de senha nem autenticação customizada sem decisão explícita.

## 9. Testes automatizados

**Obrigatório:** cada funcionalidade relevante deve ter testes proporcionais ao risco, especialmente para regras matemáticas, transições de execução, persistência, autorização, idempotência e concorrência.

Testes mínimos esperados conforme a task:

- funções puras de cálculo com exemplos calculados manualmente;
- rejeição de valores inválidos e violações das regras de domínio definidas no modelo conceitual atual;
- transições de `EM_EXECUCAO`, `PAUSADA` e `FINALIZADA`;
- repetição de comando sem duplicar evento, execução ou produção;
- duas solicitações concorrentes sem abrir duas execuções para o mesmo operador;
- autorização da API para ações sensíveis;
- migrações, restrições e importação sem duplicação quando aplicável.

Frameworks e comandos de teste devem ser verificados no repositório antes de serem classificados como pendentes. Se ainda não houver ferramenta instalada/configurada, a escolha é **A definir**; não adicionar Jest, Vitest, Playwright, Cypress ou outro framework sem decisão registrada.

Os testes atuais usam `node:test` e são executados com `npm test`. Os testes HTTP do acesso são opt-in: com a aplicação local rodando, definir `GUNP_HTTP_TEST_URL=http://localhost:3000` e executar `npm test`. No PowerShell: `$env:GUNP_HTTP_TEST_URL='http://localhost:3000'; npm test`. Sem essa variável, os testes HTTP são ignorados e não exigem servidor nem conexão ao banco.

O teste de login correto pode reutilizar `INITIAL_ADMIN_MATRICULA` e `INITIAL_ADMIN_SENHA` do ambiente local, sem imprimir seus valores. Se não estiverem disponíveis ou já não corresponderem à conta ativa, esse cenário é ignorado. O cenário de conta inativa exige uma conta já inativa, e os testes não criam nem alteram usuários para prepará-lo. A validação visual e de interação por teclado deve ser feita em navegador nos tamanhos 375px, 768px e 1440px.

## 10. Ferramentas de qualidade e entrega

**Obrigatório:** antes de concluir uma task, executar as verificações disponíveis para tipo, testes e qualidade afetada pela alteração; registrar falhas que não pertençam à task.

As ferramentas já configuradas no repositório devem ser preservadas e usadas. Ferramentas adicionais de lint, formatação, hooks de Git, CI/CD, cobertura, scanner de segurança e deploy só podem ser consideradas **A definir** após inspeção do projeto; não introduzir ESLint adicional, Prettier, Husky, Sonar, GitHub Actions ou plataforma de deploy sem justificativa e aprovação.

**Convenção obrigatória de equipe:** cada entrega deve ser executável, ter evidência de teste ou tela demonstrável, manter dados de desenvolvimento fictícios e documentar os comandos necessários para instalar, executar, migrar e testar quando forem definidos.

## 11. Importação CSV e leitor USB

Esses elementos fazem parte do escopo de produto, não de uma nova stack independente.

### Importação CSV

**Obrigatório quando a funcionalidade for implementada:** importar CSV com colunas fixas, prévia, erros por linha e proteção contra duplicação por código.

Biblioteca de parsing, tamanho máximo, codificação, regras de normalização e formato final do arquivo são **A definir**. Não escolher biblioteca apenas para adiantar a funcionalidade.

### Leitor USB

**Condicional:** o apontamento por leitor é incluído apenas conforme equipamento, autorização e prioridade do projeto. Quando usado, o leitor 2D USB opera como teclado (USB HID/keyboard wedge) e envia identificadores ao campo em foco no navegador.

Não há decisão para SDK, driver, câmera ou integração de hardware específica. Não adicionar câmeras, sensores ou reconhecimento de pessoas. A digitação manual permanece como contingência.

## 12. Relação com os demais documentos

Este arquivo define decisões e restrições tecnológicas, não substitui as regras de domínio nem a arquitetura. Para cada task, usar em conjunto:

- `CONTEXTO_DO_PROJETO.md` para contexto e estado atual;
- `MODELO_CONCEITUAL_GUNP_atualizado.md` para entidades e regras de negócio;
- `ARCHITECTURE.md` para fronteiras, camadas e direção das dependências;
- `ROADMAP_GUNP.md` para sequência e estado das tarefas.

Em caso de conflito tecnológico, não inventar uma solução silenciosamente: apontar a inconsistência e pedir validação.

## 13. Restrições de adoção tecnológica para IA

Ao executar uma task, a IA deve:

1. inspecionar `package.json`, o lockfile e as configurações relevantes antes de afirmar que uma ferramenta ou versão não existe;
2. usar apenas tecnologias classificadas como obrigatórias ou já presentes no projeto;
3. manter código de acesso ao banco no Prisma/Infrastructure;
4. manter segredos e dados reais fora do repositório;
5. marcar como **A definir** qualquer escolha não decidida;
6. propor, sem implementar, uma nova dependência quando ela for necessária para cumprir um requisito;
7. atualizar a documentação quando uma decisão tecnológica for aprovada.

A IA não deve introduzir automaticamente bibliotecas de estado, UI, validação, autenticação, cache, fila, observabilidade, testes, lint, formatação, CI ou infraestrutura. A ausência de uma tecnologia nesta lista não é autorização para escolhê-la.
