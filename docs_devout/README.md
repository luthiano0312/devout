# Documentação — Devout

Organizada conforme a skill `docs`. O projeto ainda está antes da implementação do M01; desenho aprovado e experimentos históricos não significam orquestrador pronto.

## Onde procurar

| Área | Entrada | Finalidade |
| --- | --- | --- |
| `01-requisitos/` | [Visão e escopo](01-requisitos/escopo.md) | Problema, limites e recorte atual |
| `02-design/` | [Arquitetura HLD](02-design/arquitetura-hld.md) | Componentes, responsabilidades e decisões |
| `02-design/` | [Contrato MVP v1.0](02-design/contrato-orquestracao-mvp.md) | Comportamento aprovado, gates, estados e aceite |
| `02-design/adr/` | [ADR-0001](02-design/adr/0001-runner-temporario-windows-rpc.md), [ADR-0002](02-design/adr/0002-pi-sequencial-exclusivo.md), [ADR-0003](02-design/adr/0003-isolamento-forte-adiado-no-mvp.md) | Registros de decisões já aprovadas, não novas autorizações |
| Raiz e `03-execucao/` | [Plano M01](plano.md) e [registro](03-execucao/registro.md) | Tasks aprovadas e progresso oficial |
| `how-to/` | [Diagnóstico Windows](how-to/diagnosticar-ambiente-windows.md) | Procedimentos operacionais |
| `reference/` | [Prova OpenClaw + Pi](reference/01-registro-integracao-openclaw-pi-e-decisoes.md) | Fatos comprovados e limitações dos experimentos |
| `explanation/` | [Contexto](explanation/contexto-projeto-automacao-workflow-atualizado.md) e [decisões conceituais](explanation/decisoes-workflow-automacao-2026-11-12.md) | Intenção de longo prazo e histórico conceitual |
| `explanation/archive/` | [Índice histórico](explanation/archive/README.md) | Rascunhos e briefing sem força de execução |

O [AGENTS.md](../AGENTS.md) é o mapa para agentes. Código/testes novos ficam em `src/`; [protótipos](../prototipo/) permanecem onde estavam, com suas evidências originais.

## Fontes de verdade e precedência

1. **Comportamento do MVP:** contrato v1.0. As etiquetas `[APROVADO]`, `[VALIDAR]` e `[DETALHAR]` continuam válidas; exemplos não se tornam schemas definitivos por esta reorganização.
2. **Recorte executável atual:** plano M01, limitado ao Slice 1. O contrato completo não autoriza antecipar slices posteriores. **Estado oficial:** somente o registro de execução.
3. **Decisões arquiteturais:** ADRs registram escolhas existentes e remetem às fontes aprovadas; o HLD é uma visão de navegação. Não substituem o detalhamento do contrato.
4. **Evidências:** registro da prova e `prototipo/` comprovam apenas os cenários efetivamente testados.
5. **Contexto e decisões de 12/11:** descrevem também o workflow futuro. Onde o contrato posterior delimita o MVP, prevalece o contrato. Por exemplo, reinício automático não se aplica à revisão/correção e a migração da `plan` para arquivo por task não está autorizada no Slice 1.
6. **Histórico arquivado:** não é fonte normativa atual e não deve ser carregado por padrão.

Contradição que não se resolva por essas fronteiras exige decisão humana, não alteração silenciosa de requisito.

## Manutenção

- Atualizar o documento responsável pelo assunto, sem criar SRS e backlog concorrentes. Os requisitos e critérios detalhados existentes continuam no contrato; não foi criado um SRS duplicado.
- Manter as tasks no plano aprovado, com IDs, dependências e quatro campos preservados. Relatórios/revisões irão a `03-execucao/achados/` e planos encerrados a `03-execucao/planos/`, quando existirem.
- Ler somente `02-design/adr/*.md` por padrão. ADR aceito é imutável; substituição exige novo número, referências bidirecionais, atualização do status antigo e movimento para `02-design/adr/archive/`.
- Não criar documentos vazios de banco, APIs HTTP, UI/UX ou System Design sem necessidade real. Não há banco, API HTTP permanente ou UI definidos para o Slice 1.
- Não versionar `.obsidian/`, logs brutos, credenciais ou históricos completos Pi/OpenClaw.

## Migração documental

O layout atual mantém a raiz `docs_devout/`, adaptando a estrutura da skill `docs` ao projeto. O plano está em `docs_devout/plano.md` e o registro em `docs_devout/03-execucao/registro.md`; não há plano em `03-execucao/`. O contrato aprovado fica em `02-design/`; evidências em `reference/`; contexto em `explanation/`; rascunhos e briefing em `explanation/archive/`. A configuração local do Obsidian permanece ignorada, sem ser incorporada ao Git.

Os históricos arquivados e os protótipos foram preservados sem reescrita; caminhos citados neles podem representar a organização da época. A migração não altera estados de tasks, requisitos, aprovações ou o bloqueio de implementação até o commit autorizado do baseline. Nenhum commit foi criado por esta reorganização.
