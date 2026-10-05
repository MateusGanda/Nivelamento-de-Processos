# Sistema de produção — Fase 1

Projeto com Node.js, TypeScript e Prisma 7.0.0.
PostgreSQL 17 local pelo Docker e PostgreSQL online no Neon.

A migração da fase 1 e o seed foram aplicados ao Neon.
A consulta de status confirmou que não há migrações pendentes.
Esta configuração hospeda o banco; a aplicação é hospedada separadamente.

## Estrutura da fase 1

Modelos: Linha, Posto, Produto, Operacao, OperacaoProduto,
OrdemServico, Ficha e FichaEtapa.

O produto possui um roteiro ordenado de operações em postos.
A ordem de serviço referencia o produto, e cada ficha representa
uma unidade, com etapas e status de execução.
As etapas guardam uma cópia do nome da operação, código do posto
e tempo previsto no momento de sua criação.

## Pré-requisitos

- Node.js 24.
- Docker Desktop instalado e em execução.

Execute os comandos na pasta do projeto, um por vez.
Se algum apresentar erro, corrija antes de continuar.

## Configuração local em um novo computador

Instale as dependências registradas no package-lock.json:

```powershell
npm ci
```

Crie o arquivo local de configuração:

```powershell
Copy-Item .env.example .env
```

Execute a cópia somente se ainda não existir um .env.
Preencha sua senha no .env, tanto em POSTGRES_PASSWORD
quanto na DATABASE_URL.

A porta configurada é 55432. Se precisar alterá-la,
atualize POSTGRES_PORT e DATABASE_URL.

Selecione explicitamente o ambiente local neste terminal:

```powershell
$env:ENV_FILE = ".env"
```

Valide a configuração:

```powershell
docker compose config --quiet
```

Inicie o PostgreSQL. Na primeira execução com um volume vazio,
ele cria o banco e o usuário definidos no .env:

```powershell
docker compose up -d --wait
```

Aplique as migrações existentes:

```powershell
npx --no-install prisma migrate deploy
```

Gere o cliente Prisma:

```powershell
npx --no-install prisma generate
```

Insira os dados fictícios:

```powershell
npx --no-install prisma db seed
```

Confira as migrações:

```powershell
npx --no-install prisma migrate status
```

## Dados fictícios do seed

- Uma linha de produção.
- Três postos.
- Um produto.
- Três operações e três etapas de roteiro.
- Uma ordem com quantidade 1.
- Uma ficha com três etapas pendentes.

Executar o seed novamente não duplica seus registros
nem reinicia o status dos registros existentes.

## Recriar o banco local do zero

ATENÇÃO: este procedimento apaga todos os dados do PostgreSQL
deste projeto, incluindo registros adicionados manualmente.
Use somente no ambiente local de desenvolvimento.

Selecione o ambiente local antes de continuar, para que os comandos
do Prisma não apontem para o Neon:

```powershell
$env:ENV_FILE = ".env"
```

Remova os containers e o volume de dados deste projeto:

```powershell
docker compose down --volumes
```

Crie novamente o PostgreSQL e o banco vazio:

```powershell
docker compose up -d --wait
```

Recrie as tabelas pelas migrações:

```powershell
npx --no-install prisma migrate deploy
```

Gere o cliente:

```powershell
npx --no-install prisma generate
```

Reinsira os dados fictícios:

```powershell
npx --no-install prisma db seed
```

Confira o resultado:

```powershell
npx --no-install prisma migrate status
```

Não apague a pasta prisma/migrations: ela contém o histórico
necessário para reconstruir as tabelas.

## Banco online no Neon

O projeto está vinculado à branch `production` no Neon.
O banco online funciona independentemente do Docker local.

Instale as dependências com `npm ci` caso esteja em um novo computador.
Crie `.env.neon` na raiz do projeto com apenas a conexão direta
copiada do painel do Neon (sem `-pooler` no hostname):

```dotenv
DATABASE_URL="COLE_AQUI_A_URL_COMPLETA_DO_NEON"
```

Preserve os parâmetros de conexão fornecidos pelo Neon.
Não publique a URL: ela inclui usuário e senha.

`prisma.config.ts` e `prisma/seed.ts` carregam o arquivo indicado
pela variável `ENV_FILE`. Sem essa variável, usam `.env`.
Ela vale para o terminal atual; selecione o ambiente novamente
quando abrir outro terminal.

### Aplicar a fase 1 a um banco vazio no Neon

O comando de migração abaixo cria as tabelas no banco selecionado.
O seed insere os dados fictícios; não copia dados do banco local.
Execute um comando por vez e pare se houver erro.

