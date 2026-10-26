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
- Terminal/Ilha de Produção: ponto compartilhado e controlado para realizar apontamentos. Não tem tabela própria; o terminal é liberado pela chave da ilha (ver "Acesso administrativo e ilha de produção").

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

### Ativo e inativo
- `Produto`, `Operacao`, `Setor`, `Posto`, `Roteiro` e `Operador` têm `ativo`. Cadastros usados por outros registros não são excluídos; são inativados (decisão da equipe de 22/10/2026).
- Um cadastro inativo não entra em vínculos novos, mas continua nos registros que já o usam:
  - operação inativa não entra em etapa nova; etapas existentes continuam;
  - produto inativo não é ligado a roteiro nem recebe ordem nova;
  - setor inativo não recebe posto nem operador novo, nem é escolhido numa troca de setor; manter o setor atual na edição é permitido;
  - posto inativo não é ligado a etapa nem recebe execução nova;
  - operador inativo não é aceito na ilha.
- A edição comum não altera `ativo`; a mudança de status tem uma ação própria.

### Cadastro de produto
- Código obrigatório e único; nome obrigatório.

### Cadastro de operação
- Nome obrigatório e único; descrição opcional. Remover somente espaços nas extremidades, preservando caixa, acentos e espaços internos, sem novos limites de tamanho.
- Descrição ausente no cadastro, nula ou vazia após trim é armazenada como `null`. Na edição, campos omitidos permanecem inalterados.
- A unicidade mantém a comparação do schema/banco: `Corte` e `corte` são distintos. Busca sem caixa/acentos é somente de apresentação.
- Criação, listagem, edição de nome/descrição e ativação/inativação, preservando o identificador e os vínculos das etapas. Não há exclusão.
- Operação não possui tempo padrão universal; ele continua na combinação produto + etapa do roteiro.

### Cadastro de setor
- Nome obrigatório e único; descrição opcional, trim nas extremidades e sem novos limites de tamanho. Descrição ausente/nula/vazia vira null.
- A unicidade do nome mantém o banco atual: Costura e costura são distintos.
- Código funcional automático, único e permanente: primeiras três letras normalizadas e sequência (PES1, PES2). Nomes curtos usam as letras disponíveis; sem letras, base SET.
- A edição altera nome e descrição; o código não muda. Ativação/inativação conforme "Ativo e inativo". Não há exclusão.

### Cadastro de posto
- Código obrigatório e único; nome e setor obrigatórios. Ativação/inativação conforme "Ativo e inativo".

### Cadastro de operador
- Nome e setor principal obrigatórios nos novos cadastros; função opcional em texto livre.
- Matrícula gerada no servidor: até quatro iniciais significativas e código do setor; repetições usam número junto às iniciais (LGNS-PES1, LGNS2-PES1). Sem letras, base OP.
- Matrícula permanente após mudança de nome/setor. Matrículas antigas e de inativos continuam reservadas e não são convertidas.
- Operadores antigos podem permanecer sem setor ao editar outros campos, ou receber o vínculo posteriormente. Não remover vínculo por null.
- Nomes repetidos são permitidos; novo cadastro cria como ativo. Edição abrange nome, setor e função; ativação/inativação continua pendente.
- Setor e função são informativos; o posto efetivo fica na execução. Não atribuem permissões nem restringem operações.
- Geração, colisões, normalização, fallback e API seguem specs/contratos/operadores-setores.md. Constraints reforçam unicidade; até dez tentativas em colisões concorrentes de identificador.

### Roteiro e tempo padrão
- Nome e versão identificam o roteiro; a nova versão copia etapas, postos de cada etapa, produtos ligados (sem vigência) e tempos padrão da versão de origem.
- Cada produto tem uma única versão vigente. Só um roteiro ativo pode ser vigente, e o roteiro vigente de algum produto não pode ser inativado.
- Quando o roteiro já tem ordens, as etapas ficam travadas e a mudança é feita em uma nova versão. Os postos de cada etapa continuam podendo ser alterados.
- Os tempos padrão de um produto ficam travados quando esse produto já tem ordens na versão (decisão de 19/10/2026).
- Tempo padrão maior que zero, em segundos por unidade produzida, com até duas casas decimais. Etapa sem tempo informado fica sem tempo padrão.

### Plano de produção
- Código obrigatório e único; descrição opcional; período opcional.
- As datas são gravadas como texto `AAAA-MM-DD`, precisam existir no calendário, e o fim não pode ser anterior ao início, inclusive quando só uma das datas é alterada (decisão de 22/10/2026).

### Ordem e quantidade
- Uma Ordem representa uma quantidade de um único produto.
- Na criação: número único, plano existente, produto ativo, versão do roteiro ligada ao produto, ativa e com etapas, e quantidade maior que zero com até duas casas decimais.
- Produto e versão do roteiro não mudam depois da criação. Número e plano podem ser editados; quantidade e unidade, somente enquanto a ordem não tem execuções.
- Não existe baixa parcial.
- A baixa considera 100% da quantidade da Ordem na etapa.
- Resultado da baixa: boa, retrabalho e refugo.
- `boa + retrabalho + refugo = quantidade da Ordem`.
- As quantidades da baixa não podem ser negativas e têm até duas casas decimais.
- Não existem registros incrementais de quantidade no MVP.

### Execução
- Uma Ordem pode possuir várias execuções, inclusive várias para a mesma etapa.
- A baixa efetiva de uma etapa ocorre uma única vez.
- Estados: `EM_EXECUCAO`, `PAUSADA`, `FINALIZADA`.
- Transições: EM_EXECUCAO → PAUSADA; PAUSADA → EM_EXECUCAO; EM_EXECUCAO → FINALIZADA.
- Não há `NAO_INICIADA` persistido. Ausência de execução pode ser apresentada como não iniciada.
- Execução finalizada é terminal e não recebe novos eventos.
- Troca de operação finaliza a execução atual e cria outra.
- Operador não pode manter duas execuções abertas simultaneamente; execução pausada continua ocupando o operador. O banco garante a regra com o índice único parcial `Execucao_operador_aberta_unica` (status diferente de `FINALIZADA`).
- Para iniciar: operador ativo, etapa pertencente ao roteiro da Ordem e ainda sem baixa, e posto ativo e compatível com a etapa.
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
- O terminal é autorizado pela chave da ilha (decisão de 25/10/2026): informada uma vez, libera o terminal por um cookie derivado da chave. Não há tabela de terminais nem papel novo; a ilha não usa a sessão administrativa.
- A matrícula age somente sobre as execuções do próprio operador.
- A identificação na tela é limpa pelo botão Sair. A limpeza por inatividade ainda não tem regra definida e, se adotada, não deve, por si só, pausar nem finalizar uma execução persistida.

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

O schema Prisma e suas migrações estão versionados e aplicados no banco do site publicado e no banco de desenvolvimento da equipe. O modelo administrativo `Usuario` é separado de `Operador`, com o único papel `ADMIN`. Não reconstruir o modelo relacional do zero. Qualquer alteração de schema deve ser explicitada, revisada e versionada em migration.

Migrations de 21/10 a 26/10/2026:

- código de setor e setor principal/função de operador (preservam IDs, matrículas antigas, timestamps e execuções; backfill dos códigos precede NOT NULL/UNIQUE);
- `ativo` em `Operacao` e `Produto`, e depois em `Setor`, com padrão verdadeiro para os registros existentes;
- datas do plano como `DateString`, sem mudança na coluna do banco;
- índice único parcial de uma execução aberta por operador.

Pendências do modelo continuam registradas em `specs/PENDENCIAS_MODELO.md`.
