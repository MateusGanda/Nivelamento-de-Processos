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

## Recuperação após gravação sem confirmação — 02/11/2026

- Uma rejeição de entrada com HTTP 400 mantém o formulário e os valores para correção. Não é apresentada como gravação concluída.
- Após falha de rede, resposta inválida ou outro erro de apontamento (incluindo 404/409), a tela suspende os controles da execução e oferece **Atualizar situação do operador**. O contexto preserva ID e matrícula do operador; o formulário de apontamento é fechado e seu rascunho é limpo.
- A consulta usa somente GET `/api/ilha/operadores/[matricula]`, sem cache, com cancelamento e a proteção de respostas atrasadas já existente. Nenhum comando anterior é guardado para reenvio ou repetido pelo botão.
- A resposta deve corresponder à mesma identificação e conter os dados necessários para apresentar a execução. O cliente valida ordem, produto, etapa, posto e eventos; resposta malformada ou de outra identificação não libera os apontamentos.
- Em sucesso, a execução apresentada é substituída pela situação consultada, inclusive quando está pausada, existe uma nova execução após troca ou não há execução aberta. A mensagem diz **Situação atualizada**, sem afirmar que o pedido anterior foi concluído ou rejeitado.
- Se a consulta falhar, a recuperação continua pendente e permite outra consulta GET. Falha não é convertida em execução nula. Os erros de acesso/configuração 401/503 mantêm o tratamento de atualização da página.
- Um ref também impede chamadas de gravação antes da renderização dos controles suspensos. Atualizar a situação não dispara outra gravação; somente uma nova ação explícita do usuário pode enviar POST após uma consulta bem-sucedida.
- Sair limpa o contexto de recuperação. Uma nova identificação também faz um GET antes de apresentar dados e ações. Durante a consulta, Identificar e Sair ficam indisponíveis; Bloquear terminal continua disponível, invalida a consulta e impede que sua resposta restaure dados.

Esta etapa altera Presentation, testes e documentação. Sem novos endpoints, dependências, campos ou migrations.

**Limite:** a consulta é uma fotografia da situação atual, não um comprovante de execução do pedido anterior. Se o servidor ainda estiver processando uma gravação cuja conexão se perdeu, o estado poderá mudar depois da consulta. Esta recuperação não substitui o contrato de idempotência persistida nem as garantias de concorrência do servidor.

## Saída automática — 05/11/2026

Decisão da equipe em 05/11/2026 (item 9 de `specs/PENDENCIAS_MODELO.md`), para a ilha funcionar como terminal compartilhado: o operador registra e a tela volta sozinha para a leitura do crachá.

- Depois de iniciar, pausar, retomar, trocar ou dar baixa, a confirmação fica na tela com "Voltando ao início em 10 s" e o botão **Sair agora**. No fim da contagem a tela volta para a leitura do crachá, com o foco na matrícula.
- Tocar, clicar ou digitar durante a contagem a cancela, e passa a valer a regra de inatividade. Ler outro crachá troca o operador na hora, como antes.
- Sem toque, clique, tecla ou leitura do leitor por 30 s, a identificação é limpa, inclusive com um formulário aberto (o rascunho é descartado) ou com uma matrícula digitada pela metade. Quando havia operador, a tela mostra "Identificação encerrada por falta de uso.", sem o nome.
- A identificação e a "Situação atualizada" da recuperação não iniciam a contagem de 10 s. Nada é limpo durante uma gravação ou o bloqueio do terminal.
- A limpeza usa a mesma rotina do botão Sair: não envia pedido ao servidor e não pausa nem finaliza a execução.
- Os tempos ficam em `limpeza-ilha.ts` (`CONFIRMACAO_MS` e `INATIVIDADE_MS`). A decisão usa o relógio, e não a soma de intervalos, para continuar certa quando o navegador atrasa os timers de uma aba em segundo plano.

