# Task: apresentação, login e consulta de produtos

Solicitação de Arthur em 09/10/2026: iniciar estrutura com apresentação, login, menu e uma rota de API ligada ao banco.

Decisão desta entrega: usar conta inicial em variáveis de ambiente, sem tabela de usuários e sem confundir autenticação com Operador. A entidade de usuários, os perfis e o método definitivo de autenticação permanecem pendentes para a equipe. A configuração inicial é explicitada em docs/TELA_INICIAL_E_LOGIN.md.

Escopo: apresentação pública; login e logout; painel protegido; consulta autenticada e somente leitura de Produto via Prisma 8. A consulta pertence à Infrastructure; handler e UI pertencem à Presentation. Não há regra de negócio nova que exija use case ou camada de Domain para esta leitura.

Resposta 200 de GET /api/produtos: `{ "produtos": [{ "id": "uuid", "codigo": "P001", "nome": "Produto" }], "limite": 100 }`. Lista ordenada por código; vazia é válida. Erros locais da task: `{ "error": "mensagem" }`, com 400 para entrada inválida, 401 para ausência/invalidade de sessão ou credenciais, 403 para origem inválida nos POSTs, 429 para limite de tentativas e 503 para configuração/consulta indisponível. Não constitui padrão transversal para outras tasks.

Aceite: menu navegável; login com conta configurada; senha incorreta rejeitada; sessão adulterada ou vencida rejeitada; painel/API protegidos; lista real ou vazia sem dados fictícios; falha de banco explicada; logout; interface responsiva. Não alterar migrations ou executar escritas no banco da equipe.