```powershell
$env:ENV_FILE = ".env.neon"
npx --no-install prisma migrate deploy
npx --no-install prisma generate
npx --no-install prisma db seed
npx --no-install prisma migrate status
```

Resultado esperado do status: `Database schema is up to date!`.
Não use o procedimento de apagar volumes locais para recriar o Neon.
Para preparar outro banco online vazio, configure sua URL no
`.env.neon` e aplique as migrações e o seed acima.

### Configuração do Neon CLI

O login, o vínculo do projeto e a configuração já foram realizados.
O arquivo `neon.ts` contém:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

Para consultar e aplicar essa configuração no projeto vinculado:

```powershell
neon config plan
neon deploy --no-env-pull
```

`--no-env-pull` preserva o `.env` local. Esses comandos configuram
os serviços do Neon; as tabelas são criadas por `prisma migrate deploy`.
Execute sempre na raiz do projeto.

## Visualizar os registros com Prisma Studio

Selecione o banco desejado e abra o Studio:

```powershell
$env:ENV_FILE = ".env.neon"
npx --no-install prisma studio
```

Para consultar o banco local, use `$env:ENV_FILE = ".env"` e
inicie o Docker antes de abrir o Studio.
Abra o endereço mostrado no terminal; encerre com `Ctrl + C`.
Alterações feitas no Studio afetam o banco selecionado.

Após o seed em um banco vazio, os registros esperados são:

| Tabela          | Quantidade |
| --------------- | ---------: |
| Linha           |          1 |
| Posto           |          3 |
| Produto         |          1 |
| Operacao        |          3 |
| OperacaoProduto |          3 |
| OrdemServico    |          1 |
| Ficha           |          1 |
| FichaEtapa      |          3 |

A ficha `DEMO-FICHA-001` possui Corte (120 segundos), Montagem
(180 segundos) e Inspeção (60 segundos), inicialmente pendentes.

## Comandos de uso diário

Iniciar o banco:

```powershell
docker compose up -d --wait
```

Consultar o estado do container:

```powershell
docker compose ps
```

Parar o container preservando os dados:

```powershell
docker compose stop
```

## Credenciais e repositório

O `.env` guarda as credenciais locais e o `.env.neon` guarda
as credenciais online. Ambos devem permanecer fora do Git.
O `.env.example` contém somente exemplos sem senhas reais.

Regras necessárias no `.gitignore`:

```gitignore
node_modules/
dist/
generated/
.env
.env.*
!.env.example
*.log
```

Se o projeto já usa Git, confira:

```powershell
git check-ignore .env .env.neon
git ls-files -- .env .env.neon
```

O primeiro deve listar os dois arquivos; o segundo não deve listar nenhum.
Se já estavam versionados, o `.gitignore` não os remove do histórico:
remova-os do rastreamento e troque as credenciais expostas.

Mantenha no repositório:

- .gitignore
- .env.example
- compose.yaml
- package.json
- package-lock.json
- prisma.config.ts
- prisma/schema.prisma
- prisma/seed.ts
- prisma/migrations/
- neon.ts
- README.md

As credenciais de inicialização do PostgreSQL são aplicadas
quando o volume está vazio. Alterar a senha no .env depois
não altera automaticamente a senha do usuário já criado.

## Observações de manutenção

Use `npx --no-install` para executar o Prisma instalado no projeto.
Se o comando não encontrar o pacote, confira a pasta atual e execute
`npm ci`; não instale outra versão do Prisma por engano.

O npm informou 14 vulnerabilidades durante a instalação.
A análise e a correção dessas dependências ainda estão pendentes.
Use `npm audit` para examinar o relatório antes de atualizar pacotes;
evite `npm audit fix --force` sem avaliar mudanças incompatíveis.

## Criar, alterar e apagar tabelas com Prisma

No projeto, a estrutura das tabelas é definida no arquivo
`prisma/schema.prisma`. Cada bloco `model` representa um modelo
que o Prisma mapeia para uma tabela. Caso exista `@@map`, o nome
da tabela no PostgreSQL pode ser diferente do nome do modelo.

Para mudar essa estrutura, edite o schema e crie uma **migração**.
A migração é um arquivo SQL que registra a mudança e permite
aplicá-la nos bancos local e online.

O fluxo de trabalho é:

1. Selecionar o banco local.
2. Alterar e salvar `prisma/schema.prisma`.
3. Validar o schema e gerar a migração.
4. Conferir o resultado no banco local.
5. Aplicar as migrações revisadas ao Neon quando estiverem prontas.

