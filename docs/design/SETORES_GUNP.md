# Criação e listagem de setores

## Escopo e regras

`/painel/setores` substitui a página provisória de Setores e mantém menu, cabeçalho, Geist, Tailwind, Lucide e as cores do painel. Esta entrega permite somente criar e listar. Não inclui edição, exclusão, status, códigos numéricos, associação de operadores ou alterações em postos.

Usar a entidade `Setor` existente: nome obrigatório e único, descrição opcional, UUID e timestamps. Remover somente espaços nas extremidades do nome e da descrição, preservando caixa, acentos e espaços internos. Descrição ausente, nula ou vazia após trim é armazenada como `null`. Não introduzir limites de tamanho. A comparação de unicidade mantém o comportamento existente do banco: `Costura` e `costura` são distintos; a busca visual não muda essa regra.

Setores organiza postos/recursos. O vínculo de setor principal e a geração automática de matrícula de operadores estão planejados para uma entrega posterior; o cadastro atual de operadores não foi alterado.

## Contrato REST e arquitetura

- GET `/api/setores`: status 200, array de `{ id, nome, descricao, createdAt, updatedAt }`, ordenado por nome, sem paginação e com `Cache-Control: no-store`.
- POST `/api/setores`: aceita somente `{ nome, descricao? }`, sendo descrição texto ou `null`; status 201 com o setor criado no mesmo formato do GET.
- JSON inválido, campos extras, nome vazio ou tipos incorretos: 400. Nome duplicado: 409. Falha inesperada: 500 com mensagem genérica.
- Erros seguem `{ erro: { codigo, mensagem } }`, como nas APIs existentes. Ausência/invalidade de sessão resulta em 401; conta inativa ou sem papel ADMIN em 403. Conta da sessão não encontrada mantém o 404 do módulo de acesso.

A página revalida ADMIN ativo no servidor, além do layout. GET e POST usam `exigirAdminDaSessao` antes de ler ou criar setores. Indisponibilidade da autorização/banco não concede acesso.

O módulo `modules/sectors` separa Domain (dados e validação), Application (casos de uso e contrato de repositório), Infrastructure (Prisma 8 existente e erros de persistência) e Presentation (HTTP, cliente REST e componentes). Prisma fica exclusivamente na Infrastructure. A criação consulta o nome antes de gravar e também traduz SQLSTATE `23505` da constraint `Setor_nome_key`, inclusive encapsulado em `cause`, para conflito; a consulta prévia não substitui a constraint em concorrência.

Não há novas dependências, alterações de schema, geração de contrato ou migrations.

## Interface

Cabeçalho Setores com descrição curta e botão Adicionar setor. Tabela com Nome, Descrição e Cadastrado em, sem coluna de ações. Descrição ausente aparece como Sem descrição; UUID e updatedAt permanecem somente no contrato.

Busca por nome ou descrição ignora caixa e acentos no cliente. Limpar busca mantém a ordenação. Cabeçalhos alternam crescente/decrescente, com ícones e `aria-sort`; padrão nome crescente. Datas usam pt-BR e America/Sao_Paulo. A lista completa é filtrada/ordenada no cliente; no mobile, apenas a tabela possui rolagem horizontal.

Modal nativo com Nome obrigatório e Descrição opcional, Cancelar e Cadastrar setor. Foco inicial no nome e retorno ao botão de abertura ao fechar. Escape, Cancelar e backdrop fecham antes do envio; fechamento e reenvio ficam bloqueados durante a requisição. Em erros, manter os dados preenchidos. Fechar e limpar somente após confirmação ou cancelamento.

Após criar, mostrar sucesso e recarregar a lista mantendo busca/ordenação. Se a recarga falhar, informar que o setor foi criado e oferecer nova tentativa de GET sem reenviar o POST. Ignorar respostas antigas de carregamentos e cancelar a carga inicial ao desmontar. Tratar carregamento, erro, lista vazia e nenhum resultado.

## Verificação

Usar lint, typecheck, `npm test` e build existentes. Testes unitários cobrem domínio, serviço, handlers, tradução de erros SQL, concorrência simulada, cliente REST, busca, ordenação e fuso. Escritas automatizadas usam repositórios em memória, sem modificar o banco da equipe.

Os testes HTTP opt-in (`GUNP_HTTP_TEST_URL=http://localhost:3000`) verificam página funcional, acesso autorizado, ausência/invalidade de sessão, logout e GET. POSTs reais são somente não autorizados ou contêm campos proibidos, sendo rejeitados antes de gravar. Conta inativa requer fixture existente; não criar nem modificar usuários para prepará-la.

Validar manualmente em navegador: 375×667, 768×1024 e desktop; foco por teclado, Escape, mostrar modal, envio por Enter, campos vazios, conflito, carregamento, preservação dos dados em erros e atualização após criar. Sem navegador disponível, esses cenários permanecem pendentes, sem afirmar validação visual ou interativa.
