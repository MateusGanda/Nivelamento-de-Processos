# Contrato do painel de TV

Versão 1.0, de 09/11/2026. Responsável: Mateus.

**Status: implementado na branch `feat/painel-tv`.** A migration `20261109T0323_add_dispositivo` ainda não foi aplicada no banco do site. Ela só pode ser aplicada antes do merge e com autorização da equipe.

O painel de TV é uma tela de gestão à vista para o chão de fábrica. Ela mostra a situação dos postos, a produção do dia e a carga pendente por posto. Cada TV é um dispositivo cadastrado pelo administrador. Ela se identifica com um código próprio e envia um sinal de conexão a cada atualização. Assim, o painel mostra se cada TV está online.

A proposta veio do coordenador (Prof. Aldriano) e foi aprovada pela equipe para a etapa 9. A tela só mostra informações e não registra apontamentos.

## Entidade `Dispositivo`

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | uuid | chave primária |
| `nome` | texto | obrigatório, único, até 120 caracteres |
| `local` | texto opcional | até 120 caracteres (ex.: "Parede da montagem") |
| `setorId` | uuid opcional | setor exibido; sem setor, a TV mostra todos os postos ativos |
| `codigoHash` | texto | único; resumo SHA-256 do código de acesso, nunca o próprio código |
| `ativo` | booleano | TV desativada perde o acesso na próxima atualização |
| `ultimaConexaoEm` | data e hora opcional | última busca de dados da TV |
| `createdAt`, `updatedAt` | data e hora | padrão dos cadastros |

Relação: `Setor → Dispositivo`, 1:N (opcional).

## Código de acesso

- O código é gerado pelo servidor e tem 10 caracteres em dois blocos (`ABCDE-FGH23`). O alfabeto não tem letras nem números que se confundem (`I`, `O`, `0`, `1`).
- O código aparece só no cadastro e ao gerar um código novo. O banco guarda apenas o resumo (`sha256("gunp-tv-v1:" + código)`).
- A tela aceita o código com ou sem hífen, com espaços e em minúsculas.
- Gerar um código novo invalida o anterior e zera a última conexão: a TV antiga perde o acesso na próxima atualização.
- Um código errado recebe resposta depois de 0,8 s, como na chave da ilha.

## Rotas do administrador

Todas as rotas exigem administrador ativo, como os cadastros. Os erros seguem o padrão `{ erro: { codigo, mensagem } }`. Corpos com campos não previstos são recusados com `400`.

| Rota | Corpo | Resposta |
| --- | --- | --- |
| `GET /api/dispositivos` | — | lista com `conexao` (`ONLINE`, `OFFLINE`, `NUNCA_CONECTOU`) |
| `POST /api/dispositivos` | `{ nome, local?, setorId? }` | `201 { dispositivo, codigo }` |
| `PATCH /api/dispositivos/[id]` | `{ nome?, local?, setorId? }` | dispositivo |
| `PATCH /api/dispositivos/[id]/status` | `{ ativo }` | dispositivo |
| `POST /api/dispositivos/[id]/codigo` | — | `{ dispositivo, codigo }` |

- Nome repetido: `409 CONFLITO`. Setor inexistente: `400 ENTRADA_INVALIDA`. Dispositivo inexistente: `404 NAO_ENCONTRADO`.
- **Online:** a última conexão foi há até 45 s, o equivalente a três atualizações da TV. **Offline:** já conectou, mas passou desse tempo. **Nunca conectou:** ainda não recebeu nenhuma conexão.

## Rotas da TV

As rotas da TV não usam a sessão administrativa nem o cookie da ilha.

- `POST /api/tv/acesso` com `{ codigo }`. Se o código estiver certo e a TV ativa, a resposta é `204`, grava o cookie `gunp_tv` e registra a conexão. O cookie é HttpOnly, SameSite=Strict, Secure em produção e dura 365 dias. Com código errado ou TV desativada, a resposta é `401 NAO_AUTENTICADO`, depois de 0,8 s.
- `DELETE /api/tv/acesso` apaga o cookie (`204`).
- `GET /api/tv/painel` exige o cookie de uma TV ativa; sem ele, a resposta é `401`. Cada chamada também registra a conexão. Para não gravar no banco a cada segundo, a conexão só é gravada se a anterior tiver mais de 10 s. Todas as respostas usam `Cache-Control: no-store`.

