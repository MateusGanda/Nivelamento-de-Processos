# GUNP - Tecnologia para SDD

## 1. Objetivo e status das decisões

Este documento define a stack conhecida do GUNP e o papel de cada tecnologia. Ele deve ser lido junto com `ARCHITECTURE.md` antes de implementar uma task SDD.

Classificação usada:

- **Obrigatório**: tecnologia ou prática decidida para o projeto.
- **A definir**: ainda não existe decisão. Não escolher uma biblioteca, serviço ou padrão por conta própria.
- **Não introduzir sem justificativa**: só pode entrar com requisito claro, impacto avaliado e decisão registrada.

| Área | Status | Decisão atual |
| --- | --- | --- |
| Framework web e servidor | Obrigatório | Next.js 16 (App Router) |
| Interface | Obrigatório | React 19 |
| Estilos | Padrão adotado | Tailwind CSS 4 |
| Ícones | Padrão adotado | Lucide React (`lucide-react`), com imports individuais |
| Linguagem | Obrigatório | TypeScript |
| Comunicação UI-servidor | Obrigatório | API REST interna |
| Persistência | Obrigatório | Prisma 8 e PostgreSQL (Neon no ambiente atual) |
| Autenticação administrativa | Obrigatório como capacidade | Auth.js (Credentials Provider), JWT de 12 horas e Argon2id |
| Acesso da ilha | Obrigatório como capacidade | Chave da ilha (`ILHA_CHAVE`) e cookie HttpOnly assinado com HMAC-SHA256 |
| Testes automatizados | Obrigatório | `node:test`, executado com `npm test` |
| Qualidade estática | Necessária | ESLint 9 com `eslint-config-next` (`npm run lint`) e `npm run typecheck` |
| Verificação automática | Padrão adotado | GitHub Actions (`.github/workflows/verificacao.yml`): instalação, lint, tipos, testes e build em Node 22 |
| Hospedagem | Ambiente atual | Vercel, publicando a branch `develop` |

As versões efetivamente instaladas devem ser verificadas no `package.json` e no lockfile antes de serem alteradas. Em 26/10/2026 o projeto usa `@prisma/orm-postgres` 8.0.0-rc.14 e a CLI `prisma` 8.0.0-rc.20. O `package-lock.json` deve manter a CLI rc.20: uma versão anterior da CLI falha no `db migrate` com o contrato atual (corrigido no pull request 49). Não inferir versões de outras dependências sem inspecionar os arquivos do repositório.

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

A apresentação administrativa usa `/login` com formulário de matrícula e senha integrado ao NextAuth v4 e `/painel` com menu lateral, cartões de módulos, identificação e logout. O layout e cada página do painel verificam sessão e ADMIN ativo no servidor; a proteção não depende somente do layout reutilizado nas navegações. Operadores tem tela funcional em `/painel/operadores` e API REST em `/api/operadores` (GET/POST) e `/api/operadores/[id]` (PATCH), dentro de `modules/operators`, com matrícula automática permanente, setor principal e função opcional. Setores tem criação/listagem em `/painel/setores` e GET/POST `/api/setores`, dentro de `modules/sectors`, com código funcional automático e permanente. O contrato dos dois cadastros está em `specs/contratos/operadores-setores.md`; aplicar as migrations antes de usar a nova versão com o banco. Operações tem listagem, criação e edição em `/painel/operacoes`, GET/POST `/api/operacoes` e PATCH `/api/operacoes/[id]`, dentro de `modules/operations`, com nome único e descrição opcional. Esses módulos mantêm Prisma somente na Infrastructure. A configuração de navegação e os componentes do painel ficam na Presentation do módulo de acesso. Menus e formulários de criação e edição usam dialog nativo, sem nova biblioteca de UI. O fundo industrial do login é um asset local gerado, sem credenciais nem textos embutidos. No mobile, sua coluna institucional fica oculta.

Telas e rotas do painel em 26/10/2026, todas com sessão de ADMIN ativo:

| Tela | API | Módulo |
| --- | --- | --- |
| `/painel/produtos` | `/api/produtos`, `/api/produtos/[id]`, `/api/produtos/[id]/status` | `modules/products` |
| `/painel/operacoes` | `/api/operacoes`, `/api/operacoes/[id]`, `/api/operacoes/[id]/status` | `modules/operations` |
| `/painel/motivos-de-pausa` | `/api/motivos-de-pausa`, `/api/motivos-de-pausa/[id]`, `/api/motivos-de-pausa/[id]/status` | `modules/pause-reasons` |
| `/painel/setores` | `/api/setores`, `/api/setores/[id]`, `/api/setores/[id]/status` | `modules/sectors` |
| `/painel/postos` | `/api/postos`, `/api/postos/[id]`, `/api/postos/[id]/status` | `modules/workstations` |
| `/painel/operadores` | `/api/operadores`, `/api/operadores/[id]`, `/api/operadores/[id]/status` | `modules/operators` |
| `/painel/roteiros` e `/painel/roteiros/[id]` | `/api/roteiros` e sub-rotas de status, etapas, postos da etapa, versões, produtos, vigente e tempos | `modules/routings` |
| `/painel/planos-de-producao` | `/api/planos-de-producao`, `/api/planos-de-producao/[id]` | `modules/production-plans` |
| `/painel/ordens-de-producao` | `/api/ordens-de-producao`, `/api/ordens-de-producao/[id]` | `modules/production-orders` |
| `/painel/indicadores` | `/api/indicadores` | `modules/indicators` |

