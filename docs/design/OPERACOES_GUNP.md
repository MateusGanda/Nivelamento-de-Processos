# Listagem, criação e edição de operações

## Escopo

`/painel/operacoes` substitui o destino provisório de Operações e reutiliza o painel administrativo. Permite listar, criar e editar nome e descrição. Não inclui exclusão, ativação/inativação, importação ou tempo padrão universal. O schema e as migrations permanecem inalterados.

Nome é obrigatório e único; descrição é opcional. Remover somente espaços nas extremidades, preservando caixa, acentos e espaços internos, sem novos limites de tamanho. Descrição ausente no cadastro, nula ou vazia após trim é armazenada como `null`. Na edição, campo omitido permanece inalterado; descrição nula ou vazia remove a descrição. A unicidade mantém a comparação existente do banco: `Corte` e `corte` são distintos. Editar mantém o identificador e as referências das etapas dos roteiros; o nome/descrição atualizado é compartilhado por esses vínculos, sem snapshot de rótulos.

O tempo padrão continua pertencendo à combinação produto + etapa do roteiro. Operações cadastradas ficam disponíveis no seletor existente dos roteiros.

## API e arquitetura

- GET `/api/operacoes`: lista completa ordenada por nome, sem paginação, com `Cache-Control: no-store`.
- POST `/api/operacoes`: aceita somente `{ nome, descricao? }`, descrição texto ou `null`; retorna 201.
- PATCH `/api/operacoes/[id]`: aceita nome e/ou descrição, com ao menos um campo; retorna 200. Id inválido ou registro inexistente resulta em 404.
- Todos retornam registros `{ id, nome, descricao, createdAt, updatedAt }`.
- JSON inválido, campos extras, tipos incorretos e nome vazio retornam 400; nome duplicado, 409; falha inesperada, 500 genérico. Erros usam `{ erro: { codigo, mensagem } }`.
- Página e endpoints exigem sessão e ADMIN ativo no servidor. Ausência/invalidade de sessão resulta em 401; conta inativa/sem permissão, 403; usuário da sessão não encontrado mantém o 404 do acesso.

`modules/operations` separa Domain (tipo e validação), Application (criação, listagem, edição e contrato de repositório), Infrastructure (Prisma e tradução da constraint `Operacao_nome_key`, SQLSTATE 23505, inclusive em `cause`) e Presentation (REST, cliente e componentes). A consulta prévia de nome não substitui a constraint em concorrência. Prisma permanece somente na Infrastructure, sem mudanças no módulo de roteiros.

## Interface

Tabela com Nome, Descrição, Cadastrado em, Alterado em e Editar. Descrição ausente aparece como Sem descrição. Busca por nome/descrição ignora caixa e acentos apenas na apresentação. Ordenação inicial por nome crescente, alternável nos cabeçalhos com `aria-sort`; datas em pt-BR e America/Sao_Paulo. Busca e ordenação acontecem no cliente, sem modificar a lista recebida. No mobile, a rolagem horizontal fica contida na tabela.

Modal nativo para cadastro/edição, com foco inicial no nome e retorno ao botão de origem ao fechar. Escape, backdrop e Cancelar fecham antes do envio. Durante a requisição, fechamento e envio repetido ficam bloqueados. Erros preservam o preenchimento; sucesso e cancelamento limpam o formulário.

Após gravar, fechar o modal, informar sucesso e recarregar preservando busca e ordenação. Falha na recarga informa que a gravação já ocorreu; Tentar novamente executa somente GET. Respostas antigas são ignoradas e a carga inicial é cancelada ao desmontar. Há estados de carregamento, erro, lista vazia e nenhum resultado.

## Verificação

Os testes unitários em `tests/unit/operations` cobrem validação, normalização, edição parcial, duplicidade e concorrência simulada, autorização antes de parsing/persistência, erros, cliente REST, busca, ordenação e fuso. Todas as escritas usam repositórios em memória.

Os testes HTTP opt-in do acesso incluem a página, GET autorizado e bloqueio por ausência/invalidade de sessão, conta inativa e logout. POST/PATCH reais desses testes são não autorizados ou têm campo proibido, sendo rejeitados antes de qualquer escrita. Não criar registros de teste no banco da equipe.

Executar testes, lint, typecheck e build. A validação em navegador deve conferir 375px, 768px e desktop, modal, foco/teclado, conflitos, filtros, gravação e recarga, além da disponibilidade da operação em Roteiros. Sem navegador disponível, a inspeção visual/interativa permanece pendente; testes unitários não a substituem.
