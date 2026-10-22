# MODELO CONCEITUAL — GUNP

Atualização consolidada das decisões de domínio do MVP. Este documento define o modelo conceitual; decisões de organização do código seguem `ARCHITECTURE.md`, tecnologias seguem `TECHNOLOGY.md` e a ordem das tarefas segue `ROADMAP_GUNP.md`.

## Entidades

- Produto: item fabricado.
- Operação: atividade produtiva reutilizável; não possui tempo padrão universal.
- Roteiro: definição versionada do processo, composta por etapas em sequência nominal.
- Etapa do Roteiro: ocorrência de uma operação em uma versão de roteiro.
- Produto–Roteiro: associação que permite histórico e identificação da versão vigente.
- Produto–Etapa/Tempo Padrão: associação que define o tempo padrão da etapa no contexto de um produto, pois pode variar por produto.
- Plano de Produção: agrupador de planejamento.
- Ordem de Produção: produção específica de uma quantidade de um produto; referencia explicitamente a versão do roteiro usada e a mantém estável.
- Execução: apontamento/execução de uma etapa de uma Ordem. Não implica que o operador associado produziu sozinho toda a quantidade.
- Operador: entidade de produção responsável pelo apontamento da execução; não é, por si só, uma conta de autenticação.
- Posto/Recurso: recurso/local produtivo identificável; uma entidade única no MVP.
- Setor: organiza postos/recursos.
- Evento de Tempo: INICIO, PAUSA, RETOMADA e FINALIZACAO.
- Motivo de Pausa: classificação padronizada de pausas.
- Usuario: conta individual para acesso administrativo autenticado. É separado de Operador.
- Terminal/Ilha de Produção: ponto compartilhado e controlado para realizar apontamentos; sua representação persistida e seu mecanismo de credenciamento ainda precisam ser definidos no schema.

## Relações

- Produto ↔ Roteiro: N:N, via associação Produto–Roteiro.
- Roteiro → Etapa do Roteiro: 1:N.
- Etapa do Roteiro → Operação: N:1.
- Produto + Etapa do Roteiro → Tempo Padrão.
- Plano de Produção → Ordem de Produção: 1:N.
- Ordem de Produção → Produto: N:1.
- Ordem de Produção → Roteiro: N:1; a versão é congelada na Ordem.
- Ordem de Produção → Execução: 1:N.
- Execução → Etapa do Roteiro: N:1.
- Execução → Operador: N:1.
- Execução → Posto/Recurso: N:1.
- Setor → Posto/Recurso: 1:N.
- Setor → Operador: 1:N pelo setor principal; vínculo opcional no banco para legados e obrigatório nos novos cadastros pela aplicação.
- Etapa do Roteiro ↔ Posto/Recurso: N:N.
- Execução → Evento de Tempo: 1:N.
- Evento de Tempo → Motivo de Pausa: N:0..1.

## Regras de negócio

### Cadastro de operação
- Nome obrigatório e único; descrição opcional. Remover somente espaços nas extremidades, preservando caixa, acentos e espaços internos, sem novos limites de tamanho.
- Descrição ausente no cadastro, nula ou vazia após trim é armazenada como `null`. Na edição, campos omitidos permanecem inalterados.
- A unicidade mantém a comparação do schema/banco: `Corte` e `corte` são distintos. Busca sem caixa/acentos é somente de apresentação.
- A entrega permite criação, listagem e edição de nome/descrição, preservando o identificador e os vínculos das etapas. Não inclui exclusão nem ativação/inativação; `Operacao` não possui `ativo` no contrato atual.
- Operação não possui tempo padrão universal; ele continua na combinação produto + etapa do roteiro.

### Cadastro de setor
- Nome obrigatório e único; descrição opcional, trim nas extremidades e sem novos limites de tamanho. Descrição ausente/nula/vazia vira null.
- A unicidade do nome mantém o banco atual: Costura e costura são distintos.
- Código funcional automático, único e permanente: primeiras três letras normalizadas e sequência (PES1, PES2). Nomes curtos usam as letras disponíveis; sem letras, base SET.
- Criação/listagem disponíveis com busca pelo código. Sem edição, exclusão ou status nesta entrega.

### Cadastro de operador
- Nome e setor principal obrigatórios nos novos cadastros; função opcional em texto livre.
- Matrícula gerada no servidor: até quatro iniciais significativas e código do setor; repetições usam número junto às iniciais (LGNS-PES1, LGNS2-PES1). Sem letras, base OP.
- Matrícula permanente após mudança de nome/setor. Matrículas antigas e de inativos continuam reservadas e não são convertidas.
- Operadores antigos podem permanecer sem setor ao editar outros campos, ou receber o vínculo posteriormente. Não remover vínculo por null.
- Nomes repetidos são permitidos; novo cadastro cria como ativo. Edição abrange nome, setor e função; ativação/inativação continua pendente.
- Setor e função são informativos; o posto efetivo fica na execução. Não atribuem permissões nem restringem operações.
- Geração, colisões, normalização, fallback e API seguem specs/contratos/operadores-setores.md. Constraints reforçam unicidade; até dez tentativas em colisões concorrentes de identificador.