### Estrutura da tabela e registros são coisas diferentes

| Ação                  | Exemplo                                | Como fazer                           |
| --------------------- | -------------------------------------- | ------------------------------------ |
| Criar uma tabela      | Criar uma tabela de teste              | Adicionar um modelo e gerar migração |
| Alterar a estrutura   | Adicionar uma coluna de descrição      | Editar o modelo e gerar migração     |
| Apagar uma tabela     | Remover a tabela de teste inteira      | Remover o modelo e gerar migração    |
| Criar um registro     | Cadastrar uma nova linha de produção   | Prisma Client, API ou Prisma Studio  |
| Atualizar um registro | Alterar o nome de uma linha cadastrada | Prisma Client, API ou Prisma Studio  |
| Apagar um registro    | Excluir um cadastro específico         | Prisma Client, API ou Prisma Studio  |

Editar os registros não exige uma nova migração.

### 1. Preparar o banco local

Abra a pasta do projeto no VS Code e use o terminal PowerShell.
Execute os comandos um por vez:

```powershell
$env:ENV_FILE = ".env"
docker compose up -d --wait
npx --no-install prisma migrate status
```

A variável `ENV_FILE` seleciona o arquivo de configuração carregado
pelo projeto. Neste caso, o Prisma usa o PostgreSQL local do Docker.

Se houver migrações pendentes da equipe, aplique-as antes de começar:

```powershell
npx --no-install prisma migrate deploy
```

Se um comando apresentar erro, resolva o problema antes de continuar.

### 2. Criar uma tabela

Para praticar, crie uma tabela independente dos cadastros do sistema.
Abra `prisma/schema.prisma` e adicione o bloco abaixo ao final.
Preserve os modelos, o datasource e o generator já existentes.

```prisma
model TabelaTeste {
  id   Int    @id @default(autoincrement())
  nome String
}
```

| Definição                   | Significado                          |
| --------------------------- | ------------------------------------ |
| `model TabelaTeste`         | Define o modelo da nova tabela       |
| `Int`                       | Número inteiro                       |
| `String`                    | Texto                                |
| `@id`                       | Define a chave primária              |
| `@default(autoincrement())` | Gera o identificador automaticamente |

Salve o arquivo e execute:

```powershell
npx --no-install prisma validate
npx --no-install prisma migrate dev --name criar_tabela_teste
npx --no-install prisma generate
```

- `validate`: verifica se o schema é válido.
- `migrate dev`: gera a migração e a aplica ao banco de desenvolvimento.
- `generate`: atualiza o Prisma Client usado pelo código da aplicação.

O nome depois de `--name` descreve a alteração.
O Prisma cria uma pasta com data e nome dentro de `prisma/migrations/`,
contendo o arquivo `migration.sql`.

No Prisma 7, `migrate dev` não executa `generate` nem o seed
automaticamente. Execute `generate` após mudar os modelos.
O seed só precisa ser executado quando você quiser inserir os dados
fictícios previstos no projeto.

### 3. Alterar a estrutura de uma tabela

Para adicionar uma descrição e um indicador de registro ativo,
substitua apenas o bloco da tabela de teste por:

```prisma
model TabelaTeste {
  id        Int     @id @default(autoincrement())
  nome      String
  descricao String?
  ativo     Boolean @default(true)
}
```

- `descricao String?`: texto opcional; o campo pode ficar sem valor.
- `ativo Boolean`: armazena verdadeiro ou falso.
- `@default(true)`: define verdadeiro como valor padrão.

Salve e execute:

```powershell
npx --no-install prisma validate
npx --no-install prisma migrate dev --name atualizar_tabela_teste
npx --no-install prisma generate
```

Isso adiciona colunas à tabela. Para trocar o nome de um registro,
use o Studio ou o código da aplicação, sem alterar o schema.

**Cuidados ao alterar campos:**

- Um novo campo obrigatório em uma tabela com dados precisa de
  uma estratégia para preencher os registros existentes.
  Dependendo do caso, use um valor padrão ou adicione o campo como
  opcional, preencha os dados e só depois torne-o obrigatório.
- Remover uma coluna também remove os valores armazenados nela.
- Alterar tipos pode falhar se os valores existentes não forem compatíveis.
- Renomear um campo pode gerar exclusão da coluna antiga e criação
  de outra. Revise o SQL antes de aplicar uma mudança desse tipo.
  Para preservar os dados, pode ser necessário personalizar a
  migração ainda não aplicada, usando uma operação de renomeação.

