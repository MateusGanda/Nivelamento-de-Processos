# Tela inicial, login e primeira integração — feat/tela-login

## O que foi entregue

- `/`: apresentação do GUNP, menu, recursos e explicação do projeto.
- `/login`: formulário com e-mail/senha, botão mostrar senha e mensagens de erro.
- `/painel`: página protegida, menu, busca local por produtos, atualização e saída.
- `POST /api/auth/login`: valida as credenciais do acesso inicial e cria uma sessão de oito horas.
- `POST /api/auth/logout`: remove o cookie de sessão.
- `GET /api/produtos`: consulta autenticada de até 100 produtos, ordenados por código. Retorna somente `id`, `codigo` e `nome`.

Esta entrega não cria usuários no banco. O contrato atual não possui entidade de conta ou senha. Foi adotada uma conta inicial configurada no servidor para viabilizar o login solicitado, sem modificar Operador, migrations ou o contrato Prisma. Uma conta não representa um operador e não implementa perfis ou gestão de usuários.

## Instalar as alterações na sua branch

1. No terminal do repositório, execute `git branch --show-current`. Deve aparecer `feat/tela-login`.
2. Extraia o ZIP em uma pasta temporária. Copie o conteúdo da pasta `Nivelamento-de-Processos` para dentro do seu repositório, substituindo os arquivos correspondentes. Não crie outra pasta `Nivelamento-de-Processos` dentro dele.
3. O ZIP não contém `.git`, `.env` ou `node_modules`. Preserve o `.git` e o `.env` que já existem no seu repositório.
4. Execute `npm ci`.
5. Se ainda não tiver `.env`, execute `cp .env.example .env` no Git Bash. Se já existir, não sobrescreva.
6. Confirme no `.env` a `DATABASE_URL` do seu Neon. Use sua conexão existente; nunca publique a senha no Git.
7. Execute `npm run access:setup`. Informe o e-mail desejado. O comando gera uma senha aleatória, exibe-a uma vez e grava somente seu hash e um segredo de sessão no `.env`. Guarde a senha apresentada. A `DATABASE_URL` existente é preservada.
8. Execute `npm run dev` e acesse http://localhost:3000.
9. Clique em **Acessar minha conta**, entre com o e-mail e a senha gerada e consulte os produtos.

Se quiser gerar outra senha, execute novamente `npm run access:setup`; as sessões existentes serão invalidadas. Reinicie o servidor depois de qualquer alteração no `.env`. Não existe recuperação automática por e-mail nesta entrega.

## Entender o fluxo

A tela React chama `GET /api/produtos`. O handler verifica a sessão e chama a consulta da Infrastructure de `modules/catalog`. Essa consulta usa a conexão existente em `src/prisma/db.ts` e a API de contratos do Prisma 8 para ler `Produto` no PostgreSQL. O resultado volta em JSON e a interface apresenta a tabela.

Uma lista vazia com HTTP 200 significa que a consulta funcionou e não há produtos. HTTP 401 significa sessão ausente ou inválida. HTTP 503 significa configuração/conexão/tabelas indisponíveis. A interface nunca substitui uma falha por dados simulados. Buscar filtra somente os até 100 registros carregados; ainda não há paginação nem cadastro pela tela.

O formulário de login usa `POST /api/auth/login`. A senha é conferida com scrypt e comparação constante. O cookie de sessão é assinado, HttpOnly e SameSite=Lax, com Secure em produção. Painel e API verificam a assinatura e a validade da sessão. POSTs verificam a origem. O limite de tentativas é global por processo (10 por minuto); não é compartilhado entre várias instâncias. A conta inicial é destinada à demonstração da equipe; antes de abrir acesso a vários usuários, a equipe deve definir persistência de contas, permissões e gestão das sessões.

Para teste local use `npm run dev`. Em produção, o cookie Secure exige HTTPS.

## Conferir no seu ambiente

- Abra `/painel` sem login: deve voltar a `/login`.
- Abra `/api/produtos` sem login: deve retornar 401.
- Tente senha incorreta: deve aparecer erro e não abrir o painel.
- Faça login: deve abrir o painel e consultar o banco.
- Se a tabela Produto estiver vazia, deve aparecer o aviso de conexão bem-sucedida sem produtos.
- Se houver produtos, confira código, nome, busca e atualização.
- Clique em Sair; abra o painel novamente e confira o redirecionamento.
- Reduza a janela para conferir o menu e formulário no celular.

Verificações automáticas: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`. Os testes acrescentados cobrem senha incorreta, sessão expirada, assinatura adulterada e troca de segredo. A consulta ao Neon da equipe depende das credenciais do `.env` local; não foi possível executá-la com o ZIP enviado. A revisão visual em navegador também deve ser conferida localmente.

## Enviar para revisão

Depois de testar, revise `git status` e `git diff`. Adicione somente os arquivos desta entrega (não o `.env`):

```bash
git add app modules/access modules/catalog tests/unit/access scripts/configurar-acesso.mjs docs/TELA_INICIAL_E_LOGIN.md docs/ARCHITECTURE.md docs/AI_CONTEXT.md specs/tela-inicial-login.md README.md .env.example package.json
git commit -m "feat: adiciona apresentação, login e consulta de produtos"
git push -u origin feat/tela-login
```

Abra o Pull Request de `feat/tela-login` para `develop`. O envio da branch não faz merge automaticamente.
