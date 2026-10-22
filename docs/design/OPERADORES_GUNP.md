# Cadastro e edição de operadores

## Escopo e fonte do contrato

A tela em /painel/operadores permite listar, criar e editar nome, setor principal e função. O contrato completo de geração e compatibilidade está em [operadores-setores.md](../../specs/contratos/operadores-setores.md).

Novos operadores exigem setor principal e recebem matrícula automática e permanente. O administrador não informa nem altera matrícula. A função é texto opcional, sem novo cadastro de cargos. A lotação é informativa; o posto efetivo continua na execução. Operador permanece separado de Usuario.

Não inclui ativação/inativação, exclusão, importação CSV ou QR Code.

## Regras e API

O cadastro recebe nome, setorPrincipalId e função opcional. Nome e função são tratados com trim nas extremidades; função vazia/nula é null. Sem novos limites de tamanho. Nomes repetidos são permitidos. Novos operadores são ativos; matrículas de inativos continuam reservadas.

GET /api/operadores retorna a lista completa, sem paginação e com Cache-Control: no-store. POST retorna 201; PATCH /api/operadores/[id] altera somente campos informados e retorna 200. Respostas incluem id, nome, matrícula, ativo, função, setorPrincipal (id/código/nome ou null) e timestamps.

Entradas inválidas, campos extras, matrícula/status manuais e setor inexistente retornam 400. Operador inexistente retorna 404; colisões esgotadas retornam 409; falhas inesperadas, 500 genérico. Preservar o formato de erro e a autorização de ADMIN ativo no servidor.

Matrículas antigas, nomes, status, IDs e execuções são preservados. Operadores antigos podem permanecer sem setor ao editar outros campos, ou receber seu setor posteriormente. Não permitir remover um setor por null. Transferência e mudança de nome não geram nova matrícula.

## Interface e arquitetura

A listagem mostra Nome, Matrícula, Setor principal, Função, Status, Cadastrado em e Editar. Ausências aparecem como Sem setor definido e Não informada. Busca por nome, matrícula, função e nome/código de setor ignora caixa e acentos apenas na apresentação. Manter filtro de status, ordenação e datas pt-BR/America/Sao_Paulo. A rolagem horizontal fica na tabela.

O modal nativo permite cadastro e edição, carrega setores pela API e apresenta código e nome na seleção. Tratar carregamento, falha com nova tentativa e nenhum setor disponível. A matrícula é confirmada pelo servidor na criação e fica somente para consulta na edição. Preservar preenchimento em erros, impedir reenvio/fechamento durante gravação e devolver foco ao controle de origem.

Após gravar, apresentar sucesso com matrícula e recarregar preservando filtros/ordenação. Falha de recarga permite repetir somente GET. Ignorar respostas antigas e cancelar cargas ao desmontar/fechar.

Domain contém a geração pura das iniciais/matrícula e validações. Application coordena repositórios e até dez tentativas de reserva. Infrastructure mantém Prisma, transações e tradução das constraints. Presentation recebe dependências explícitas nos testes; a interface consome REST.

## Verificação

Testes unitários usam somente repositórios em memória. Cobrir geração, legados, inativos, concorrência, transferência, edição parcial, autorização, falhas, cliente REST e listagem. As migrations são verificadas em PostgreSQL embarcado isolado conforme o contrato.

Testes HTTP do acesso são opt-in e não criam nem modificam registros reais: POST/PATCH são não autorizados ou contêm campo proibido. A aplicação das migrations no banco da equipe é uma etapa separada de deployment.

Executar testes, lint, typecheck e build. Validar navegador em 375px, 768px e desktop, incluindo foco/teclado, modal, erros e recarga. Sem navegador disponível, a inspeção visual/interativa permanece pendente.
