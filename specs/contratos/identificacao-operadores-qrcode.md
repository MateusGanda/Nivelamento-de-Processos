# Identificação de operadores por QR Code

Versão 1.0 — 02/11/2026. Contrato aprovado para entregas separadas: crachá individual, impressão em lote e leitura USB. Esta implementação abrange somente o crachá individual.

## Identidade e conteúdo

- O QR contém **exatamente `Operador.matricula`**, como texto, sem prefixo, URL, UUID, chave da ilha ou dados adicionais. Não normalizar nem converter matrículas antigas.
- A matrícula continua única e permanente conforme [Operadores e Setores](operadores-setores.md). Mudança de nome, função ou setor não altera o QR. Reimprimir a mesma matrícula mantém o conteúdo.
- Nome e setor principal impressos são os atuais, consultados antes de preparar o crachá. Sem vínculo, mostrar **Sem setor definido**. O setor que aparece dentro de uma matrícula pode representar sua origem.
- QR identifica, não autentica nem concede acesso administrativo. A API da ilha continua exigindo o terminal autorizado e operador ativo.
- Não há token revogável, validade, histórico de emissão, armazenamento de imagem ou campo novo. Perder um crachá não permite revogar somente aquela cópia: outra impressão tem o mesmo QR. A inativação recusa a identificação do operador, inclusive manual.

## Entrega 1 — crachá individual

### Acesso e consulta

- A ação **Crachá** fica na listagem `/painel/operadores`, indisponível para inativos e enquanto a lista/status está sendo atualizado.
- Ao abrir e ao tentar novamente, usar o GET `/api/operadores` existente, com `credentials: same-origin`, `cache: no-store` e cancelamento. Selecionar pelo ID; não emitir a partir da cópia antiga da linha.
- A página e o GET mantêm a autorização existente por ADMIN ativo no servidor. Não criar endpoint público, usar a API da ilha para emitir ou consultar Prisma na interface.
- Se o registro não for encontrado ou estiver inativo na consulta atualizada, mostrar erro e não gerar imagem. 401/403 fecha a prévia e encaminha para login, conforme o cliente administrativo existente.
- Fechar, Escape, navegar ou repetir a consulta cancela/descarta a resposta anterior, inclusive se a geração local terminar depois. Uma falha nunca mostra o crachá de outro pedido.
- A consulta confirma o estado no momento da preparação; não é uma reserva de emissão. Se houver inativação posterior, o QR impresso permanece, mas a ilha recusará seu uso.

### Apresentação e arquivos

- Dialog nativo com nome acessível, botão Fechar, carregamento, erro e **Tentar novamente**. O foco começa no botão Fechar e retorna à ação de origem ao fechar.
- Prévia com marca GUNP, nome, matrícula, setor principal atual e QR; sem foto, função, campos novos ou alteração do cadastro.
- Cartão horizontal de 86 × 54 mm na impressão; prévia reduz proporcionalmente em telas pequenas. QR de aproximadamente 32 mm, preto sobre branco opaco, margem livre de quatro módulos e correção de erros Q.
- Usar `qrcode` 1.5.4, com tipos `@types/qrcode` 1.5.6, carregado sob demanda no navegador. Gerar PNG local de 1024 × 1024 pixels, compartilhado pela prévia, download e impressão, sem serviço externo.
- **Baixar QR em PNG** baixa somente a imagem do QR, com nome baseado no ID interno e sanitizado para arquivo. Não é download da composição inteira do crachá.
- **Imprimir crachá** abre a impressão do navegador, permitindo também salvar em PDF. Não gerar PDF com biblioteca própria. Orientar escala de 100% e desativação dos cabeçalhos e rodapés.
- Imprimir apenas o cartão, isolado do painel/dialog e dos estilos do relatório de indicadores. Remover o estado de impressão ao fechar ou sair da tela.
- Aguardar a imagem carregar antes de habilitar download e impressão. Bloquear a impressão se nome, matrícula ou setor não couberem completos; explicar e manter o download do QR para montar um cartão maior. Não cortar silenciosamente os dados nem alterar o conteúdo codificado para fazê-lo caber.

### Compatibilidade e persistência

Não há alteração de DTO, endpoint, schema, migration, seed, matrículas, relacionamentos ou execução. A restrição de emissão na UI não é uma nova credencial: qualquer leitor pode reproduzir o texto de uma matrícula, e a validação operacional continua no servidor.

## Próximas entregas aprovadas, ainda não implementadas

