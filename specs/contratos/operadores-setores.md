# Contrato de Operadores e Setores

Versão 1.0 — 21/10/2026. Decisões aprovadas pela equipe nesta entrega.

## Identidade e lotação

O UUID permanece como identidade interna de cada registro. Setor recebe um código funcional automático e único; Operador recebe matrícula automática e única. O administrador não informa nem altera esses identificadores.

Cada operador tem um setor principal informativo e uma função opcional em texto livre. Isso não limita os postos ou as operações que ele pode apontar. O posto efetivo continua em `Execucao.postoId`; não há posto fixo no cadastro de operador. `Usuario` continua separado de `Operador`.

Código de setor e matrícula de operador são permanentes. Alterar nome, função ou setor principal não os recalcula. Após transferência, o trecho do setor na matrícula indica sua origem; o setor atual é consultado no relacionamento explícito.

## Código automático de setor

Campo `Setor.codigo`, obrigatório e único após backfill dos registros antigos. Remover acentos, espaços, pontuação e números, converter as letras para maiúsculas e usar as primeiras três letras; nomes curtos usam as disponíveis. Sem letras, usar `SET`.

Acrescentar o próximo número positivo reservado para a base, iniciado em 1, sem zeros à esquerda: `Pesponto → PES1`, `Pesponto final → PES2`, `Costura → COS1`, `TI → TI1`. Considerar o maior número já reservado, sem reutilizar lacunas ou impor limite de três dígitos.

## Matrícula automática de operador

Formato `INICIAIS[SEQUÊNCIA]-CODIGO_DO_SETOR`.

Normalizar acentos e caixa para a geração, preservando o nome cadastrado. Separar palavras por espaços/pontuação, ignorar `de`, `da`, `das`, `do`, `dos`, `e`, e usar as iniciais das primeiras quatro palavras restantes. Se todas forem partículas, usar suas iniciais; sem letras, usar `OP`. Nomes curtos não são preenchidos com X.

Primeira matrícula do grupo: `LGNS-PES1`. As próximas são `LGNS2-PES1`, `LGNS3-PES1`. `Ana Silva → AS-PES1`; o mesmo prefixo em outro setor forma outro grupo, como `LGNS-COS1`.

Consultar todas as matrículas reservadas, inclusive antigas e de operadores inativos. Comparação e unicidade mantêm o comportamento existente do banco; matrículas antigas não são normalizadas nem convertidas. A sequência não tem limite artificial e usa o maior número reservado do grupo.

## Concorrência

A regra do candidato pertence ao Domain; Application consulta os identificadores reservados e coordena a criação. Infrastructure traduz somente a violação da constraint do identificador em erro específico para repetir a geração. Em colisão concorrente, consultar novamente e tentar até dez vezes. Esgotamento retorna 409 com orientação para tentar novamente. Nome de setor duplicado continua sendo conflito próprio, sem retry de código. As constraints `Setor_codigo_key` e `Operador_matricula_key` permanecem como garantia final.

## API de setores

- GET `/api/setores`: array de `{ id, codigo, nome, descricao, createdAt, updatedAt }`, ordenado por nome, sem paginação, `Cache-Control: no-store`.
- POST `/api/setores`: somente `{ nome, descricao? }`; descrição texto ou nula; retorna o registro com código confirmado, status 201. Código enviado pelo cliente é entrada inválida.
- Nome obrigatório e único, descrição opcional; trim nas extremidades sem novos limites de tamanho. Descrição ausente/vazia/nula vira `null`.

## API de operadores

- GET `/api/operadores`: lista completa, incluindo inativos, sem paginação, `Cache-Control: no-store`.
- POST `/api/operadores`: `{ nome, setorPrincipalId, funcao? }`; exige setor existente. Retorna 201 e matrícula confirmada; novos operadores são ativos.
- PATCH `/api/operadores/[id]`: nome, setorPrincipalId e/ou funcao; exige ao menos um campo. Campos omitidos permanecem inalterados. Retorna 200; operador/id inexistente, 404.
- Matrícula e status enviados pelo cliente são rejeitados, assim como outros campos extras.
- Nome obrigatório após trim. Função ausente no cadastro, nula ou vazia após trim é `null`; na edição, omitir preserva e enviar nulo/vazio limpa. Sem novos limites de tamanho.
- Setor informado precisa ser UUID válido e existir; nulidade explícita não permite remover o vínculo. Operador antigo sem setor pode editar nome/função sem preenchê-lo, ou ser regularizado ao selecionar um setor.
- Registro de resposta: `{ id, nome, matricula, ativo, funcao, setorPrincipal, createdAt, updatedAt }`, sendo `setorPrincipal` nulo ou `{ id, codigo, nome }`.