Verificação de 05/11/2026: 9 testes unitários da regra e, no navegador, com o sistema compilado e um banco de teste local, 23 de 23 conferências: volta em 10,0 s depois do registro; limpeza entre 29,6 s e 30,1 s sem uso, inclusive com a pausa aberta; execução sem evento novo depois da limpeza; digitação a cada 20 s sem limpeza; outro crachá durante a contagem em 0,4 s; Sair agora; 375 px sem rolagem lateral. Sem mudança de API, banco ou dependência.

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
- [Consulta para recuperação](../../modules/executions/presentation/recuperacao-ilha.ts).
- [Testes da recuperação](../../tests/unit/executions/recuperacao-ilha.test.ts).
- [Saída automática](../../modules/executions/presentation/limpeza-ilha.ts).
- [Testes da saída automática](../../tests/unit/executions/limpeza-ilha.test.ts).

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

### Verificação da recuperação — 02/11/2026

Doze testes novos cobrem a classificação da rejeição de entrada; início, pausa, retomada, troca e baixa gravados com resposta perdida; consulta indisponível; resposta malformada; identificação divergente; nova tentativa somente de leitura; consulta atrasada após bloqueio; e gravação com resposta incompleta. Fetch e registros são simulados, sem acesso ao banco. Os testes verificam a sequência POST → GET sem segundo POST, mas não montam o componente React.

Suíte completa: **267 aprovados e 7 opcionais ignorados**. Lint, typecheck e build de produção aprovados; build com configuração fictícia de banco. Nenhuma migration ou seed executado.

Validação em navegador segue pendente pela limitação de automação já registrada. Conferir com respostas simuladas: uma gravação concluída cuja resposta falha; atualização mostrando estado pausado, retomado, nova execução ou nenhuma aberta; consulta falhando e mantendo apenas a recuperação; HTTP 400 preservando preenchimento; bloqueio enquanto o GET está pendente; reidentificação e respostas antigas; foco e responsividade. Não provocar perda de resposta de um apontamento no banco da equipe para preparar o teste.

## Próximas partes

### Leitura da ordem na ilha — 03/11/2026

Implementada a segunda entrega do [contrato das ordens](../../specs/contratos/identificacao-ordens-qrcode.md). O QR antes era recebido pela pesquisa literal e não encontrava o número; agora a entrada própria interpreta `GUNP-OP-<UUID>`, consulta GET `/api/ilha/ordens` sem cache e seleciona pelo ID sem diferença de caixa. O crachá de operador sem execução abre essa leitura automaticamente; execução ativa/pausada mantém sua situação e a troca usa o mesmo seletor quando permitida.

O foco passa da matrícula para leitura e depois para etapas, sem captura global. O campo da matrícula fica indisponível durante formulários/gravações. Pesquisa manual, posto único, bloqueios por baixa/posto/etapa atual e confirmação explícita permanecem. Cancelar, Sair ou Bloquear aborta a consulta por desmontagem/invalidação e descarta respostas antigas; Enter repetido não duplica GET. Não há POST pela leitura do QR.

Quatorze testes novos aprovados; suíte com 303 aprovados e 7 opcionais ignorados, sem banco ou montagem de React. A captura do usuário confirma a decodificação do QR, mas a interação final, foco/teclado, impressão e responsividade precisam de aceite no navegador; o host de automação está indisponível nesta sessão. Conferir o roteiro manual e as evidências completas no contrato.

Atualização de 03/11/2026: a leitura do crachá e a decodificação do QR da ordem foram confirmadas pelo usuário. Ficha e seleção por leitura estão implementadas, conforme a entrega acima; o aceite manual completo permanece pendente. A impressão em lote dos crachás fica para depois dessas entregas.

Em 02/11/2026 foi aprovada a [identificação por QR Code](../../specs/contratos/identificacao-operadores-qrcode.md), em três entregas: crachá individual, impressão em lote e integração do Vinik 2DYN. A primeira acrescenta emissão de crachá de ativos no painel de operadores, com matrícula exata no QR, sem alterar a tela da ilha. O leitor será usado somente na área de identificação; Enter consultará a situação, sem apontamento automático. Aceite visual/impressão do crachá e validação física continuam pendentes, conforme o contrato.

As três correções planejadas da interface estão implementadas: proteção da identificação, troca por ordem + etapa e recuperação da situação após falha de gravação. Continua pendente a validação visual e integrada dos ajustes. Idempotência persistida e concorrência com inativação exigem seus contratos próprios; a limpeza por inatividade foi definida em 05/11/2026 (seção "Saída automática"). Os novos detalhes da ilha serão definidos após os ajustes necessários, conforme orientação do usuário em 02/11/2026.
