# QR Code das ordens de produção

Versão 1.1 — 03/11/2026. Plano aprovado em duas entregas: ficha individual e seleção por leitura na ilha. As duas estão implementadas; o aceite visual, a impressão e o teste físico do fluxo completo continuam com suas evidências próprias.

## Identidade e limites

- O conteúdo do QR é `GUNP-OP-<UUID>`, em maiúsculas, usando o ID existente da ordem. Exemplo: `GUNP-OP-AABBCCDD-1234-4ABC-8DEF-123456789ABC`.
- O prefixo identifica o tipo de documento. Número, produto, quantidade, roteiro, credenciais e chaves não são codificados no QR.
- O número legível continua na ficha. Renumerar a ordem, mudar plano ou atualizar campos permitidos não altera o QR; não há novo identificador no banco.
- A ficha apresenta os dados consultados e as etapas previstas da versão vinculada à ordem. Não comprova disponibilidade para início, execução ou conclusão. Não há arquivo histórico de emissão, imagem persistida ou reserva da ordem.
- QR é identificação. A emissão continua restrita ao ADMIN ativo; a ilha continua autorizada pelo cookie do terminal. Não há endpoint público novo nem novo mecanismo de autenticação.
- Fica preservado o contrato de identificação do operador pela matrícula exata, em [Identificação de operadores](identificacao-operadores-qrcode.md).

## Entrega 1 — ficha individual implementada

### Acesso e dados

- A ação **Ficha com QR** fica em cada linha de `/painel/ordens-de-producao`. Qualquer ordem existente pode ter sua ficha emitida, inclusive com execuções ou com roteiro posteriormente inativado. A emissão não inicia nem libera a produção.
- Ao abrir ou tentar novamente, consultar GET `/api/ordens-de-producao`, localizar pelo ID e então buscar GET `/api/roteiros/[id]` com o `roteiro.id` daquela ordem. Não consultar nem substituir pela versão vigente do produto.
- Usar os clientes REST existentes, com sessão da mesma origem, sem cache e com `AbortSignal`. Os dois endpoints já exigem ADMIN ativo no servidor. Não acessar Prisma pela interface.
- Verificar correspondência do ID/versão do roteiro, dados essenciais da ordem, quantidade positiva finita e lista completa de etapas. Etapas precisam de ID válido/único, sequência inteira positiva/única e nome da operação preenchido; ordenar pela sequência nominal, sem exigir ausência de lacunas.
- Ordem não encontrada, roteiro incompatível, dados incompletos, erro de consulta ou falha de geração não libera ficha parcial. Exibir erro com **Tentar novamente**. Na nova tentativa, consultar ambos os recursos novamente.
- 401/403 em qualquer consulta fecha a ficha e encaminha para login. Falhas técnicas não devem expor detalhes internos da geração.
- Fechar, Escape, navegação ou nova tentativa cancela a consulta e descarta resultados tardios, inclusive PNG concluído depois do cancelamento.

### Prévia, download e impressão

- Dialog nativo, com título acessível, carregamento, erro, fechamento por Escape e botão Fechar. O foco começa em Fechar e retorna ao botão da linha quando o dialog é fechado.
- A ficha mostra marca GUNP, número, código/nome do produto, quantidade/unidade, plano e nome/versão do roteiro. A tabela traz somente sequência e nome da operação, sem apontamentos, assinaturas, tempos calculados ou postos impressos.
- **Baixar QR em PNG** baixa somente o QR, com nome baseado no UUID da ordem. **Imprimir ficha** abre a impressão do navegador, que também permite salvar em PDF.
- Reutilizar `qrcode` já instalado: PNG local de 1024 × 1024 px, correção Q, margem livre de quatro módulos, preto sobre branco opaco. A geração técnica é compartilhada com os crachás; cada módulo define seu próprio conteúdo.
- Aguardar o carregamento da imagem antes de permitir download ou impressão. Falha da imagem mantém essas ações indisponíveis e permite refazer a preparação.
- Imprimir A4 retrato, margens de 12 mm, escala recomendada de 100%, cabeçalhos e rodapés do navegador desativados e QR de aproximadamente 40 mm.
- Conteúdo fluido, sem altura fixa, abreviação ou corte de textos/etapas. Fichas extensas podem ocupar várias páginas; repetir o cabeçalho da tabela e evitar dividir linhas e a área do QR quando couberem na página.
- Isolar a impressão por portal e estado temporário no body. Não imprimir menu, tabela de ordens ou dialog; remover esse estado ao fechar/desmontar, preservando impressão de crachás e indicadores.
- A prévia adapta a disposição dos dados às telas pequenas; o papel mantém o layout A4.

Não há dependência nova, alteração de endpoint/DTO público, schema, migration ou seed. A seleção na ilha é descrita na entrega 2.

## Entrega 2 — leitura na ilha implementada