A edição usa `PATCH /api/<cadastro>/[id]` e a mudança de status usa `PATCH /api/<cadastro>/[id]/status`, com o corpo `{ "ativo": true | false }`. Execução continua como destino provisório em `/painel/[modulo]`. Os gráficos da tela de indicadores são feitos com HTML e CSS, sem biblioteca de gráficos; as cores foram validadas para daltonismo e contraste contra o fundo dos cartões, e cada gráfico tem uma tabela equivalente.

A ilha de apontamento fica em `/ilha`, fora do painel, com as rotas `/api/ilha/acesso`, `/api/ilha/operadores/[matricula]`, `/api/ilha/ordens`, `/api/ilha/motivos`, `/api/ilha/execucoes` e `/api/ilha/execucoes/[id]/{pausa,retomada,troca,baixa}`, dentro de `modules/executions`. A tela tem botões e textos grandes para uso no chão de fábrica, mantém o foco no campo de matrícula para o leitor USB e mostra os tempos com as funções de `modules/indicators/domain/tempos.ts`, sem duplicar o cálculo.

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

Padrão usado pelas rotas existentes: erros no formato `{ "erro": { "codigo", "mensagem" } }`, com `400` (`ENTRADA_INVALIDA`), `401` (`NAO_AUTENTICADO`), `403`, `404` (`NAO_ENCONTRADO`), `409` (`CONFLITO`), `500` (`ERRO_INTERNO`) e, na ilha sem chave configurada, `503` (`NAO_CONFIGURADO`). Corpos com campos não previstos são recusados. Paginação, versionamento e ferramenta de documentação da API são **A definir**.

## 6. Prisma 8.0

**Obrigatório:** Prisma é a camada de acesso ao banco e de migrações no projeto.

Papel no projeto:

- definir e evoluir o esquema compatível com PostgreSQL;
- executar migrações reprodutíveis;
- implementar repositories/adapters de Infrastructure;
- participar de transações necessárias para comandos atômicos;
- viabilizar carga inicial fictícia e recriação do banco a partir dos arquivos do projeto.

Prisma deve ficar encapsulado na Infrastructure. Route Handlers, use cases, funções puras de cálculo e componentes React não chamam o cliente Prisma diretamente.

A capacidade de recriar o banco por arquivos do projeto é obrigatória. Práticas adotadas até 26/10/2026:

- **Migrations:** editar `src/prisma/contract.prisma`, emitir o contrato (`npm run contract:emit`) e planejar a migration a partir da anterior. Uma migration por vez, avisada à equipe. Depois do merge na `develop`, a migration é aplicada no banco do site com `npx prisma db migrate`; o banco de desenvolvimento da equipe recebe a mesma migration.
- **Seed:** `npm run seed:desenvolvimento` grava dados fictícios em uma única transação, no banco indicado por `SEED_DATABASE_URL`, e não grava nada se algum registro do cenário já existir. Nunca apontar para o banco do site.
- **Primeiro administrador:** `npm run bootstrap:admin`, com as variáveis `INITIAL_ADMIN_*` do `.env`.
- **Datas sem horário:** o tipo `Date` do Prisma 8 depende da API `Temporal`, ausente no Node 22. Por isso as datas do plano usam `DateString` (texto `AAAA-MM-DD`), sem mudar a coluna do banco.
- **Mudança de estado concorrente:** o `update` condicional do ORM lê e depois grava pelo `id`, sem garantir a condição. Para mudar o status de uma execução somente se ela ainda estiver no estado esperado, usar o SQL builder (`tx.sql.public.Execucao.update(...).where(...)`) e conferir `affectedRows`.
- **Índices únicos parciais:** o nome no banco recebe um sufixo; para reconhecer a violação, comparar pelo prefixo do nome.

## 7. PostgreSQL

**Obrigatório:** PostgreSQL é o banco relacional do GUNP.

Papel no projeto:

- persistir cadastros, fichas, operações, execuções, eventos de tempo, baixas, cenários e dados necessários aos indicadores conforme escopo aprovado;
- garantir integridade com chaves, referências, obrigatoriedade e unicidade;
- sustentar transações, idempotência e concorrência em comandos críticos;
- permitir backup, restauração e demonstração com dados fictícios.

