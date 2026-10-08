# Banco de dados

Material de apoio da etapa de banco de dados (06/10/2026). O modelo oficial é o contrato do Prisma em `src/prisma/contract.prisma`; os arquivos desta pasta são gerados a partir dele.

| Arquivo | Conteúdo |
| --- | --- |
| `schema.sql` | Script SQL de criação do banco: 15 tabelas, chaves primárias, restrições de unicidade, índices e 18 chaves estrangeiras. |
| `diagrama-er.png` | Diagrama entidade-relacionamento em imagem. |

## Banco local com Docker

O arquivo `compose.yaml`, na raiz do projeto, sobe um PostgreSQL 17 igual para toda a equipe.

1. Copie `.env.example` para `.env` e troque a senha nos dois lugares em que ela aparece.
2. Suba o banco:

```bash
docker compose up -d
```

3. Confira se está pronto (a coluna STATUS deve mostrar `healthy`):

```bash
docker compose ps
```

O banco fica em `localhost:55432`. Os dados ficam guardados em um volume do Docker e continuam lá depois de parar o container. Para parar, use `docker compose down`; para apagar também os dados, `docker compose down -v`.

O banco sobe vazio. As tabelas são criadas pela migração do Prisma ou pelo script abaixo.

## Como criar o banco pelo script

Em um banco PostgreSQL vazio:

```bash
psql "$DATABASE_URL" -f docs/database/schema.sql
```

Sem o `psql` instalado, dá para rodar o script por dentro do container:

```bash
docker compose exec -T db psql -U gunp -d gunp < docs/database/schema.sql
```

O script reúne os mesmos comandos da migração `migrations/app/20261006T1821_init`, na mesma ordem. No dia a dia, o banco é criado pela migração do Prisma; o script serve para consulta e para criar o banco manualmente.

## Diagrama entidade-relacionamento

```mermaid
erDiagram

    PRODUTO {
        uuid id PK
        string codigo UK
        string nome
        datetime createdAt
        datetime updatedAt
    }

    OPERACAO {
        uuid id PK
        string nome UK
        string descricao
        datetime createdAt
        datetime updatedAt
    }

    ROTEIRO {
        uuid id PK
        string nome
        int versao
        boolean ativo
        datetime createdAt
        datetime updatedAt
    }

    ETAPA_ROTEIRO {
        uuid id PK
        uuid roteiroId FK
        uuid operacaoId FK
        int ordem
        datetime createdAt
        datetime updatedAt
    }

    PRODUTO_ROTEIRO {
        uuid id PK
        uuid produtoId FK
        uuid roteiroId FK
        boolean vigente
        datetime createdAt
        datetime updatedAt
    }

    PRODUTO_ETAPA {
        uuid id PK
        uuid produtoId FK
        uuid etapaRoteiroId FK
        decimal tempoPadrao
        datetime createdAt
        datetime updatedAt
    }

    PLANO_PRODUCAO {
        uuid id PK
        string codigo UK
        string descricao
        date dataInicio
        date dataFim
        datetime createdAt
        datetime updatedAt
    }

    ORDEM_PRODUCAO {
        uuid id PK
        string numero UK
        uuid planoProducaoId FK
        uuid produtoId FK
        uuid roteiroId FK
        decimal quantidade
        string unidade
        datetime createdAt
        datetime updatedAt
    }

    OPERADOR {
        uuid id PK
        string matricula UK
        string nome
        boolean ativo
        datetime createdAt
        datetime updatedAt
    }

    SETOR {
        uuid id PK
        string nome UK
        string descricao
        datetime createdAt
        datetime updatedAt
    }

    POSTO {
        uuid id PK
        uuid setorId FK
        string codigo UK
        string nome
        boolean ativo
        datetime createdAt
        datetime updatedAt
    }

    ETAPA_POSTO {
        uuid etapaRoteiroId PK, FK
        uuid postoId PK, FK
    }

    EXECUCAO {
        uuid id PK
        uuid ordemProducaoId FK
        uuid etapaRoteiroId FK
        uuid operadorId FK
        uuid postoId FK
        string status
        decimal quantidadeBoa
        decimal quantidadeRetrabalho
        decimal quantidadeRefugo
        datetime createdAt
        datetime updatedAt
    }

    EVENTO_TEMPO {
        uuid id PK
        uuid execucaoId FK
        string tipo
        uuid motivoPausaId FK
        datetime dataHora
        datetime createdAt
    }

    MOTIVO_PAUSA {
        uuid id PK
        string nome UK
        string descricao
        boolean ativo
    }


    PRODUTO ||--o{ PRODUTO_ROTEIRO : utiliza
    ROTEIRO ||--o{ PRODUTO_ROTEIRO : associado

    ROTEIRO ||--|{ ETAPA_ROTEIRO : possui
    OPERACAO ||--o{ ETAPA_ROTEIRO : representa

    PRODUTO ||--o{ PRODUTO_ETAPA : define
    ETAPA_ROTEIRO ||--o{ PRODUTO_ETAPA : possui_tempo

    PLANO_PRODUCAO ||--o{ ORDEM_PRODUCAO : agrupa
    PRODUTO ||--o{ ORDEM_PRODUCAO : produz
    ROTEIRO ||--o{ ORDEM_PRODUCAO : utiliza

    SETOR ||--o{ POSTO : possui

    ETAPA_ROTEIRO ||--o{ ETAPA_POSTO : aceita
    POSTO ||--o{ ETAPA_POSTO : atende

    ORDEM_PRODUCAO ||--o{ EXECUCAO : possui
    ETAPA_ROTEIRO ||--o{ EXECUCAO : executada
    OPERADOR ||--o{ EXECUCAO : aponta
    POSTO ||--o{ EXECUCAO : ocorre

    EXECUCAO ||--|{ EVENTO_TEMPO : registra
    MOTIVO_PAUSA ||--o{ EVENTO_TEMPO : classifica
```
