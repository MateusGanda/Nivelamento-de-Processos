# Login administrativo do GUNP

## Apresentação

`/login` usa o NextAuth v4 com matrícula administrativa e senha. `/painel` verifica a sessão e a conta ADMIN ativa no servidor antes de apresentar nome, matrícula e logout. `/` direciona para uma dessas páginas conforme a condição de acesso. Não há cadastro público, recuperação de senha nem acesso da ilha nesta interface.

A interface usa Geist, Tailwind e Lucide React. A partir de 1024px, o login apresenta duas colunas. Abaixo dessa largura, exibe somente marca e formulário. O fundo grafite e a cor de destaque `#FF7A21` não dependem da preferência de tema do navegador.

O conjunto de login tem largura máxima de 400px e fica centralizado vertical e horizontalmente. Título e texto de apoio são centralizados; labels e entradas permanecem alinhados à esquerda. O padding vertical é de 24px no mobile/tablet e 32px no desktop, com 32px entre marca e título e 24px até o formulário.

A variante `login` da marca usa engrenagem de 56px/64px e nome de 40px/48px, conforme o breakpoint de 640px. Título de 24px/28px, texto de apoio de 14px e inputs de 16px. Campos e botão de entrada têm altura de 48px, o espaçamento entre campos é de 16px e o botão Mostrar/Ocultar senha mantém área clicável de 44px. As versões da marca usadas pelo painel e pela tela de erro preservam os tamanhos anteriores.

Na marca do login, os intervalos entre engrenagem, nome e subtítulo são de 8px, com subtítulo em linhas de 16px. Labels ficam 4px acima dos campos e mensagens de erro usam padding vertical de 8px para limitar o crescimento do conjunto sem ocultar conteúdo.

Somente o contêiner principal tem altura mínima de viewport. A coluna institucional reduz o padding vertical de 80px para 24px quando a altura da janela é de até 760px. A página não bloqueia o overflow vertical: quando a altura, o zoom ou as mensagens exigirem mais espaço, os controles continuam acessíveis por rolagem da página.

## Imagem e origem

Arquivo consumido: `public/images/login-industrial.png`.

Imagem criada com o skill `imagegen`, pela ferramenta de geração integrada (sem CLI ou chave de API própria). A referência fornecida pela equipe orientou a estética; a imagem gerada contém somente a fábrica. Marca, textos, controles e ícones são renderizados pela aplicação. A fotografia é decorativa, com texto alternativo vazio e sobreposição escura.

Prompt utilizado:

```text
Use case: photorealistic-natural. Asset type: decorative industrial background photograph for the right half of the GUNP login page. Generate only the photograph, never a UI mockup. Interior of a real manufacturing workshop with a production line, steel structural beams, overhead industrial lamps, workstations and metal machinery. Muted cool steel gray and graphite palette, soft natural overhead light, subtle realistic material texture. Portrait-oriented composition suitable for a tall half-screen panel, with quiet negative space around the middle-left for HTML text added later; machinery and recognizable structural detail toward the edges. Understated professional industrial mood, realistic photography rather than sci-fi or glossy concept art. No people, no text, no lettering, no logos, no trademarks, no watermarks, no borders. Keep enough tonal detail in the factory so it remains identifiable after a dark CSS overlay.
```

## Verificação manual

Com `npm run dev` em execução, abrir `/login` em 1440×900, 1366×768 e 1366×640. Confirmar centralização e ausência de rolagem vertical nos estados normal e de erro. Em 375×667 e 768×1024, confirmar formulário utilizável e ausência de rolagem horizontal. A coluna institucional aparece somente no desktop.

Em janelas com altura de 480px e zoom de 200%, confirmar que a rolagem da página permite alcançar a marca, os campos, mensagens e botão Entrar, sem cortes ou áreas de rolagem internas no formulário.

Verificar navegação com Tab, foco visível, envio por Enter, campos obrigatórios, botão Mostrar/Ocultar senha, estado Entrando e mensagens de falha. Após login válido, confirmar `/painel`, identificação e logout. Sem sessão, `/painel` deve direcionar para `/login` e `/api/usuarios` deve retornar 401.

Os testes HTTP documentados em `TECHNOLOGY.md` verificam autenticação, logout, redirecionamentos e proteção de acesso sem alterar usuários. Não substituem a inspeção visual ou os testes de teclado em navegador. O cenário HTTP de conta inativa é ignorado quando não há uma conta já inativa para teste.
