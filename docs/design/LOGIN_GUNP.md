# Login administrativo do GUNP

## Apresentação

`/login` usa o NextAuth v4 com matrícula administrativa e senha. `/painel` verifica a sessão e a conta ADMIN ativa no servidor antes de apresentar nome, matrícula e logout. `/` direciona para uma dessas páginas conforme a condição de acesso. Não há cadastro público, recuperação de senha nem acesso da ilha nesta interface.

A interface usa Geist, Tailwind e Lucide React. A partir de 1024px, o login apresenta duas colunas. Abaixo dessa largura, exibe somente marca e formulário. O fundo grafite e a cor de destaque `#FF7A21` não dependem da preferência de tema do navegador.

## Imagem e origem

Arquivo consumido: `public/images/login-industrial.png`.

Imagem criada com o skill `imagegen`, pela ferramenta de geração integrada (sem CLI ou chave de API própria). A referência fornecida pela equipe orientou a estética; a imagem gerada contém somente a fábrica. Marca, textos, controles e ícones são renderizados pela aplicação. A fotografia é decorativa, com texto alternativo vazio e sobreposição escura.

Prompt utilizado:

```text
Use case: photorealistic-natural. Asset type: decorative industrial background photograph for the right half of the GUNP login page. Generate only the photograph, never a UI mockup. Interior of a real manufacturing workshop with a production line, steel structural beams, overhead industrial lamps, workstations and metal machinery. Muted cool steel gray and graphite palette, soft natural overhead light, subtle realistic material texture. Portrait-oriented composition suitable for a tall half-screen panel, with quiet negative space around the middle-left for HTML text added later; machinery and recognizable structural detail toward the edges. Understated professional industrial mood, realistic photography rather than sci-fi or glossy concept art. No people, no text, no lettering, no logos, no trademarks, no watermarks, no borders. Keep enough tonal detail in the factory so it remains identifiable after a dark CSS overlay.
```

## Verificação manual

Com `npm run dev` em execução, abrir `/login` nas larguras 375px, 768px e 1440px. Confirmar que não há rolagem horizontal, que os campos permanecem acessíveis em telas baixas e que a coluna institucional aparece somente no desktop.

Verificar navegação com Tab, foco visível, envio por Enter, campos obrigatórios, botão Mostrar/Ocultar senha, estado Entrando e mensagens de falha. Após login válido, confirmar `/painel`, identificação e logout. Sem sessão, `/painel` deve direcionar para `/login` e `/api/usuarios` deve retornar 401.

Os testes HTTP documentados em `TECHNOLOGY.md` verificam autenticação, logout, redirecionamentos e proteção de acesso sem alterar usuários. Não substituem a inspeção visual ou os testes de teclado em navegador. O cenário HTTP de conta inativa é ignorado quando não há uma conta já inativa para teste.
