# Painel de Mateus — desenho inicial e integração proposta

Status: especificação inicial, não tela implementada nem contrato aprovado pela equipe.

## Organização da tela

Cabeçalho: “Indicadores da linha”, identificação da linha/setor, período, fuso e instante da consulta. Durante desenvolvimento, faixa permanente “Dados fictícios — demonstração”.

Filtros: período, posto, produto e operação. Cada bloco mostra a unidade, o recorte e a origem dos dados. Não misturar metas diárias com realizado de toda a ficha.

Primeira seção — produção: previsto no período, pares bons registrados no período, cumprimento e saldo da ficha/etapa selecionada. O saldo da ficha não é automaticamente o saldo do plano do dia. Identificar a diferença na legenda.

Segunda seção — tempos: produtivo apontado, apoio/preparação, interrupções e pausas previstas. Mostrar cobertura e tempo sem informação ao lado, sem rotular ausência de registro como ociosidade. Exibir pausas programadas excluídas separadamente. Quando vários operadores forem agregados, identificar a unidade como horas-pessoa.

Terceira seção — carga planejada por posto: tabela com posto, quantidade planejada, tempo de referência, carga em minutos, disponibilidade em minutos e ocupação planejada. Acima de 100%, apresentar “Carga superior à disponibilidade”, não “Gargalo comprovado”. Referência ou disponibilidade ausente deve aparecer como “Indisponível”.

Rodapé: limitações, pendências de apontamento e atualização. Erro de conexão não deve substituir os números por zero. Sem registros, mostrar esse estado explicitamente.

## Dados que combinar com Arthur e Gustavo

| Bloco | Dados mínimos | Responsabilidade de integração |
| --- | --- | --- |
| Tempos | Operador, posto, execução, categoria, início/fim e pendências | Gustavo fornece eventos; Mateus cria adaptador e cálculo; Arthur mantém relações |
| Cobertura | Janelas por operador e pausas programadas, no período | Arthur estrutura persistência; equipe confirma jornada; Mateus recorta e calcula |
| Produção | Baixas boas corrigidas, execução, ficha/etapa e ocorrência | Gustavo registra; Mateus agrega sem duplicar etapas |
| Média por par | Execuções encerradas do mesmo produto/operação e seus pares bons | Mateus usa o mesmo conjunto nos dois totais |
| Carga | Plano por posto/período, quantidade, referência versionada e disponibilidade | Arthur estrutura dados; Mateus calcula e apresenta |

Rota sugerida para discutir, não implementada: `GET /api/indicadores?inicio=...&fim=...&postoId=...`. Datas com fuso explícito; fim exclusivo. O servidor valida filtros e permissão, consulta dados e aplica funções. Nenhuma consulta direta ao banco pelo navegador.

Metadados propostos: `origem` (FICTICIA ou APONTADA), `consultadoEm`, filtros efetivos e pendências. Resultados planejados devem permanecer identificados como planejados mesmo quando o plano foi cadastrado com dados reais.

## Critérios da futura tela

- Reproduzir TEMPO-01/02/03 e CARGA-01 da especificação.
- Distinguir carregando, erro, indisponível, sem registros e valor zero.
- Indicar unidade de todas as durações e percentuais.
- Não mostrar eficiência individual, OEE ou redução de gargalos sem fundamentação.
- Não apresentar dados fictícios como persistidos ou coletados na fábrica.
- Validar filtros no servidor e testar permissões na rota.

## Fora da entrega inicial

Tela React, API, autenticação, banco, exportação, execução aberta/provisória, conversão de eventos em intervalos, comparação completa de cenários e validação na fábrica. São próximas etapas, não funcionalidades concluídas.