### 4. Apagar uma tabela

**A exclusão de uma tabela apaga todos os registros dela.**
Use somente a tabela de teste neste exercício.

Remova o bloco inteiro `model TabelaTeste` do schema e salve.
Depois, gere a migração para revisão:

```powershell
npx --no-install prisma validate
npx --no-install prisma migrate dev --name apagar_tabela_teste --create-only
```

Abra o novo `migration.sql` em `prisma/migrations/`.
Confira se a exclusão se refere somente à tabela pretendida.

`--create-only` gera a migração sem aplicá-la. Se houver divergência
entre o banco e o histórico de migrações, o Prisma ainda pode pedir
um reset. Não confirme um reset sem entender o motivo: ele apaga dados.

Após conferir o SQL, aplique a migração local:

```powershell
npx --no-install prisma migrate dev
npx --no-install prisma generate
```

Para apagar uma tabela real que tenha relações, também é necessário
ajustar os campos de relação nos outros modelos e avaliar as chaves
estrangeiras e os dados dependentes.

**Não apague pastas de migrações antigas para excluir uma tabela.**
Crie uma nova migração que registre a exclusão. Preserve também a
tabela `_prisma_migrations`, que controla o histórico aplicado.

### 5. Conferir o resultado local

Para visualizar as tabelas e os registros:

```powershell
$env:ENV_FILE = ".env"
npx --no-install prisma studio
```

Abra o endereço exibido no terminal. Para encerrar, pressione
`Ctrl + C`.

Você pode inserir um registro na tabela de teste, editar seu nome
e excluir esse registro para entender a diferença entre alterações
nos dados e alterações na estrutura.

### 6. Aplicar uma alteração ao Neon

Depois de testar e revisar as migrações localmente, aplique-as ao
banco online quando a mudança estiver pronta para ser publicada.

Antes de uma alteração destrutiva, garanta uma cópia recuperável
dos dados que precisarão ser preservados.

Execute:

```powershell
$env:ENV_FILE = ".env.neon"
npx --no-install prisma migrate deploy
npx --no-install prisma generate
npx --no-install prisma migrate status
```

Resultado esperado do status:

```text
Database schema is up to date!
```

**Atenção:** `migrate deploy` aplica todas as migrações pendentes,
incluindo exclusões de tabelas e colunas. Se você fizer os três
exercícios locais antes de aplicar ao Neon, a tabela de teste
será criada, alterada e depois apagada também no banco online.

`migrate deploy` aplica os arquivos de migração existentes;
ele não cria uma migração a partir de mudanças no schema.
Por isso, editar apenas `schema.prisma` não basta para atualizar o Neon.

Use `migrate dev` no banco local de desenvolvimento e
`migrate deploy` na branch `production` do Neon.
Em uma publicação automatizada, inclua o deploy das migrações
no processo de entrega da aplicação.

Ao terminar e voltar ao desenvolvimento local, selecione novamente:

```powershell
$env:ENV_FILE = ".env"
```

### 7. Editar os registros no Neon

Para cadastrar, atualizar ou apagar registros no banco online:

```powershell
$env:ENV_FILE = ".env.neon"
npx --no-install prisma studio
```

No Studio, escolha a tabela e use os controles para adicionar,
editar ou excluir registros, salvando as alterações conforme
a interface indicar.

As alterações afetam diretamente o banco selecionado.
Uma exclusão pode ser bloqueada por relacionamentos ou afetar
registros dependentes, conforme as regras das chaves estrangeiras.

### Resumo dos comandos

| Objetivo                                 | Comando                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Validar o schema                         | `npx --no-install prisma validate`                                           |
| Criar e aplicar uma migração local       | `npx --no-install prisma migrate dev --name nome_da_alteracao`               |
| Gerar uma migração para revisar          | `npx --no-install prisma migrate dev --name nome_da_alteracao --create-only` |
| Aplicar migrações existentes             | `npx --no-install prisma migrate deploy`                                     |
| Atualizar o Prisma Client                | `npx --no-install prisma generate`                                           |
| Conferir migrações aplicadas e pendentes | `npx --no-install prisma migrate status`                                     |
| Abrir o editor visual de registros       | `npx --no-install prisma studio`                                             |

DATABASE_URL="postgresql://neondb_owner:npg_tas7qzgYyC6I@ep-old-lake-b4xwfo15.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

### Referências

- [Prisma 7: migrate dev](https://docs.prisma.io/docs/cli/v7/migrate/dev)
- [Prisma 7: migrações em desenvolvimento e produção](https://docs.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production)
