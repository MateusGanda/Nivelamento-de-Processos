# GUNP — Nivelamento de processos

Sistema web acadêmico com Next.js, React, TypeScript, API REST interna, Prisma 8 e PostgreSQL. A entrega atual inclui apresentação, login, menu e painel com consulta de produtos no banco.

## Executar localmente

```bash
npm ci
# Somente se ainda não existir .env:
cp .env.example .env
```

Configure `DATABASE_URL` no `.env` com a conexão do Neon ou com o PostgreSQL local. Preserve a conexão que já funciona. Para banco local, consulte [docs/database/README.md](docs/database/README.md).

```bash
npm run access:setup
npm run dev
```

O primeiro comando solicita o e-mail e gera uma senha de acesso. Guarde a senha exibida. O `.env` recebe o hash scrypt e o segredo da sessão; não envie esse arquivo ao Git. Abra http://localhost:3000, entre na sua conta e consulte o painel.

O acesso inicial usa uma conta configurada no servidor. O banco atual não possui contas de usuário; Operador continua sendo uma entidade da produção. Não foram criadas migrations nesta entrega.

## Guia da entrega

Veja [docs/TELA_INICIAL_E_LOGIN.md](docs/TELA_INICIAL_E_LOGIN.md) para aplicar o ZIP à branch `feat/tela-login`, entender o fluxo da API, testar a conexão e enviar o Pull Request para `develop`.

- `/` — apresentação e menu.
- `/login` — entrada no sistema.
- `/painel` — consulta autenticada e somente leitura dos produtos.
- `GET /api/produtos` — até 100 produtos ordenados por código; exige sessão.
- `POST /api/auth/login` e `POST /api/auth/logout` — entrada e saída.

O painel mostra carregamento, busca, tabela vazia e erro de conexão. Uma falha nunca é substituída por dados de exemplo.

## Verificações

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Para executar um build de produção: `npm start`. Em produção, use HTTPS para o cookie Secure.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Contexto para desenvolvimento](docs/AI_CONTEXT.md)
- [Banco de dados](docs/database/README.md)
- [Especificação da entrega](specs/tela-inicial-login.md)

Sempre comece tarefas novas a partir de `develop` atualizada. Esta entrega foi preparada para a branch `feat/tela-login` que Arthur já criou; não publica nem integra mudanças automaticamente.
