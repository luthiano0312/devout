# Documentação — Devout

Organizada conforme a skill `docs`. **M01 / Slice 1 implementado, revisado e encerrado**: infraestrutura OpenClaw → Role Runner → Pi Driver → Pi Agent RPC em Windows nativo. **M02 / Slice 2 planejado e aprovado em 2026-11-19, com implementação ainda não iniciada**; o contrato MVP completo está **parcialmente implementado**, sem os fluxos dos Slices 2, 3 e 4. O plano ativo está em `docs_devout/plano.md`; a execução exige confirmação do commit de baseline.

## Onde procurar

| Área | Entrada | Finalidade |
| --- | --- | --- |
| `01-requisitos/` | [Visão e escopo](01-requisitos/escopo.md) | Problema, limites e recorte atual |
| `02-design/` | [Arquitetura HLD](02-design/arquitetura-hld.md) | Componentes, responsabilidades e decisões |
| `02-design/` | [Contrato MVP v1.0](02-design/contrato-orquestracao-mvp.md) | Comportamento aprovado, gates, estados e aceite |
| `02-design/adr/` | [ADR-0001](02-design/adr/0001-runner-temporario-windows-rpc.md), [ADR-0002](02-design/adr/0002-pi-sequencial-exclusivo.md), [ADR-0003](02-design/adr/0003-isolamento-forte-adiado-no-mvp.md) | Registros de decisões já aprovadas, não novas autorizações |
| Raiz documental | [Plano M02 ativo](plano.md) | Recorte aprovado, tasks e dependências do Slice 2 |
| `03-execucao/` | [Plano M01 encerrado](03-execucao/planos/marco-M01.md) e [registro](03-execucao/registro.md) | Planejamento histórico e progresso oficial de M01 e M02 |
| `how-to/` | [Diagnóstico Windows](how-to/diagnosticar-ambiente-windows.md) | Procedimentos operacionais |
| `reference/` | [Prova OpenClaw + Pi](reference/01-registro-integracao-openclaw-pi-e-decisoes.md) | Fatos comprovados e limitações dos experimentos |
| `explanation/` | [Contexto](explanation/contexto-projeto-automacao-workflow-atualizado.md) e [decisões conceituais](explanation/decisoes-workflow-automacao-2026-11-12.md) | Intenção de longo prazo e histórico conceitual |
| `explanation/archive/` | [Índice histórico](explanation/archive/README.md) | Rascunhos e briefing sem força de execução |

O [AGENTS.md](../AGENTS.md) é o mapa para agentes. Código/testes novos ficam em `src/`; [protótipos](../prototipo/) permanecem onde estavam, com suas evidências originais.

## Fontes de verdade e precedência

1. **Comportamento do MVP:** contrato v1.0. As etiquetas `[APROVADO]`, `[VALIDAR]` e `[DETALHAR]` continuam válidas; exemplos não se tornam schemas definitivos por esta reorganização.
2. **Planejamento:** o [plano M02 ativo](plano.md) delimita o Slice 2 aprovado, com execução condicionada ao baseline versionado e conferido de plano, registro, mapa e seleção de fontes da primeira task. O plano M01 arquivado preserva o recorte do Slice 1 encerrado e não autoriza novas execuções. O contrato completo não autoriza antecipar slices posteriores. **Estado oficial:** somente o registro de execução. O ensaio técnico do M02 não altera o registro da task fictícia nem satisfaz o gate oficial de estado ou o T01 integral do MVP, pendentes do Slice 4.
3. **Decisões arquiteturais:** ADRs registram escolhas existentes e remetem às fontes aprovadas; o HLD é uma visão de navegação. Não substituem o detalhamento do contrato.
4. **Evidências:** relatórios e revisões do M01 em `03-execucao/achados/`, vinculados no registro, documentam a entrega revisada. O registro da prova e `prototipo/` preservam os experimentos históricos. Cada evidência comprova apenas os cenários efetivamente testados, sem garantir produção ou retomada durável.
5. **Contexto e decisões de 12/11:** descrevem também o workflow futuro. Onde o contrato posterior delimita o MVP, prevalece o contrato. Por exemplo, reinício automático não se aplica à revisão/correção e a migração da `plan` para arquivo por task não está autorizada no Slice 1.
6. **Histórico arquivado:** não é fonte normativa atual e não deve ser carregado por padrão.

Contradição que não se resolva por essas fronteiras exige decisão humana, não alteração silenciosa de requisito.

## Manutenção

- Atualizar o documento responsável pelo assunto, sem criar SRS e backlog concorrentes. Os requisitos e critérios detalhados existentes continuam no contrato; não foi criado um SRS duplicado.
- Manter as tasks no plano aprovado, com IDs, dependências e quatro campos preservados. Relatórios/revisões ficam em `03-execucao/achados/`; o plano M01 foi movido para `03-execucao/planos/marco-M01.md`, sem reescrever seu planejamento. O registro permanece no lugar, com as seis linhas históricas M01 intactas e sete linhas M02 acrescentadas como `não iniciada`.
- A configuração `03-execucao/fontes-revisao.json` preserva as seis seleções históricas M01, cujos caminhos referem-se ao checkout anterior ao arquivamento (`35c1834`), e inclui a seleção M02-T01 validada na preparação do baseline. Não reutilizar as entradas M01 com o novo plano. M02-T02–M02-T07 exigem seleção explícita, autorizada e versionada antes da respectiva revisão, sem fallback integral; a revisão M02-T01 ocorrerá após implementação, em conversa independente.
- Ler somente `02-design/adr/*.md` por padrão. ADR aceito é imutável; substituição exige novo número, referências bidirecionais, atualização do status antigo e movimento para `02-design/adr/archive/`.
- Não criar documentos vazios de banco, APIs HTTP, UI/UX ou System Design sem necessidade real. Não há banco, API HTTP permanente ou UI definidos para o Slice 1.
- Não versionar `.obsidian/`, logs brutos, credenciais ou históricos completos Pi/OpenClaw.

## Migração documental

O layout atual mantém a raiz `docs_devout/`, adaptando a estrutura da skill `docs` ao projeto. Após o encerramento do M01, seu plano está em `docs_devout/03-execucao/planos/marco-M01.md`; `docs_devout/plano.md` contém agora o plano M02 aprovado. O registro permanece em `docs_devout/03-execucao/registro.md`. O contrato aprovado fica em `02-design/`; evidências em `reference/`; contexto em `explanation/`; rascunhos e briefing em `explanation/archive/`. A configuração local do Obsidian permanece ignorada, sem ser incorporada ao Git.

Os históricos arquivados, relatórios, revisões e protótipos foram preservados sem reescrita; caminhos citados neles podem representar a organização da época. O baseline M01 foi confirmado em `c771c4b`; as seis conclusões e seus commits foram conferidos até `35c1834`. O encerramento documental de M01 não alterou requisitos, decisões arquiteturais ou estados de tasks e não iniciou o M02. A preparação do baseline M02 acrescenta o plano aprovado, suas linhas iniciais no registro, o mapa atualizado e a seleção M02-T01, sem iniciar implementação nem mudar o histórico M01. Commits manuais autorizados do desenvolvimento do Devout não se confundem com os commits automáticos da task fictícia, proibidos no ensaio M02.
