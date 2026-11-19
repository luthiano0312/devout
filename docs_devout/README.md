# Documentação — Devout

Organizada conforme a skill `docs`. **M01 / Slice 1 implementado, revisado e encerrado**: infraestrutura OpenClaw → Role Runner → Pi Driver → Pi Agent RPC em Windows nativo. **Slice 2 ainda não iniciado**; o contrato MVP completo está **parcialmente implementado**, sem os fluxos dos Slices 2, 3 e 4. Temporariamente não há plano ativo; M02 ainda será planejado.

## Onde procurar

| Área | Entrada | Finalidade |
| --- | --- | --- |
| `01-requisitos/` | [Visão e escopo](01-requisitos/escopo.md) | Problema, limites e recorte atual |
| `02-design/` | [Arquitetura HLD](02-design/arquitetura-hld.md) | Componentes, responsabilidades e decisões |
| `02-design/` | [Contrato MVP v1.0](02-design/contrato-orquestracao-mvp.md) | Comportamento aprovado, gates, estados e aceite |
| `02-design/adr/` | [ADR-0001](02-design/adr/0001-runner-temporario-windows-rpc.md), [ADR-0002](02-design/adr/0002-pi-sequencial-exclusivo.md), [ADR-0003](02-design/adr/0003-isolamento-forte-adiado-no-mvp.md) | Registros de decisões já aprovadas, não novas autorizações |
| `03-execucao/` | [Plano M01 encerrado](03-execucao/planos/marco-M01.md) e [registro](03-execucao/registro.md) | Planejamento histórico e progresso oficial |
| `how-to/` | [Diagnóstico Windows](how-to/diagnosticar-ambiente-windows.md) | Procedimentos operacionais |
| `reference/` | [Prova OpenClaw + Pi](reference/01-registro-integracao-openclaw-pi-e-decisoes.md) | Fatos comprovados e limitações dos experimentos |
| `explanation/` | [Contexto](explanation/contexto-projeto-automacao-workflow-atualizado.md) e [decisões conceituais](explanation/decisoes-workflow-automacao-2026-11-12.md) | Intenção de longo prazo e histórico conceitual |
| `explanation/archive/` | [Índice histórico](explanation/archive/README.md) | Rascunhos e briefing sem força de execução |

O [AGENTS.md](../AGENTS.md) é o mapa para agentes. Código/testes novos ficam em `src/`; [protótipos](../prototipo/) permanecem onde estavam, com suas evidências originais.

## Fontes de verdade e precedência

1. **Comportamento do MVP:** contrato v1.0. As etiquetas `[APROVADO]`, `[VALIDAR]` e `[DETALHAR]` continuam válidas; exemplos não se tornam schemas definitivos por esta reorganização.
2. **Planejamento:** não há plano ativo. O plano M01 arquivado preserva o recorte do Slice 1 encerrado e não autoriza novas execuções; `docs_devout/plano.md` fica reservado ao próximo plano aprovado. O contrato completo não autoriza antecipar slices posteriores. **Estado oficial:** somente o registro de execução.
3. **Decisões arquiteturais:** ADRs registram escolhas existentes e remetem às fontes aprovadas; o HLD é uma visão de navegação. Não substituem o detalhamento do contrato.
4. **Evidências:** relatórios e revisões do M01 em `03-execucao/achados/`, vinculados no registro, documentam a entrega revisada. O registro da prova e `prototipo/` preservam os experimentos históricos. Cada evidência comprova apenas os cenários efetivamente testados, sem garantir produção ou retomada durável.
5. **Contexto e decisões de 12/11:** descrevem também o workflow futuro. Onde o contrato posterior delimita o MVP, prevalece o contrato. Por exemplo, reinício automático não se aplica à revisão/correção e a migração da `plan` para arquivo por task não está autorizada no Slice 1.
6. **Histórico arquivado:** não é fonte normativa atual e não deve ser carregado por padrão.

Contradição que não se resolva por essas fronteiras exige decisão humana, não alteração silenciosa de requisito.

## Manutenção

- Atualizar o documento responsável pelo assunto, sem criar SRS e backlog concorrentes. Os requisitos e critérios detalhados existentes continuam no contrato; não foi criado um SRS duplicado.
- Manter as tasks no plano aprovado, com IDs, dependências e quatro campos preservados. Relatórios/revisões ficam em `03-execucao/achados/`; o plano M01 foi movido para `03-execucao/planos/marco-M01.md`, sem reescrever seu planejamento. O registro permanece no lugar, com estados, commits, timestamps e observações intactos.
- A configuração `03-execucao/fontes-revisao.json` foi preservada como evidência do procedimento de revisão M01: seus caminhos referem-se ao checkout anterior ao arquivamento (`35c1834`), não constituem seleção para o M02 nem entrada operacional atual. Nova revisão exige preparação autorizada.
- Ler somente `02-design/adr/*.md` por padrão. ADR aceito é imutável; substituição exige novo número, referências bidirecionais, atualização do status antigo e movimento para `02-design/adr/archive/`.
- Não criar documentos vazios de banco, APIs HTTP, UI/UX ou System Design sem necessidade real. Não há banco, API HTTP permanente ou UI definidos para o Slice 1.
- Não versionar `.obsidian/`, logs brutos, credenciais ou históricos completos Pi/OpenClaw.

## Migração documental

O layout atual mantém a raiz `docs_devout/`, adaptando a estrutura da skill `docs` ao projeto. Após o encerramento do M01, seu plano está em `docs_devout/03-execucao/planos/marco-M01.md`; `docs_devout/plano.md` é apenas o caminho previsto para o próximo plano aprovado e não existe atualmente. O registro permanece em `docs_devout/03-execucao/registro.md`. O contrato aprovado fica em `02-design/`; evidências em `reference/`; contexto em `explanation/`; rascunhos e briefing em `explanation/archive/`. A configuração local do Obsidian permanece ignorada, sem ser incorporada ao Git.

Os históricos arquivados, relatórios, revisões e protótipos foram preservados sem reescrita; caminhos citados neles podem representar a organização da época. O baseline M01 foi confirmado em `c771c4b`; as seis conclusões e seus commits foram conferidos até `35c1834`. O encerramento documental, autorizado pelo usuário, não altera requisitos, decisões arquiteturais ou estados de tasks e não inicia o M02. Nenhum commit foi criado por esta manutenção.
