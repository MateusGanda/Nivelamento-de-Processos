# Painel inicial administrativo do GUNP

## Escopo

`/painel` é a tela de início após o login, com boas-vindas, menu lateral e dez cartões de módulos. Não apresenta dashboard, números fictícios, listagens, formulários ou comandos de produção. O item Usuários não faz parte desta entrega.

O menu contém Início; Cadastros (Produtos, Operações, Setores, Postos, Operadores e Motivos de Pausa); Produção (Roteiros, Planos de Produção, Ordens de Produção e Execução); e Relatórios (Indicadores). Indicadores aparece somente no menu lateral. Menu, cartões e páginas provisórias usam os metadados de `modules/access/presentation/painel-navigation.ts`.

Os onze destinos de módulos sob `/painel/[modulo]` mostram título, ícone, descrição, aviso de implementação futura e link Voltar ao início. Slugs desconhecidos retornam 404. Execução é um destino administrativo provisório, sem acesso operacional à ilha.

## Apresentação

Manter Geist, Lucide, grafite e laranja `#FF7A21`. A marca do painel usa engrenagem à esquerda de GUNP, preservando as variantes do login e da tela de erro. O banner de boas-vindas contém uma engrenagem SVG decorativa, sem outro asset de imagem.

A partir de 1024px, o menu tem largura de 260px, recolhível para 80px. O estado fica somente em memória e inicia expandido. Os itens recolhidos mantêm nomes acessíveis e tooltip nativo. O cabeçalho tem 64px. Menu e conteúdo têm rolagem independente, sem impor altura aos cartões. A grade usa uma coluna, duas a partir de 640px e três a partir de 1280px.

No mobile/tablet, o drawer começa fechado e é aberto pelo cabeçalho. Um dialog modal nativo contém o menu e restringe o foco ao drawer. A seleção de um link, clique no backdrop ou Escape fecha o menu e devolve o foco ao botão de abertura. Ao passar para desktop, o drawer aberto é fechado para não deixar o restante da página inacessível.

O cabeçalho usa nome e matrícula reais, com avatar de iniciais. O disclosure de identificação contém Administrador e o logout existente. Fecha com Escape, clique fora ou navegação; não inclui perfil, configurações ou troca de senha.

## Proteção e arquitetura

`app/painel/layout.tsx` fornece a estrutura compartilhada. Início e páginas provisórias também verificam sessão e ADMIN ativo no servidor, reutilizando o módulo de acesso. Falhas de infraestrutura seguem para o tratamento de erro existente. Somente nome e matrícula são enviados ao componente interativo do cabeçalho; não enviar senhaHash ou segredos.

Não há novas dependências, APIs, modelos ou migrations. Os componentes são Presentation, e nenhum deles acessa Prisma ou dados de produção. Os links não antecipam carregamento de páginas protegidas por prefetch.

## Verificação

Executar lint, typecheck, testes e build. Os testes HTTP opt-in verificam os onze destinos, slug desconhecido, login, logout, ausência/invalidade de sessão e conta inativa quando existir uma conta preparada, sem modificar usuários.

Inspecionar 375×667, 768×1024, 1366×768 e 1440×900: ausência de rolagem horizontal, acesso a todos os itens, grade responsiva, menu recolhido/expandido e drawer mobile. Verificar teclado, foco visível, Escape, clique fora, retorno de foco, disclosure e logout. Confirmar que o login permanece visualmente inalterado. Se não houver navegador disponível para automação, registrar esses cenários como pendentes, sem afirmar validação visual ou de interação.