Prioridade atualizada pelo usuário em 03/11/2026: identificação por crachá com o Vinik 2DYN confirmada. Antes da impressão em lote, entregar e validar a ficha individual da ordem e depois integrar a leitura dela à ilha, conforme [QR Code das ordens](identificacao-ordens-qrcode.md). A confirmação do leitor não comprova todas as verificações visuais/de impressão listadas abaixo.

### Entrega 2 — impressão em lote

Selecionar somente ativos; selecionar todos abrange ativos visíveis. Busca, filtro ou recarga limpa a seleção. Consultar novamente os dados antes da prévia e exigir revisão se algum selecionado ficar indisponível/inativo. Preparar todos os QR antes de imprimir, até oito cartões por A4 (duas colunas), com recorte e sem dividir cartões entre páginas. Validar separadamente antes de avançar.

### Entrega 3 — leitura USB

Equipamento informado pelo usuário: Vinik 2DYN. Planejado modo teclado USB HID, com leitura somente na área de identificação e campo de matrícula em foco. Verificar fisicamente Enter final e layout de teclado; configuração deve seguir o manual do aparelho. Sem Enter, preservar o botão Identificar.

Indicar prontidão somente com campo disponível/focado. A leitura consulta a situação; nunca inicia, pausa, retoma, troca ou finaliza automaticamente. Manter entrada manual, evitar concatenação de leituras e preservar as proteções de requisições/recuperação. Durante formulários, requisições e bloqueio, a identificação ficará indisponível; cancelar ou concluir o formulário antes de trocar de operador.

Não haverá captura global nem identificação por velocidade das teclas. Sem prefixo configurado, HID é entrada de teclado: leitura fora do campo pode atingir outro controle e fica fora do suporte inicial. Não prometer isolamento global do leitor. A entrega 1 não altera o foco nem o comportamento atual da ilha.

## Validação da entrega 1

Testes em memória (`tests/unit/operators/cracha-operador.test.ts`): consulta atualizada pelo ID, transporte autenticado sem cache, preservação de matrículas atuais/legadas/Unicode, transferência sem recálculo, ausência de setor, recusa de inativo/indisponível, 401/403, falha de rede, cancelamento da consulta/geração, nova tentativa, erro técnico sem detalhes internos e PNG real de 1024 pixels.

Roteiro de aceite manual, com dados de desenvolvimento autorizados:

1. Em Operadores, abrir Crachá de um ativo e conferir nome, matrícula e setor; reabrir após edição/transferência. Não alterar dados da equipe apenas para preparar o teste.
2. Conferir inativos com emissão indisponível e ativo antigo sem setor exibindo Sem setor definido.
3. Navegar por teclado, testar Escape/retorno do foco e fechar durante consulta lenta. Verificar erro e nova tentativa sem reaparecer prévia anterior.
4. Baixar PNG, decodificar com leitor/decoder e comparar a matrícula inteira, inclusive números e pontuação legados. A verificação automática do PNG não substitui a decodificação independente.
5. Conferir em 375px, 768px e 1440px. Verificar nomes extensos, matrícula/setor longos, carregamento/falha da imagem e bloqueio de impressão por falta de espaço.
6. Abrir impressão e conferir um único cartão de 86 × 54 mm, QR sem corte e ausência de menu/tabela/dialog. Cancelar e voltar ao painel; conferir que a impressão de indicadores continua independente.
7. Antes da integração USB ser considerada concluída, ler o QR na tela e em papel com o Vinik 2DYN. Essa validação física pertence à entrega 3.

Executar suíte, lint, typecheck e build; registrar resultados e limitações abaixo. Não aplicar migrations nem executar seed.

### Evidências — 02/11/2026

- Nove testes novos aprovados; suíte completa com 276 aprovados e 7 opcionais ignorados (HTTP e PostgreSQL embarcado). Os testes usam fetch simulado e geração PNG real, sem banco.
- Lint, typecheck e build de produção aprovados. Build com configuração fictícia de banco e acesso de rede para fontes. As versões das dependências existentes foram preservadas; o npm deduplicou entradas de tipos no lockfile.
- Context7 consultado para `/soldair/node-qrcode` e `/reactjs/react.dev` antes da implementação e do ajuste de estado do diálogo.
- A automação do Chrome foi interrompida por não conseguir confirmar a URL atual com segurança; não houve interação na página. Validação visual, foco/teclado, download pelo navegador, prévia de impressão e decodificação independente permanecem pendentes.
- Nenhuma migration ou seed executado. Impressão em lote e integração do leitor não fazem parte desta entrega.
