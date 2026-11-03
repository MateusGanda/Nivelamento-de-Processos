# Ilha de apontamento — revisão da interface

Entrega de 01/11/2026: primeira parte da revisão da tela existente, limitada ao carregamento de ordens e motivos de pausa. A ilha continua em `/ilha`; seus fluxos e regras de produção seguem o modelo conceitual e o módulo `modules/executions`.

## Comportamento implementado

- A escolha do destino distingue carregamento, erro de consulta, lista vazia e nenhum resultado para a busca. O erro encerra o estado de carregamento e oferece **Tentar novamente**.
- **Cancelar** permanece disponível durante a consulta e em caso de erro. Cancelar a escolha não inicia nem troca uma execução. Durante a gravação, os controles de cancelamento/atualização continuam bloqueados.
- **Atualizar ordens** permite buscar ordens novamente, inclusive após lista vazia. A atualização mantém o texto da busca e limpa ordem, etapa e posto selecionados, para não confirmar um destino de uma lista anterior.
- A escolha do motivo de pausa fica em `IlhaPausa`, montado a cada abertura. Carrega a lista atual de motivos ativos, sem reaproveitar o cache da abertura anterior ou de outro operador.
- Motivos também têm carregamento, erro, nova tentativa, lista vazia e atualização manual. Atualizar limpa a escolha anterior; confirmar exige um motivo selecionado e consulta concluída.
- As consultas usam GET sem cache e `AbortSignal`. Fechar a escolha, sair desse componente ou iniciar outra tentativa aborta a consulta anterior; seus resultados/erros são ignorados. Cancelar essa consulta não altera a execução no banco.
- Os erros 401/503 continuam encaminhados ao tratamento de acesso/configuração da ilha. Outros erros ficam no seletor correspondente, com recuperação local.
- O cliente REST valida a estrutura das ordens, etapas, postos e motivos antes de entregá-los aos componentes. Uma resposta malformada vira erro de consulta recuperável, em vez de quebrar a renderização.

As novas tentativas e atualizações executam somente GET; não repetem início, pausa, troca ou baixa. Não há novo endpoint, dependência, regra de domínio ou migration nesta entrega.

## Proteção da identificação — 02/11/2026

- Campo de matrícula, Identificar e Sair ficam desabilitados durante uma consulta de identificação ou gravação. Os handlers também verificam o pedido em andamento antes de agir, cobrindo cliques antes da próxima renderização.
- A tela informa quando está registrando uma ação e pede para aguardar antes de trocar o operador. Um segundo envio não dispara outra requisição.
- Sair limpa matrícula digitada, operador, modo, mensagens e rascunho da baixa, retornando o foco à matrícula. Não registra pausa, troca nem finalização.
- Cada pedido recebe um contexto próprio em `requisicoes-ilha.ts`. Sucesso, erro e finalização só afetam a tela enquanto esse pedido for o atual. Uma resposta antiga não restaura o operador nem libera os controles de um pedido mais novo, inclusive ao reidentificar a mesma matrícula.
- Limpar a identificação, solicitar bloqueio ou desmontar a tela invalida o contexto anterior. A identificação GET recebe `AbortSignal`; respostas de gravações já enviadas são descartadas localmente, sem abortar ou repetir o POST.
- Bloquear terminal permanece disponível durante a gravação. Ao solicitar o bloqueio, a identificação e os dados da execução desaparecem imediatamente e novas ações ficam impedidas enquanto a tela aguarda o DELETE de acesso.
- O bloqueio só é anunciado como concluído após confirmação da API. Em falha, a identificação continua limpa, a tela informa que não foi possível confirmar o bloqueio e oferece nova tentativa. Não afirmar que o cookie foi removido quando houve falha de conexão.
- Após confirmação, a página é atualizada para a liberação do terminal; há um botão Atualizar página enquanto essa navegação não termina. Erros de pedidos invalidados, inclusive 401/503, não provocam refresh da sessão seguinte.

Esta entrega altera apenas Presentation, testes e documentação. Preserva as alterações locais preexistentes de `.env.example` e `docs/CONTEXTO_DO_PROJETO.md`. Não altera autorização no servidor, contrato HTTP ou estado persistido de execuções; não requer migration.

## Troca considerando ordem e etapa — 02/11/2026

Antes, o seletor identificava a etapa atual somente pelo ID de `EtapaRoteiro`. Como várias ordens podem usar a mesma versão de roteiro, a etapa era bloqueada também nas outras ordens.

O contexto da troca agora informa `{ ordemId, etapaId }`. A indicação **Etapa atual** e o bloqueio do cartão dependem dos dois IDs. Exemplo: executando Corte na OP-001, Corte na OP-002 pode ser selecionado, desde que a etapa ainda não tenha baixa e possua posto ativo compatível. Na própria OP-001, Corte continua indisponível, mesmo escolhendo outro posto.

A função de apresentação `motivoIndisponibilidadeEtapa` mantém os motivos existentes: Já teve baixa, Etapa atual e Sem posto ativo. É usada tanto nos cartões quanto na validação da seleção para confirmar a troca. O botão e seu handler exigem destino disponível e posto pertencente à etapa selecionada. O fluxo de início, sem contexto de etapa atual, mantém as opções anteriores.

Mudança limitada à interface, função de apresentação, testes e documentação. A API e suas validações, a finalização sem quantidades e a abertura da execução seguinte na transação permanecem inalteradas. Não há migration ou nova dependência.

