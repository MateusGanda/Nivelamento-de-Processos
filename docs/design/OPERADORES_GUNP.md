# Criação e listagem de operadores

## Escopo e regras

`/painel/operadores` reutiliza o painel administrativo e substitui somente o destino provisório de Operadores. Esta etapa permite criar e listar. Não há edição, ativação/inativação, exclusão, importação CSV, QR Code ou cadastro de Usuario.

Nome e matrícula são textos obrigatórios e não vazios após trim. Não há limites novos ou formato numérico obrigatório. Preservar caixa, zeros iniciais e espaços internos: `OP-01` e `op-01` são distintos. Nomes repetidos são permitidos, e uma matrícula de operador inativo permanece reservada. Novos registros são ativos. UUID e timestamps são fornecidos pelo contrato Prisma existente.

## Contrato HTTP e arquitetura

Somente ADMIN ativo com sessão válida pode acessar GET e POST `/api/operadores`. A página também verifica a condição no servidor. Não usar Operador/QR como credencial de autenticação.

GET retorna array de `{ id, nome, matricula, ativo, createdAt, updatedAt }`, incluindo inativos e sem paginação. POST aceita exclusivamente `{ nome, matricula }` e responde com o operador criado e status 201. JSON/tipos inválidos, dados vazios e campos extras retornam 400. Matrícula duplicada retorna 409; erro inesperado retorna 500 com mensagem genérica. O formato de erro é `{ erro: { codigo, mensagem } }`, como nas APIs existentes.

`modules/operators` organiza Domain (tipo e validações), Application (criação/listagem e contrato de repositório), Infrastructure (Prisma e tradução de SQLSTATE 23505 para a constraint `Operador_matricula_key`) e Presentation (HTTP e interface). A consulta prévia de matrícula complementa a constraint, sem substituí-la em situações concorrentes. Os handlers recebem dependências explícitas para testar autorização e escrita sem acesso ao banco da equipe.

Não há alteração de schema ou migration, nem dependências novas. Os componentes consomem API REST; Prisma não é usado na interface, em handlers ou casos de uso.

## Interface

Tabela com Nome, Matrícula, Status e Cadastrado em. Busca por nome/matrícula ignora caixa e acentos somente na apresentação. O filtro de status inicia em Todos; a ordenação inicia em nome crescente e pode ser alternada em cada coluna. Datas usam pt-BR e America/Sao_Paulo. A lista completa é filtrada/ordenada no cliente; a rolagem horizontal fica contida na tabela.

Adicionar operador abre modal nativo com nome e matrícula. Fechamento por Escape, backdrop e Cancelar é permitido antes do envio e bloqueado durante a requisição. Ao fechar, retornar foco ao botão de abertura. Evitar envio repetido, preservar campos em erros e limpar o formulário após sucesso ou cancelamento.

Após cadastro confirmado, fechar o modal, avisar sucesso e recarregar a lista mantendo filtros/ordenação. Se a recarga falhar, informar que o registro já foi criado e oferecer Tentar novamente, que executa apenas GET. Respostas atrasadas de carregamentos anteriores são ignoradas. Tratar carregamento, falha, lista vazia e nenhum resultado para os filtros, sem dados fictícios.

## Verificação

`npm test` cobre serviço, handlers com autorização substituída, validação, duplicidade de inativos, preservação de caixa/zeros, concorrência simulada e tradução de erros SQL, filtros, ordenação e datas. Todas as escritas dos testes automatizados são limitadas a repositórios de teste em memória.

Os testes HTTP opt-in do painel verificam a nova página e o GET autorizado contra a aplicação local. Os POSTs contra o banco da equipe são somente entradas inválidas ou requisições sem autorização, rejeitadas antes de qualquer escrita. Não criar registros de teste reais automaticamente.

Executar lint, typecheck, testes e build. Em navegador, verificar modal, foco/teclado, bloqueio de fechamento durante envio, filtros, ordenação, estados vazios/falha, sucesso e recarga após criar. Conferir 375×667, 768×1024 e desktop: nenhum overflow horizontal da página, apenas da tabela. Se o navegador estiver indisponível, registrar essas verificações como pendentes.