### Ordem e quantidade
- Uma Ordem representa uma quantidade de um único produto.
- Não existe baixa parcial.
- A baixa considera 100% da quantidade da Ordem na etapa.
- Resultado da baixa: boa, retrabalho e refugo.
- `boa + retrabalho + refugo = quantidade da Ordem`.
- Não existem registros incrementais de quantidade no MVP.

### Execução
- Uma Ordem pode possuir várias execuções, inclusive várias para a mesma etapa.
- A baixa efetiva de uma etapa ocorre uma única vez.
- Estados: `EM_EXECUCAO`, `PAUSADA`, `FINALIZADA`.
- Transições: EM_EXECUCAO → PAUSADA; PAUSADA → EM_EXECUCAO; EM_EXECUCAO → FINALIZADA.
- Não há `NAO_INICIADA` persistido. Ausência de execução pode ser apresentada como não iniciada.
- Execução finalizada é terminal e não recebe novos eventos.
- Troca de operação finaliza a execução atual e cria outra.
- Operador não pode manter duas execuções abertas simultaneamente; execução pausada continua ocupando o operador.
- O operador é responsável pelo apontamento, não necessariamente o único trabalhador da célula.

### Tempo
- Uma execução possui um INICIO e uma FINALIZACAO e pode possuir várias PAUSAS/RETOMADAS.
- PAUSA possui Motivo de Pausa.
- Tempo produtivo é derivado dos intervalos ativos; não se infere ociosidade apenas pela ausência de eventos.

### Posto
- Uma etapa pode ser realizada em vários postos compatíveis.
- Um posto pode receber várias execuções ao longo do tempo.
- No MVP, Posto e Recurso são uma única entidade. Uma máquina pode ser um posto quando for um recurso produtivo identificável.

## Acesso administrativo e ilha de produção

- `Usuario` representa uma identidade individual para acesso administrativo; autenticação e autorização devem ser verificadas no servidor.
- `Operador` permanece uma entidade de domínio de produção, separada da conta `Usuario`; não presumir que cada operador tenha login individual.
- A ilha é um terminal compartilhado, com acesso restrito às ações operacionais de apontamento, e não uma conta administrativa compartilhada.
- QR Code ou código funcional identifica o operador para associar apontamentos; não autentica o usuário nem concede privilégios. A digitação manual deve permanecer como alternativa ao leitor físico.
- A sessão/identificação operacional temporária e o modo de autorização do terminal precisam ser definidos antes da implementação das rotas de acesso. Não inventar campos, papéis ou mecanismo de autenticação sem decisão registrada.
- Limpar a identificação na interface por inatividade não deve, por si só, pausar nem finalizar uma execução persistida.

## Roteiro e dependências

A sequência das etapas é apenas nominal/organizacional. Não existem dependências, bloqueios ou liberações automáticas entre etapas no MVP.

## Versionamento

Uma Ordem referencia explicitamente a versão do roteiro usada. Mudanças posteriores no roteiro vigente do produto não alteram Ordens já criadas.

## Fora do MVP / adiados

- dependências entre etapas;
- otimização automática;
- sensores e integração com máquinas;
- controle detalhado de todos os operadores de uma célula;
- capacidade avançada de postos/máquinas;
- tempo de giro entre etapas e previsão sofisticada;
- leitor físico de QR/código de barras como dependência obrigatória (a identificação por código pode ser manual);
- permissões granulares além do controle mínimo necessário para separar acesso administrativo e operações da ilha;
- estruturas detalhadas de pedidos de venda;
- fluxo separado de retrabalho;
- indicadores avançados além do necessário ao TCC.

## Estado do modelo e próximo passo

O schema Prisma inicial e suas migrações já foram gerados e aplicados. O modelo administrativo `Usuario` foi adicionado em migration versionada, separado de `Operador`, com o único papel `ADMIN`; sua efetiva aplicação ao banco deve seguir o processo de deployment. Não reconstruir o modelo relacional do zero. A representação e o mecanismo de acesso do terminal/ilha continuam pendentes. Qualquer alteração de schema deve ser explicitada, revisada e versionada em migration.

As migrations de código de setor e setor principal/função de operador foram preparadas em 21/10/2026, sem aplicação ao banco da equipe nesta entrega. Preservam IDs, matrículas antigas, timestamps e execuções; backfill dos códigos precede NOT NULL/UNIQUE.