## Arquivos principais

- [Escolha do destino](../../modules/executions/presentation/components/ilha-destino.tsx).
- [Escolha do motivo da pausa](../../modules/executions/presentation/components/ilha-pausa.tsx).
- [Tela da ilha](../../modules/executions/presentation/components/ilha-screen.tsx).
- [Cliente REST](../../modules/executions/presentation/api-client.ts).
- [Testes das consultas](../../tests/unit/executions/api-client.test.ts).
- [Controle das respostas](../../modules/executions/presentation/requisicoes-ilha.ts).
- [Testes de respostas atrasadas](../../tests/unit/executions/requisicoes-ilha.test.ts).
- [Disponibilidade das etapas no seletor](../../modules/executions/presentation/disponibilidade-etapa.ts).
- [Testes da seleção por ordem e etapa](../../tests/unit/executions/disponibilidade-etapa.test.ts).

## Verificação e limites

### Evidências de 01/11/2026

Em 01/11/2026, suíte completa com **242 testes aprovados e 7 opcionais ignorados** (HTTP e PostgreSQL embarcado). Os seis novos testes verificam consultas GET sem cache e com cancelamento, lista vazia/atualizada, falha seguida de nova consulta, preservação de erros de acesso, cancelamento e respostas malformadas.

Lint, typecheck e build de produção aprovados. O primeiro build falhou ao baixar fontes do Google; o segundo passou com acesso de rede para as fontes e conexão fictícia de banco. Não foram aplicadas migrations nem executado seed.

Validação visual e de interação **pendente**: o host de automação de navegador estava indisponível; a tentativa de abertura do Chrome expirou na autorização do aplicativo. Não houve teste com navegador nem banco real. Os testes do cliente não substituem a verificação dos componentes em execução.

Conferir em navegador, com dados fictícios e sem escrever no banco da equipe:

1. Ordens: carga lenta com Cancelar; falha seguida de nova tentativa; lista vazia seguida de atualização; busca sem resultado; atualização limpando o destino selecionado.
2. Motivos: falha com nova tentativa; lista vazia com atualização; cancelar/reabrir após alteração dos motivos ativos; fechamento durante consulta e resposta atrasada sem repor a lista.
3. Acesso: 401/503 mantendo a recuperação do terminal. Nenhuma tentativa de consulta deve enviar POST.
4. Teclado/foco e responsividade em 375px, 768px e desktop; botões de confirmação desabilitados enquanto não há seleção válida ou há gravação em andamento.

### Evidências de 02/11/2026

- Suíte completa: **251 aprovados e 7 opcionais ignorados**; lint, typecheck e build de produção aprovados. Build com configuração fictícia de banco. Nenhuma migration ou seed executado.
- Nove novos testes: sete do controle de pedidos e dois do cliente REST. Promessas controladas verificam envio repetido, sucesso/erro atrasados, erro de acesso antigo, pedido anterior finalizando durante bloqueio, cancelamento da consulta, falha seguida de nova tentativa e reidentificação da mesma matrícula. O teste com fetch simulado confirma um único POST seguido do DELETE, sem cancelar ou repetir a gravação.
- Os testes não montam os componentes React nem comprovam aparência ou foco. A inspeção no Chrome foi interrompida pela ferramenta por não conseguir confirmar a URL atual com segurança. Nenhuma ação foi realizada na página; validação visual e de interação continua pendente.

Conferir em navegador com respostas simuladas e dados fictícios: matrícula e Sair indisponíveis durante envio; Bloquear terminal disponível; bloqueio com POST ainda pendente; resposta tardia de sucesso e erro sem repor operador ou mensagem; bloqueio sem conexão com nova tentativa; saída e reidentificação com rascunho limpo; fechamento da página durante uma consulta; teclado e responsividade. Um POST iniciado pode ter sido gravado mesmo se sua resposta não for mais exibida.

### Verificação da seleção de troca — 02/11/2026

Quatro testes de regressão cobrem o ID de etapa compartilhado por ordens diferentes, a permanência do bloqueio na ordem atual mesmo com outro posto, outra etapa da mesma ordem, início sem contexto atual e preservação dos bloqueios por baixa ou ausência de posto ativo. São testes da função usada pela interface, sem montar os componentes React ou executar gravações no banco.

Suíte completa com **255 aprovados e 7 opcionais ignorados**. Lint, typecheck e build de produção aprovados; build com configuração fictícia de banco. Nenhuma migration ou seed executado.

Validação visual continua pendente pela limitação de automação registrada acima. Conferir com duas ordens de uma mesma versão de roteiro: iniciar uma execução de teste na primeira; abrir Trocar operação; verificar Etapa atual na ordem original; selecionar a outra ordem e verificar a mesma etapa disponível; cancelar sem alterar a execução. Conferir também etapa já baixada, ausência de posto ativo e seleção de outra etapa da ordem original. Efetuar apontamentos somente em banco de desenvolvimento autorizado.

## Próximas partes

Continua pendente a recuperação da situação do operador após uma gravação de resultado incerto, além da validação visual dos ajustes. Idempotência persistida, concorrência com inativação e limpeza por inatividade exigem seus contratos próprios. Os novos detalhes da ilha serão definidos após os ajustes necessários, conforme orientação do usuário em 02/11/2026.