O banco deve reforçar invariantes que consegue expressar, como unicidade e relacionamentos. Não depender apenas de bloqueios da interface para evitar duplicação ou execução concorrente.

Os bancos estão hospedados no Neon: o banco do site publicado, usado pela aplicação por `DATABASE_URL`, e uma branch de desenvolvimento da equipe, usada pelo seed por `SEED_DATABASE_URL`. Não registrar valores reais de conexão no repositório. Backup, política de retenção e configuração dos demais ambientes continuam **A definir**. Antes de mudar o provedor ou a estratégia de conexão, inspecionar `prisma.config.ts`, os arquivos Prisma e o `.env.example` (se existente).

## 8. Autenticação e autorização

**Obrigatório:** a aplicação deve ter autenticação administrativa e autorização aplicadas no servidor. O MVP usa Auth.js com Credentials Provider, matrícula e senha, sessões JWT com duração de 12 horas e Argon2id para hash e verificação de senhas.

Modelo de acesso acordado:

- `Usuario` representa uma conta individual com acesso administrativo;
- `Operador` é uma entidade de produção separada e não equivale a uma conta de login;
- a ilha é um terminal compartilhado/controlado, com permissões limitadas às ações operacionais aprovadas;
- QR Code ou código funcional identifica o operador para apontamentos, mas não autentica um usuário nem concede privilégios administrativos;
- a autorização deve ser verificada no servidor, não apenas pela visibilidade dos elementos da interface;
- limpar a identificação temporária na interface por inatividade não deve pausar nem finalizar uma execução.

O modelo de `Usuario`, o papel único `ADMIN`, a estratégia de sessão e a biblioteca de autenticação estão definidos para o MVP administrativo. As rotas administrativas devem consultar o usuário no banco a cada requisição para confirmar que permanece ativo e `ADMIN`. Papéis adicionais e permissões granulares continuam pendentes. Não implementar criptografia própria de senha nem autenticação customizada sem decisão explícita.

Acesso da ilha (decisão de 25/10/2026):

- a chave fica na variável `ILHA_CHAVE`, com pelo menos 16 caracteres; sem ela, ou com uma chave mais curta, a ilha fica desativada;
- `POST /api/ilha/acesso` confere a chave em tempo constante e, se estiver certa, grava o cookie `gunp_ilha`, HttpOnly, SameSite=Strict, Secure em produção, válido por 30 dias. O cookie guarda um HMAC-SHA256 derivado da chave, não a própria chave;
- chave errada recebe resposta atrasada; `DELETE /api/ilha/acesso` bloqueia o terminal; trocar a chave bloqueia todos os terminais;
- as rotas `/api/ilha/*` exigem o cookie e não aceitam a sessão administrativa como substituta;
- a chave é gerada e guardada fora do repositório e passada à equipe em particular, nunca em grupo.

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

Os testes usam `node:test` e ficam em `tests/`. Não adicionar Jest, Vitest, Playwright, Cypress ou outro framework sem decisão registrada. Em 26/10/2026 o `npm test` executa 205 testes: 198 passam e 7 são opcionais (dependem do sistema em funcionamento).

O teste opt-in de migrations dos cadastros usa PostgreSQL embarcado isolado via `GUNP_PGLITE_MODULE`, sem dependência adicional na aplicação e sem usar DATABASE_URL; instruções no contrato de Operadores e Setores.

Os testes atuais usam `node:test` e são executados com `npm test`. Os testes HTTP do acesso são opt-in: com a aplicação local rodando, definir `GUNP_HTTP_TEST_URL=http://localhost:3000` e executar `npm test`. No PowerShell: `$env:GUNP_HTTP_TEST_URL='http://localhost:3000'; npm test`. Sem essa variável, os testes HTTP são ignorados e não exigem servidor nem conexão ao banco.

O teste de login correto pode reutilizar `INITIAL_ADMIN_MATRICULA` e `INITIAL_ADMIN_SENHA` do ambiente local, sem imprimir seus valores. Se não estiverem disponíveis ou já não corresponderem à conta ativa, esse cenário é ignorado. O cenário de conta inativa exige uma conta já inativa, e os testes não criam nem alteram usuários para prepará-lo. A validação visual e de interação por teclado deve ser feita em navegador nos tamanhos 375px, 768px e 1440px.

## 10. Ferramentas de qualidade e entrega

**Obrigatório:** antes de concluir uma task, executar as verificações disponíveis para tipo, testes e qualidade afetada pela alteração; registrar falhas que não pertençam à task.

As ferramentas já configuradas no repositório devem ser preservadas e usadas: ESLint, verificação de tipos, `node:test`, a verificação do GitHub Actions em cada pull request e o deploy da `develop` na Vercel. Outras ferramentas de formatação, hooks de Git, cobertura, scanner de segurança ou deploy não devem ser introduzidas (por exemplo Prettier, Husky ou Sonar) sem justificativa e aprovação.

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