```json
{
  "meta": { "consultadoEm": "2026-11-09T14:05:00.000Z", "intervaloSegundos": 15 },
  "dispositivo": { "nome": "TV da Montagem", "local": "Parede da montagem", "setor": "Montagem" },
  "postos": [{
    "codigo": "MON-01", "nome": "Montagem 1", "setor": "Montagem", "situacao": "PAUSADA",
    "execucoes": [{
      "id": "uuid", "status": "PAUSADA",
      "ordem": { "numero": "OP-0004", "quantidade": 50, "unidade": "un" },
      "produto": { "codigo": "PRD-002", "nome": "Produto B" },
      "etapa": { "ordem": 2, "operacao": "Montagem" },
      "tempoPadraoSegundos": 45,
      "eventos": [{ "tipo": "INICIO", "dataHora": "2026-11-09T11:30:00.000Z", "motivo": null }]
    }]
  }],
  "producaoHoje": { "pecasBoas": [{ "produtoCodigo": "PRD-001", "unidade": "un", "quantidadeBoa": 28 }], "baixas": 3 },
  "cargaPorPosto": [{ "codigo": "MON-01", "nome": "Montagem 1", "segundos": 1800, "percentual": 60 }]
}
```

- **Sem dados de pessoas:** a resposta não traz nome nem matrícula de operador. A tela fica em local público, e o tempo mostrado é o da execução, não o desempenho de uma pessoa.
- **Postos:** a lista traz os postos ativos do setor da TV, ou todos, quando a TV não tem setor, em ordem de código. A situação do posto é `EM_EXECUCAO` quando há alguma execução em andamento nele. Se houver só execuções pausadas, é `PAUSADA`. Sem execuções abertas, é `LIVRE`.
- **Produção de hoje:** peças boas e baixas desde a meia-noite, no horário de Brasília. Usa a mesma consulta dos indicadores.
- **Carga por posto:** a carga pendente vem dos indicadores. A lista traz só os postos com carga e começa pela maior.

## Tela

- `/tv` fica fora do painel. Sem o cookie de uma TV ativa, a tela pede o código. Com o cookie, mostra o painel em tela cheia, com letras proporcionais à largura e sem cursor.
- O cabeçalho mostra o nome da TV, o setor e o relógio. Em seguida vêm o resumo (em execução, pausados e livres), os cartões dos postos, a produção de hoje e as barras da carga por posto.
- O cartão do posto mostra a ordem, o produto, a etapa, o tempo produtivo até agora e, na pausa, o motivo. Os sinais de atenção ("acima do previsto", "iniciada em outro dia") seguem a regra da página Execuções.
- Os dados são atualizados a cada 15 s. Se uma atualização falhar, a tela mantém os dados anteriores e avisa de quando eles são. Se a TV perder o acesso, a tela volta a pedir o código.
- São 9 postos por página. Quando há mais postos, as páginas se alternam a cada 20 s. A tela pede ao navegador para não apagar (Wake Lock) e se recarrega a cada 6 h.

## Página do administrador

`/painel/tvs` (item **TVs** do menu, grupo Produção) lista as TVs com setor, local, situação da conexão, última conexão e status. A lista se atualiza a cada 15 s. Ações: cadastrar, editar, gerar novo código, desativar ou ativar, e abrir a tela da TV em outra aba.

## Fora deste contrato

- Sensores, CLPs e integração com máquinas. Ficam como trabalho futuro de IIoT, fora do MVP.
- Controlar a TV a distância, por exemplo trocar a página ou desligar.
- Mais de um código por TV, ou validade do código. O código vale até ser trocado ou até a TV ser desativada.
