# Primeira entrega de Mateus — indicadores

Entrega inicial preparada em 26/09/2026 para o marco de 29/09. Não é o sistema completo.

Este módulo implementa funções de cálculo em TypeScript, sem dependências externas, banco ou framework. Foi separado para não interferir na estrutura que Arthur criará. Base: `../specs/MVP_APONTAMENTO.md` e `../specs/TAREFAS_11_SEMANAS.md`.

## Como executar

Abra esta pasta no terminal do editor. Com Node.js 22.18.0 ou superior:

```powershell
npm.cmd test
npm.cmd run demo
```

Não é necessário instalar pacotes para esses comandos. No Linux/macOS, use `npm` no lugar de `npm.cmd`. A execução usa remoção nativa de anotações TypeScript; **não substitui a checagem estática com TypeScript**. Essa checagem deve entrar na configuração do projeto compartilhado.

## O que já funciona

- Tempo produtivo, apoio/preparação, interrupção e pausa prevista, separados por categoria.
- Recorte de intervalos ao período selecionado.
- Exclusão de pausas programadas tanto do numerador quanto do denominador da cobertura.
- Tempo sem informação e cobertura dos registros.
- Tempo médio produtivo por par bom, pela razão entre totais.
- Carga prevista e ocupação planejada do posto.
- Previsto, realizado bom, saldo e cumprimento.
- Validações para sobreposição, datas inválidas, valores negativos, quantidades fracionárias e denominador zero.

Os 15 testes automatizados passaram no ambiente local em 26/09/2026, com Node.js 22.18.0. Isso é evidência de testes unitários, não de integração ou validação na fábrica.

## Como demonstrar ao professor

Execute os testes e, em seguida, a demonstração. Explique estes resultados fictícios:

| Caso | Resultado esperado |
| --- | --- |
| Execução 08:00–08:40, interrupção 08:40–08:50, execução 08:50–09:30 | 80 min produtivos e 10 min de interrupção |
| Mesmas execuções encerradas com 40 pares bons | 120 s/par |
| Consulta restrita a 08:30–09:00 | 20 min produtivos e 10 min de interrupção |
| Janela disponível 08:00–10:00 | 30 min sem informação; cobertura 75% |
| Plano: 240 pares a 120 s/par; disponibilidade 420 min | 480 min de carga; ocupação planejada 114,29% |

A carga acima de 100% indica incompatibilidade entre o plano e a disponibilidade assumida. Não prova gargalo observado nem redução de desperdícios. Tempo não produtivo apontado não é necessariamente perda evitável.

## Cuidados de integração

- `calcularTempos` recebe registros de **um operador por vez**, inclusive quando ele troca de posto/operação. Não enviar vários operadores como se fossem uma única linha do tempo.
- Janelas representam disponibilidade previamente definida. Sem janela, enviar `null`; lista vazia representa disponibilidade zero.
- A versão inicial só processa intervalos encerrados. Não omitir silenciosamente intervalos abertos: a API futura deve informar a pendência. O suporte a resultados provisórios ainda será implementado.
- A API de Gustavo deverá fornecer eventos consistentes; um adaptador futuro converterá eventos em intervalos. Não há reconstrução de eventos nesta entrega.
- Para médias por par, selecionar as mesmas execuções encerradas no numerador e denominador, do mesmo produto/operação. Não dividir o tempo recortado por toda a quantidade de um lote.
- Para produção em um período, selecionar baixas pela ocorrência. Não somar corte e costura para obter quantidade final da linha.
- A função de produção recebe totais já corrigidos. Idempotência, auditoria, permissões e integridade do banco permanecem na API, não nestas funções.
- Carga exige plano, tempo de referência e disponibilidade do mesmo recurso/período. Uma referência ausente torna a carga indisponível.
- Usar segundos por par; não assumir a unidade das fichas manuscritas. Arredondar só na exibição.
- Strings de código devem preservar zeros iniciais. Não são convertidas em números neste módulo.

## Sua sequência de trabalho

1. Execute `test` e `demo` e confira os resultados acima.
2. Leia as funções e consiga explicar principalmente cobertura, média por par e carga prevista.
3. Compartilhe o módulo com Arthur e Gustavo; confirme os contratos e dados necessários antes de ligar ao banco.
4. Com a aplicação do Arthur disponível, integre as funções à camada de serviços; depois adicione a rota de indicadores com autenticação e validação.
5. Implemente o painel descrito em `PAINEL_E_INTEGRACAO.md`, primeiro com amostra explicitamente fictícia, depois com API real.
6. Registre a entrega em commit no repositório compartilhado após revisão. Nenhum commit ou publicação foi feito nesta pasta.

Não é necessário aguardar o leitor. Ele pertence à frente de Gustavo. A próxima entrega de Mateus é o painel no projeto compartilhado; não criar uma segunda aplicação Next.js independente.
