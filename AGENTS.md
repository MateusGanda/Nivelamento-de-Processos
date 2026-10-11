# AGENTS.md — Instruções para IA do GUNP

## 1. Objetivo

O GUNP é um projeto acadêmico de software para gerenciamento e acompanhamento de processos produtivos, com foco em execução de operações, registro de tempos, produção e análise de carga por posto.

Antes de qualquer implementação, compreenda o contexto, as decisões e as restrições documentadas neste repositório.

## 2. Leitura obrigatória

Antes de executar uma tarefa, leia:

1. `CONTEXTO_DO_PROJETO.md`
2. `MODELO_CONCEITUAL_GUNP_atualizado.md`
3. `ARCHITECTURE.md`
4. `TECHNOLOGY.md`
5. `ROADMAP_GUNP.md`

Depois, inspecione os arquivos de código, o schema, as migrações e as configurações relevantes para a tarefa.

Não presuma que o roadmap descreve exatamente o estado atual do código.

## 3. Regras de comportamento

- Não altere, crie, exclua, mova ou renomeie arquivos sem solicitação explícita.
- Ao receber uma tarefa de análise ou preparação, trabalhe em modo somente leitura.
- Se o usuário solicitar implementação, limite as alterações ao escopo autorizado.
- Não execute migrações, comandos destrutivos ou alterações no banco sem autorização explícita.
- Não instale dependências, ferramentas ou bibliotecas sem aprovação.
- Não invente entidades, atributos, relacionamentos, endpoints, permissões ou regras de negócio.
- Não considere uma implementação concluída sem verificar o resultado e informar quais verificações foram executadas.
- Não exponha segredos, credenciais ou valores de arquivos de ambiente.

## 4. Arquitetura e tecnologia

Respeite `ARCHITECTURE.md` e `TECHNOLOGY.md`.

Preserve a separação de responsabilidades entre apresentação, aplicação, domínio e infraestrutura.

Não acesse o banco diretamente pela interface. Respeite os limites definidos para API, casos de uso, domínio, repositórios e Prisma.

Não introduza padrões, camadas, serviços ou abstrações adicionais sem justificativa para a tarefa.

## 5. Modelo de domínio

Respeite `MODELO_CONCEITUAL_GUNP_atualizado.md`.

Em especial:

- `Usuario` e `Operador` são entidades distintas.
- QR Code ou código funcional identifica o operador, mas não autentica nem concede privilégios.
- A ordem de produção mantém a versão do roteiro selecionada.
- A baixa não é parcial.
- A soma de itens bons, retrabalho e refugo deve corresponder à quantidade da ordem.
- Um operador não pode manter duas execuções abertas simultaneamente, incluindo execuções pausadas.
- Execuções finalizadas não podem ser retomadas.
- O tempo produtivo deve considerar os intervalos ativos e as pausas registradas.

Antes de alterar qualquer regra, explique o impacto e solicite aprovação.

## 6. Uso do roadmap

`ROADMAP_GUNP.md` é uma referência de prioridades e possíveis etapas, não uma sequência obrigatória.

Adapte a ordem conforme dependências técnicas, necessidades do MVP e decisões da equipe.

Não implemente funcionalidades apenas porque aparecem no roadmap. Confirme se fazem parte do escopo atual da tarefa.

## 7. Conflitos e incertezas

Use os documentos conforme suas responsabilidades e as regras de precedência definidas em `CONTEXTO_DO_PROJETO.md`.

Se houver conflito entre documentação, código, schema ou migrações:

1. Identifique a divergência.
2. Explique o impacto.
3. Apresente uma proposta, quando possível.
4. Solicite decisão antes de fazer alterações estruturais ou redefinir regras.

Não resolva divergências silenciosamente nem trate o código existente como prova de que uma decisão está aprovada.

## 8. Procedimento antes de implementar

Antes de editar arquivos:

1. Resuma o entendimento da tarefa.
2. Identifique os arquivos e componentes afetados.
3. Verifique dependências e contratos existentes.
4. Aponte dúvidas ou decisões pendentes.
5. Proponha o menor conjunto de alterações necessário.

Quando a solicitação for apenas de análise, planejamento ou revisão, não faça alterações.

## 9. Relato final

Ao concluir uma tarefa autorizada, informe:

- O que foi alterado.
- Quais decisões foram tomadas.
- Quais verificações foram executadas e seus resultados.
- Quais pendências ou riscos permanecem.

Não afirme que testes, migrações ou validações foram executados sem evidência.