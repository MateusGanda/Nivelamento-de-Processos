# Cadastro de setores com código automático

## Escopo e regras

A tela /painel/setores mantém criação e listagem, agora com código funcional gerado no servidor. Não inclui edição, exclusão, status ou mudanças em postos. O contrato completo está em [operadores-setores.md](../../specs/contratos/operadores-setores.md).

Usar Setor existente, acrescentando codigo obrigatório e único após backfill. Nome obrigatório e único, descrição opcional, UUID e timestamps preservados. Trim somente nas extremidades; descrição ausente/nula/vazia vira null. Preservar caixa, acentos e espaços internos do nome, sem novos limites de tamanho. A unicidade do nome mantém o comportamento do banco: Costura e costura são distintos.

Código é permanente e separado do UUID. Exemplos: Pesponto recebe PES1, outra base PES recebe PES2, Costura recebe COS1. Na colisão concorrente de código, recalcular até dez tentativas; duplicidade de nome permanece um conflito próprio.

Setor organiza postos e pode ser setor principal de vários operadores. Essa lotação não restringe postos ou operações de execução.

## API e arquitetura

GET /api/setores retorna id, codigo, nome, descricao, createdAt e updatedAt, ordenado por nome, sem paginação e com Cache-Control: no-store. POST aceita somente nome e descrição opcional (texto/null) e retorna 201 com código confirmado. Não aceitar código enviado pelo administrador.

Entradas inválidas e campos extras retornam 400; nome duplicado ou esgotamento de reserva, 409; falha inesperada, 500 genérico. Preservar erros do acesso e autorização de ADMIN ativo antes de leitura/escrita.

Domain contém a regra pura de código e validações; Application coordena tentativas e persistência por contrato; Infrastructure traduz Setor_codigo_key e Setor_nome_key e usa Prisma. A consulta prévia complementa, sem substituir, as constraints do banco.

## Interface

Tabela com Código, Nome, Descrição e Cadastrado em, sem ações. Descrição ausente aparece como Sem descrição. Busca por código/nome/descrição ignora caixa e acentos apenas na apresentação; ordenação inicial por nome crescente e cabeçalhos com aria-sort. Datas pt-BR/America/Sao_Paulo; rolagem horizontal somente na tabela.

Modal nativo com Nome e Descrição opcional, informando que o código será gerado após cadastrar. Preservar foco inicial/retorno, Escape/backdrop/Cancelar antes do envio, bloqueio durante requisição e dados em erros.

Após sucesso, recarregar mantendo busca/ordenação; falha de recarga informa que o cadastro já ocorreu e repete somente GET. Tratar carregamento, erro, vazio e ausência de resultados, ignorando respostas antigas.

## Migration e verificação

A migration adiciona codigo inicialmente anulável, preenche os setores existentes em ordem de createdAt/UUID e só então aplica NOT NULL/UNIQUE. Preserva nomes, descrições, timestamps e relacionamentos; não reconstrói tabelas. Sua aplicação no banco da equipe é separada desta entrega.

Testar regras puras, reserva concorrente, falhas, autorização, cliente REST e busca/ordenação. Escritas unitárias somente em memória; validação das migrations em PostgreSQL embarcado isolado, sem usar DATABASE_URL. Testes HTTP opt-in não criam setores reais.

Executar testes, lint, typecheck e build; conferir modal, foco/teclado e responsividade em navegador. Sem navegador disponível, inspeção visual/interativa permanece pendente.
