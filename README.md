# GUNP — Gerenciamento de Nivelamento de Processos

Sistema web para registrar a produção e os tempos de cada etapa de uma linha de produção e apoiar o gestor no nivelamento dos processos. É o Trabalho de Conclusão de Curso de Ciência da Computação da UNIP, desenvolvido por Mateus Minoru Ganda, Arthur Álvaro Silva Garcia e Luis Gustavo Nunes dos Santos.

O sistema está em desenvolvimento. A versão da branch `develop` fica publicada em <https://nivelamento-de-processos.vercel.app>.

## Situação em 14/10/2026

Pronto:

- login com matrícula e senha, e API de usuários administrativos;
- painel administrativo com menu lateral;
- cadastro e consulta de operadores e de setores;
- banco de dados com 16 tabelas, criado por migrações;
- indicadores (tempos, produção, posição das ordens e carga pendente por etapa e por posto) na API `GET /api/indicadores`, com testes, ainda sem tela.

Em desenvolvimento: demais cadastros, roteiros, planos e ordens de produção, apontamento da produção (início, pausa, retomada, troca de operação e baixa), leitor USB e painel de indicadores. O acompanhamento das fases está em [`docs/plan/ROADMAP_GUNP.md`](docs/plan/ROADMAP_GUNP.md).

## Tecnologias

- Next.js 16 (App Router), React 19 e TypeScript
- Tailwind CSS 4
- PostgreSQL com Prisma 8
- NextAuth 4 (credenciais) e Argon2id para as senhas
- Testes com `node:test`

## Como rodar

Requisitos: Node.js 22 e acesso a um banco PostgreSQL.

```bash
git clone https://github.com/MateusGanda/Nivelamento-de-Processos.git
cd Nivelamento-de-Processos
npm ci
cp .env.example .env
```

Preencha o `.env` (veja a tabela abaixo) e inicie:

```bash
npm run dev
```

O sistema abre em <http://localhost:3000>.

### Variáveis de ambiente

O arquivo `.env` não vai para o Git. Nunca coloque senhas ou a string de conexão em commits, issues ou mensagens.

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | String de conexão do PostgreSQL. A do banco da equipe é passada em particular. |
| `NEXTAUTH_SECRET` | Segredo que assina as sessões. Gere um valor próprio para cada ambiente. |
| `INITIAL_ADMIN_NOME`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_MATRICULA`, `INITIAL_ADMIN_SENHA` | Usadas só pelo comando que cria o primeiro administrador. |
| `SEED_DATABASE_URL` | Banco de desenvolvimento que recebe os dados fictícios do seed. Nunca o banco do site. |

Para gerar um valor para o `NEXTAUTH_SECRET`:

```bash
node -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

### Primeiro administrador

Não existe cadastro público de usuário. O primeiro administrador é criado pelo comando abaixo, que só funciona enquanto não houver um administrador ativo no banco:

```bash
npm run bootstrap:admin
```

Depois disso, novos usuários são criados pela API, por um administrador conectado. Ainda não há tela para isso.

## Banco de dados

O modelo de dados está em [`src/prisma/contract.prisma`](src/prisma/contract.prisma) e as migrações em [`migrations/app`](migrations/app). O arquivo [`docs/sql/schema.sql`](docs/sql/schema.sql) reúne os mesmos comandos em um único script, para consulta ou para criar o banco manualmente em um PostgreSQL vazio.

```bash
npx prisma migration status   # mostra as migrações aplicadas
npx prisma db verify          # confere se o banco está igual ao modelo
npx prisma db migrate         # aplica as migrações pendentes
```

Os dois primeiros comandos só leem. Não aplique migrações nem altere o modelo no banco da equipe sem combinar antes.

### Dados fictícios para testes

O comando `npm run seed:desenvolvimento` grava uma fábrica fictícia (setores, postos, operações, operadores, motivos de pausa, produtos com roteiro, um plano, seis ordens e execuções com pausas e baixas) no banco indicado em `SEED_DATABASE_URL`. A equipe usa para isso a branch Indicators do Neon. O comando grava tudo numa transação, recusa rodar no mesmo banco de `DATABASE_URL` e não grava nada se algum registro do cenário já existir.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o sistema em modo de desenvolvimento. |
| `npm run build` | Compila para produção. |
| `npm run start` | Inicia a versão compilada. |
| `npm run lint` | Confere o padrão do código. |
| `npm run typecheck` | Confere os tipos do TypeScript. |
| `npm test` | Roda os testes automatizados. |
| `npm run bootstrap:admin` | Cria o primeiro administrador. |
| `npm run seed:desenvolvimento` | Grava dados fictícios no banco de `SEED_DATABASE_URL`. |

Os testes não usam o banco de dados. Os testes de login por HTTP são opcionais e só rodam com a aplicação local em execução e a variável `GUNP_HTTP_TEST_URL` definida, por exemplo `GUNP_HTTP_TEST_URL=http://localhost:3000`.

## Organização do projeto

```text
app/          páginas do sistema e rotas da API
modules/      código por módulo (access, operators, sectors, indicators),
              dividido em domain, application, infrastructure e presentation
shared/       validações usadas por mais de um módulo
src/prisma/   modelo de dados e conexão com o banco
migrations/   migrações que criam as tabelas
scripts/      comandos de apoio
tests/        testes automatizados
docs/         documentação do projeto e o TCC
specs/        contratos e pendências do modelo
```

As regras de cada camada estão em [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).

## Documentação

- [`docs/CONTEXTO_DO_PROJETO.md`](docs/CONTEXTO_DO_PROJETO.md): visão geral e decisões do projeto
- [`docs/domain/MODELO_CONCEITUAL_GUNP_atualizado.md`](docs/domain/MODELO_CONCEITUAL_GUNP_atualizado.md): entidades e regras de negócio
- [`docs/domain/diagrama-de-classes.drawio.png`](docs/domain/diagrama-de-classes.drawio.png): diagrama de classes
- [`docs/domain/diagrama-de-casos-de-uso.drawio.png`](docs/domain/diagrama-de-casos-de-uso.drawio.png): diagrama de casos de uso
- [`docs/technology/TECHNOLOGY.md`](docs/technology/TECHNOLOGY.md): tecnologias e padrões
- [`specs/contratos/indicadores.md`](specs/contratos/indicadores.md): contrato da consulta de indicadores
- [`docs/tcc`](docs/tcc): texto do TCC
- [`AGENTS.md`](AGENTS.md): regras para o uso de ferramentas de IA no projeto

## Como contribuir

1. Atualize a `develop` e crie a branch a partir dela, com o tipo no nome: `feat/...`, `fix/...`, `docs/...`.
2. Use Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`.
3. Só abra o pull request para a `develop` depois de testar na branch.
4. Todo pull request passa pela verificação automática (lint, tipos, testes e build). Faça o merge só com ela verde e depois de conferir os arquivos alterados.
5. Arquivos criados só para teste local não vão para o Git.