Fluxo: **crachá → QR da ordem → etapa → posto → confirmar início**. Após identificação bem-sucedida de operador sem execução aberta, abrir diretamente a leitura da ordem e focar seu campo.

Aceitar `GUNP-OP-<UUID>`, validar o formato e comparar o UUID sem diferença de caixa. Enter ou **Identificar ordem** consulta novamente GET `/api/ilha/ordens` e localiza a ordem pelo ID. QR inválido orienta a leitura da ordem; ID ausente na lista indica indisponibilidade, sem afirmar que necessariamente foi concluída.

Exibir resumo e etapas disponíveis. Outra ordem limpa etapa e posto anteriores. Preservar seleção automática de posto único, regras por baixa/posto ativo e combinação atual de ordem + etapa na troca. Oferecer **Pesquisar ordem manualmente** e **Ler outra ordem**. Cancelar volta à visão do operador sem escrita; sair/trocar operador limpa toda a seleção.

Operador com execução aberta ou pausada vê sua situação atual; uma leitura nunca a encerra. Quando permitido, a nova ordem pode ser lida dentro de **Trocar operação**. Início e troca continuam com confirmação explícita; ler QR não envia comandos de produção.

Durante consultas, gravações, recuperação pendente e bloqueio, impedir novas confirmações. Preservar cancelamento de GET e descarte de respostas antigas. O foco acompanha a etapa do fluxo, sem captura global de teclas ou classificação por velocidade do leitor. Reutilizar APIs e autorizações existentes.

### Comportamento de interface e recuperação

- A entrada começa em **Leia o QR da ordem**, sem carregar toda a lista antes de o código ser lido. **Pronto para ler** aparece somente com campo focado e disponível. A leitura é limpa ao consultar para impedir concatenação de fichas.
- Uma identificação de operador sem execução abre esse fluxo automaticamente. Após comandos de produção ou consulta de recuperação, a tela mantém seu comportamento de apresentação da situação; não abre novos comandos automaticamente. Operador com execução ativa/pausada continua vendo essa execução.
- O campo de matrícula fica desabilitado enquanto há formulário de início/troca/pausa/baixa ou gravação. O foco periódico da matrícula só atua fora desses formulários. Sair descarta a seleção; a nova identificação inicia um contexto novo.
- QR reconhecido seleciona a ordem retornada pelo GET atual, comparando o UUID sem diferença de caixa. Exibir número/produto/quantidade/plano e direcionar o foco para a seção de etapas. O Enter da leitura não seleciona etapa, posto nem botão de produção.
- **Pesquisar ordem manualmente** consulta a lista e mantém busca sem diferença de caixa/acentos por número ou produto. Enter com QR completo nesse campo também encaminha para a identificação por ID, para não reproduzir o erro da pesquisa literal do QR.
- Atualizar a pesquisa preserva seu texto, limpa destino e consulta novamente. **Ler outra ordem** limpa busca, QR e destino e volta ao campo de leitura. Nova seleção de ordem/etapa remove o posto anterior; posto único é selecionado automaticamente após escolher etapa.
- Erros de consulta oferecem nova tentativa somente de GET. Ordem ausente mantém o operador identificado e informa indisponibilidade sem presumir conclusão. HTTP 401/503 mantém a recuperação do acesso ao terminal.
- A consulta usa um controle de pedidos próprio, reutilizando `criarControleRequisicoesIlha`. Ele impede Enter repetido, aborta consultas ao cancelar/desmontar e ignora sucesso/erro/finalização anteriores. A alteração do foco não invalida pedidos de produção do controle principal.
- O estado de seleção é atualizado conjuntamente por um reducer puro. Confirmação exige ordem e etapa presentes, etapa permitida e posto compatível, além de ausência de consulta, erro ou gravação. Selecionar ordem pelo QR não envia POST.
- A validação de disponibilidade é uma fotografia da consulta; os comandos do servidor continuam responsáveis por validar novamente as regras na confirmação.

## Validação e aceite

### Automatizada da entrega 1

`tests/unit/production-orders/ficha-ordem.test.ts`: formato permanente; leitura atualizada por ID; uso da versão vinculada mesmo com outra versão disponível; transporte GET autenticado/sem cache; renumeração; emissão com execuções/roteiro inativo; ausência de ordem; incompatibilidade, etapas repetidas e dados malformados; 401/403 em ambas as consultas; cancelamento da consulta/geração; nova tentativa; nomes extensos e 80 etapas; PNG real de 1024 px.

Os testes existentes dos crachás verificam a preservação da matrícula e da geração após extração do gerador técnico comum. São testes com fetch simulado e PNG real, sem banco, montagem dos componentes React ou validação física do QR.

### Conferência manual da ficha

