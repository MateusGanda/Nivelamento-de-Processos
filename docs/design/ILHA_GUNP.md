# Ilha de apontamento — recuperação das consultas

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

## Arquivos principais

- [Escolha do destino](../../modules/executions/presentation/components/ilha-destino.tsx).
- [Escolha do motivo da pausa](../../modules/executions/presentation/components/ilha-pausa.tsx).
- [Tela da ilha](../../modules/executions/presentation/components/ilha-screen.tsx).
- [Cliente REST](../../modules/executions/presentation/api-client.ts).
- [Testes das consultas](../../tests/unit/executions/api-client.test.ts).

## Verificação e limites

Em 01/11/2026, suíte completa com **242 testes aprovados e 7 opcionais ignorados** (HTTP e PostgreSQL embarcado). Os seis novos testes verificam consultas GET sem cache e com cancelamento, lista vazia/atualizada, falha seguida de nova consulta, preservação de erros de acesso, cancelamento e respostas malformadas.

Lint, typecheck e build de produção aprovados. O primeiro build falhou ao baixar fontes do Google; o segundo passou com acesso de rede para as fontes e conexão fictícia de banco. Não foram aplicadas migrations nem executado seed.

Validação visual e de interação **pendente**: o host de automação de navegador estava indisponível; a tentativa de abertura do Chrome expirou na autorização do aplicativo. Não houve teste com navegador nem banco real. Os testes do cliente não substituem a verificação dos componentes em execução.

Conferir em navegador, com dados fictícios e sem escrever no banco da equipe:

1. Ordens: carga lenta com Cancelar; falha seguida de nova tentativa; lista vazia seguida de atualização; busca sem resultado; atualização limpando o destino selecionado.
2. Motivos: falha com nova tentativa; lista vazia com atualização; cancelar/reabrir após alteração dos motivos ativos; fechamento durante consulta e resposta atrasada sem repor a lista.
3. Acesso: 401/503 mantendo a recuperação do terminal. Nenhuma tentativa de consulta deve enviar POST.
4. Teclado/foco e responsividade em 375px, 768px e desktop; botões de confirmação desabilitados enquanto não há seleção válida ou há gravação em andamento.

## Próximas partes

Continuam pendentes a proteção da identificação contra respostas atrasadas de **gravações**, o alinhamento da seleção de troca por ordem + etapa e a recuperação da situação do operador após uma gravação de resultado incerto. Os aborts desta entrega cobrem somente as consultas dos seletores. Idempotência persistida, concorrência com inativação e limpeza por inatividade exigem seus contratos próprios.
