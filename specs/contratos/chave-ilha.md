# Contrato da chave da ilha pelo painel

Versão 1.0, de 09/11/2026. Responsável: Mateus.

**Status:** implementado na branch `feat/chave-ilha-painel`. A migration `20261109T1235_add_chave_ilha` ainda não foi aplicada no banco do site. Ela deve ser aplicada antes do merge, com autorização da equipe.

## Motivo

Até aqui, a chave do terminal da ilha ficava só na variável `ILHA_CHAVE` da Vercel. Para trocá-la, era preciso ter acesso à hospedagem e publicar o site de novo. Isso deixa o gestor dependente de quem configura o servidor.

Agora o administrador gera uma chave nova pelo painel quando ela vaza ou quando alguém que a conhecia deixa a equipe. Proposta do Gustavo, aprovada pela equipe em 04/11/2026 para a etapa 9.

## Entidade `ChaveIlha`

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | uuid | chave primária |
| `chaveHash` | texto | único; resumo SHA-256 da chave normalizada (`sha256("gunp-ilha-v2:" + chave)`), nunca a própria chave |
| `criadaPorId` | uuid | administrador que gerou a chave (`Usuario`) |
| `criadaEm` | data e hora | momento da geração |

Relação: `Usuario → ChaveIlha`, 1:N.

A tabela guarda o histórico das trocas, e vale a linha mais recente. Nenhuma linha é alterada ou apagada.

## Qual chave vale

- **Com pelo menos uma chave gerada no painel:** vale a mais recente. A variável `ILHA_CHAVE` passa a ser ignorada.
- **Sem chave no painel:** vale a `ILHA_CHAVE`, como antes. Os terminais já liberados continuam funcionando até a primeira troca pelo painel.
- **Sem nenhuma das duas:** a ilha fica sem chave e pede que um administrador gere a primeira.

## Formato da chave

- A chave é gerada pelo servidor, nunca escolhida por uma pessoa. Tem 20 caracteres em quatro blocos (`ABCDE-FGH23-JKLMN-PQRS4`), cerca de 100 bits aleatórios.
- O alfabeto não tem `I`, `O`, `0` nem `1`, que se confundem.
- Na ilha, a chave do painel é aceita com ou sem hífen, com espaços e em minúsculas. A chave da variável continua sendo comparada exatamente como foi definida.

## Cookie do terminal

- O cookie continua sendo `gunp_ilha`: HttpOnly, SameSite=Strict, Secure em produção e válido por 30 dias.
- Com a chave do painel, o valor do cookie é um HMAC-SHA256 calculado com o segredo do servidor (`NEXTAUTH_SECRET`) sobre o resumo da chave. Quem tiver só uma cópia do banco não consegue montar um cookie válido.
- A chave em uso é consultada a cada pedido da ilha. Gerar uma chave nova bloqueia todos os terminais na hora.
- Uma chave errada continua recebendo resposta depois de 0,8 s.

## Rotas do administrador

As duas rotas exigem um administrador ativo e respondem com `Cache-Control: no-store`.

| Rota | Corpo | Resposta |
| --- | --- | --- |
| `GET /api/execucoes/chave-ilha` | — | `{ origem: "PAINEL" \| "AMBIENTE" \| "NENHUMA", trocadaEm, trocadaPor }` |
| `POST /api/execucoes/chave-ilha` | vazio ou `{}` | `201 { chave, situacao }` |

- A consulta nunca devolve a chave. A chave só aparece na resposta da geração.
- Um corpo com dados recebe `400 ENTRADA_INVALIDA`, porque a chave não pode ser escolhida.
- `401` sem sessão, `403` para usuário inativo.

## Tela

**Página Execuções, bloco "Chave da ilha":**

- O bloco mostra a situação atual: chave gerada em tal data por tal pessoa, chave do servidor ou sem chave.
- O botão **Gerar nova chave** pede confirmação. O aviso diz que todos os terminais serão bloqueados e que as execuções abertas não mudam.
- A chave aparece uma única vez, com o botão **Copiar chave**, e some da tela ao fechar a janela.

**Ilha (`/ilha`):**

- O campo da chave ganhou o botão de mostrar e ocultar.
- Quando a chave em uso é do painel, aparece a dica do formato.
- Sem chave, a tela informa que o administrador precisa gerá-la em Execuções.

## Fora deste contrato

- Chave por terminal ou lista de terminais liberados. Vale uma chave para todos, como antes.
- Validade automática da chave. A chave vale até ser trocada.