1. No painel, abrir Ficha com QR de uma ordem e conferir todos os campos e a sequência das etapas. Verificar uma ordem de versão anterior após existir uma nova versão vigente.
2. Conferir Escape, retorno do foco, fechamento durante consulta lenta, erro e repetição. Conferir 375px, 768px e desktop, nomes extensos e grande quantidade de etapas.
3. Baixar o PNG e ler com o Vinik 2DYN no Bloco de Notas. Esperado: `GUNP-OP-` seguido do UUID, em maiúsculas, com Enter final conforme configuração já testada do equipamento. A decodificação independente continua necessária.
4. Abrir impressão, conferir somente a ficha, A4, QR inteiro de 40 mm e paginação sem conteúdo cortado. Salvar em PDF ou imprimir com dados de desenvolvimento autorizados e testar a leitura em papel.
5. Reabrir após renumeração autorizada: número impresso atualizado e código lido idêntico. Não alterar dados da equipe somente para preparar esse teste.
6. Fechar a ficha e conferir impressão de crachá e de indicadores de forma independente.

Executar suíte, lint, typecheck e build por entrega. Caso dependências mudem em trabalho posterior, validar lockfile com npm 10 antes de enviar ao CI. Não executar migrations nem seed para esta funcionalidade.

### Evidências — 03/11/2026

- Treze testes novos de ficha e nove regressões de crachá aprovados. Suíte completa: 289 aprovados e 7 opcionais ignorados (HTTP e PostgreSQL embarcado), sem acesso ao banco.
- Lint, typecheck e build de produção aprovados. Build com configuração fictícia de banco e acesso de rede para baixar fontes; nenhuma migration ou seed executado.
- Context7 consultado para `/soldair/node-qrcode`. Não houve instalação de dependências nem alteração de manifest/lockfile.
- Leitura do crachá do operador com Vinik 2DYN confirmada pelo usuário em 03/11/2026. Essa confirmação não substitui o aceite da nova ficha de ordem.
- Inspeção da nova ficha em navegador, foco/teclado, download, paginação e decodificação da ficha com leitor precisam de evidência própria antes de avançar.
- Tentativa de listar os navegadores nesta entrega retornou **The browser access host is unavailable**. Não houve interação na página; os testes automatizados não substituem essa validação.

### Evidências da entrega 2 — 03/11/2026

- A captura enviada pelo usuário mostrou `GUNP-OP-C6EB45DE-C043-4F93-9C83-EECFC5741E95` corretamente lido, porém recebido pela pesquisa literal por número/produto da versão anterior. A correção interpreta o tipo do código e consulta pelo UUID. Isso confirma a leitura da imagem exibida, sem comprovar impressão ou apontamento integrado.
- Quatorze testes novos em `tests/unit/executions/ordem-por-qr.test.ts` aprovados; suíte completa com 303 aprovados e 7 opcionais ignorados. Cobrem formato, caixa/terminador, ID e número renomeado, GET autenticado sem cache, QR inválido, indisponibilidade, falha de rede/acesso/DTO, Enter repetido, cancelamento, resposta antiga durante consulta nova, limpeza do destino, posto único/múltiplos, regras de troca e alternativa manual.
- São testes das funções de seleção/consulta e do controle de pedidos usado pela interface, com fetch simulado; não montam componentes React nem validam fisicamente foco, clique, Enter ou responsividade. Context7 consultado para React antes da alteração dos componentes.
- Lint, typecheck e build de produção aprovados após a integração. Build com configuração fictícia de banco e fontes externas; nenhuma gravação de produção executada para validar o fluxo.
- Manifest e lockfile preservados. Nenhuma alteração de API, banco, migration ou seed. A validação no navegador permanece pendente pela indisponibilidade do host já registrada nesta sessão.

### Roteiro de aceite do fluxo na ilha

1. Atualizar a página e identificar operador ativo sem execução. Confirmar abertura automática e foco no campo **Leia o QR da ordem**, com matrícula indisponível durante a seleção.
2. Ler a ficha e conferir o número/resumo, as etapas e ausência de execução iniciada. Escolher etapa, conferir posto único/múltiplos e confirmar somente quando desejar registrar produção em ambiente autorizado.
3. Ler outro QR, escolher outra ordem pela pesquisa manual e atualizar a lista; conferir etapa/posto anteriores limpos. Conferir Enter com QR na pesquisa manual e busca normal por produto/número.
4. Conferir crachá no campo de ordem, QR inválido/concatenado e ordem indisponível, mantendo operador e sem gravação. Repetir Enter durante consulta lenta; cancelar, Sair e Bloquear durante GET e conferir respostas antigas descartadas.
5. Identificar operador com execução ativa/pausada e conferir sua situação sem nova seleção automática. Na troca permitida, conferir etapa atual bloqueada na ordem original e mesma etapa disponível em outra ordem, respeitando baixa/postos.
6. Conferir recuperação após falha de gravação, validação de entrada mantendo formulário, foco/teclado e telas de 375px, 768px e desktop. As leituras devem ocorrer no campo indicado; entrada HID em outros controles continua fora do suporte de captura global.