Página e endpoints exigem sessão e ADMIN ativo no servidor. Erros usam `{ erro: { codigo, mensagem } }`: 400 entrada inválida/setor inválido, 401 sem sessão, 403 sem permissão, 404 operador/usuário da sessão não encontrado, 409 conflito e 500 genérico sem detalhes internos.

## Interface

Setores mostra código em coluna própria e na busca; o formulário mantém nome/descrição e explica a geração automática após cadastrar.

Operadores usa nome, setor principal e função opcional no cadastro. A edição também mostra matrícula somente para consulta. O seletor identifica setores por código e nome; trata carregamento, falha com nova tentativa e ausência de setores. Setor é obrigatório somente para novos operadores. Não apresentar uma prévia como matrícula já reservada: o servidor confirma o valor ao gravar, e a mensagem de sucesso o apresenta.

A tabela acrescenta setor principal, função e Editar. Registros antigos mostram “Sem setor definido”; função ausente, “Não informada”. Busca considera nome, matrícula, função, nome/código do setor, preservando filtro de status e ordenação. Manter dialog nativo, foco inicial/retorno, bloqueio de fechamento/reenvio durante gravação, preenchimento em erros e recarga sem repetir escrita.

## Migrações e compatibilidade

Entrega 1: acrescentar coluna de código, preencher setores em ordem de createdAt e UUID, só então aplicar NOT NULL e UNIQUE. IDs, nomes, descrições, timestamps e relações existentes não mudam.

O Prisma classifica a operação Set NOT NULL como destructive por estreitar a coluna. Ela ocorre após o backfill verificado; a revisão de deployment deve considerar essa classificação e a confirmação exigida pela CLI. Não reclassificar manualmente o pacote gerado. As migrations não contêm remoção ou reconstrução de tabelas.

Entrega 2: adicionar `Operador.funcao` e `Operador.setorPrincipalId` como opcionais, com FK e índice para Setor. A nulidade mantém operadores antigos válidos; novos cadastros exigem setor na aplicação. Preservar matrículas, status, IDs e execuções existentes. Não há conversão nem alias de matrículas antigas.

O POST antigo com matrícula manual é substituído; atualizar interface, cliente REST, fixtures e testes conjuntamente. Ajustar o seed para códigos e vínculos coerentes, preservando as chaves internas do cenário e sem executá-lo automaticamente. As migrations são versionadas, sem reconstruir tabelas ou aplicar no banco da equipe nesta entrega.

## Verificação

Testar regras puras, nomes curtos/acentuados, partículas, mais de quatro palavras, fallback, colisões, matrículas antigas/inativas, transferências, edição parcial e esgotamento de retries. Testar autorização, campos proibidos, inexistência e tratamento de erros; escritas unitárias somente em memória.

O teste PostgreSQL isolado em `tests/integration/cadastros/migrations.test.ts` é opt-in via `GUNP_PGLITE_MODULE`, caminho do módulo PGlite local. Pode ser preparado fora das dependências do produto com `npm install --prefix .cache/migration-validation --no-save --package-lock=false --ignore-scripts @electric-sql/pglite`. Nunca usa DATABASE_URL. Verifica SQL/prechecks/postchecks gerados, dados antigos e constraints; não substitui o procedimento de deployment do Prisma.

Executar testes, lint, typecheck e build por etapa. Conferir navegador em 375px, 768px e desktop: formulários, busca, foco/teclado, erros, sucessos e recarga. Registrar explicitamente quando a inspeção visual ou o teste de implantação não estiver disponível.

### Evidências desta entrega — 21/10/2026

- Etapa Setores validada antes da implementação de Operadores: 19 testes específicos (incluindo PostgreSQL isolado), suíte completa com 150 aprovados/6 HTTP ignorados, lint, typecheck e build aprovados.
- Etapa Operadores: suíte completa com 158 aprovados/6 HTTP ignorados, incluindo SQL e constraints das duas migrations no PostgreSQL isolado; lint, typecheck e build aprovados.
- Dados antigos de operadores, setores, postos, execuções e eventos preservados nos testes; verificados NOT NULL/UNIQUE, FK de setor principal, nulidade dos legados e reserva de matrícula inativa.
- Prisma confirmou offline o encadeamento das duas migrations com `db migrate --show --from ... --to ...`; nenhuma aplicação ao banco da equipe.
- Aplicação compilada com configuração fictícia: dez requisições de API sem sessão ou com cookie inválido retornaram 401; páginas de Setores e Operadores redirecionaram para login.
- Navegador de automação indisponível nesta sessão: inspeção visual, teclado e fluxo autenticado com banco real não executados. O seed não foi executado.
