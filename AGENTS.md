# AGENTS.md — Devout

## Sobre o projeto

`devout` implementa, de forma incremental, um orquestrador de desenvolvimento de software. OpenClaw coordena as execuções e Pi Agent realiza operações de programação por RPC. O ambiente inicial é **Windows nativo**. O **M01 / Slice 1** (Driver, Runner temporário, processos e integração) está implementado, revisado e encerrado. O **M02 / Slice 2** foi planejado e aprovado em 2026-11-19, mas a implementação ainda não começou; o contrato MVP completo permanece parcialmente implementado.

## Mapa de caminhos

- **Código e testes do orquestrador:** `src/` (Pi Driver em `src/pi-driver.mjs`; testes em `src/test/`; interface e roteiro em `src/README.md`). Não criar `orquestrador/` nem um `src/src/`.
- **Skills de engenharia:** `.agents/skills/` (`grill-me`, `docs`, `plan`, `implement`). São instruções para agentes, não a implementação do orquestrador.
- **Protótipos e evidências históricas:** `prototipo/`. Usar como referência, **não reescrever** experimentos já registrados para ajustá-los ao código novo.
- **Documentação do projeto e precedência das fontes:** `docs_devout/README.md`. A raiz real é `docs_devout/`, não `docs/`.
- **Visão e escopo:** `docs_devout/01-requisitos/escopo.md`.
- **Arquitetura:** `docs_devout/02-design/arquitetura-hld.md`; decisões em `docs_devout/02-design/adr/`.
- **Procedimentos:** `docs_devout/how-to/`; diagnóstico em `docs_devout/how-to/diagnosticar-ambiente-windows.md`.
- **Plano ativo:** `docs_devout/plano.md` — M02 (Slice 2), aprovado em 2026-11-19; execução somente depois de confirmar commit de baseline.
- **Plano M01 encerrado:** `docs_devout/03-execucao/planos/marco-M01.md`; preserva as seis tasks e o planejamento original como histórico, não autoriza novas execuções.
- **Registro oficial de execução:** `docs_devout/03-execucao/registro.md` (M01-T01–M01-T06 concluídas; consultar este registro para os estados atuais de M02-T01–M02-T07 e preservar o histórico).
- **Seleção de fontes para revisão independente:** `docs_devout/03-execucao/fontes-revisao.json` (M01 histórico preservado e seleção M02-T01 preparada; as demais M02 exigem recorte explícito antes da revisão).
- **Relatórios e revisões de tasks:** `docs_devout/03-execucao/achados/`.
- **Planos encerrados:** `docs_devout/03-execucao/planos/`.

O baseline do M01 foi confirmado em `c771c4b39a34716f15728c1e0d5b2596e776bc41`; sua conclusão está registrada até `35c1834906709628fee7889ca263c08ff7a9893e`. **Não iniciar nova implementação sem plano aprovado, registro correspondente e este mapa versionados em commit de baseline confirmado**. O M02 tem plano aprovado; antes de executar qualquer task, confirmar no Git o baseline do plano, registro, mapa e seleção de fontes pertinente. Se houver divergência entre este mapa e o checkout real, interromper a execução e reconciliar.

## Fontes de verdade e leitura seletiva

- **Contrato MVP aprovado (v1.0):** `docs_devout/02-design/contrato-orquestracao-mvp.md` (conferido na `main` em 2026-11-17, antes da migração documental). O arquivo `docs_devout/explanation/archive/contrato-orquestracao-mvp.md` é o rascunho 0.1, não a versão em vigor.
- **Resultados comprovados da integração:** `docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md`.
- **Contexto consolidado:** `docs_devout/explanation/contexto-projeto-automacao-workflow-atualizado.md`.
- **Decisões conceituais de workflow:** `docs_devout/explanation/decisoes-workflow-automacao-2026-11-12.md`.
- **Skills:** `.agents/skills/plan/SKILL.md`, `.agents/skills/implement/SKILL.md`, `.agents/skills/docs/SKILL.md` e referências necessárias a cada papel.

O contrato define o comportamento do MVP completo, ainda parcialmente implementado; o plano arquivado delimita o Slice 1 encerrado, sem autorizar slices seguintes. O plano ativo M02 delimita o Slice 2, com execução condicionada ao baseline confirmado; somente o registro informa o progresso oficial. HLD e ADRs resumem decisões existentes, sem substituir o contrato. Contexto conceitual e protótipos não autorizam antecipar slices nem migrar a `plan` para arquivos por task.

Fora da avaliação independente, carregar primeiro a task M02 atual em `docs_devout/plano.md` e apenas as fontes pertinentes. O plano M01 arquivado não é plano vigente; não iniciar task sem baseline M02 confirmado. Na avaliação independente, preparar primeiro a entrada filtrada conforme abaixo, sem abrir o plano inteiro. Consultar os ADRs antes de propor mudanças arquiteturais relevantes. Por padrão, ler somente `docs_devout/02-design/adr/*.md` (ativos), sem busca recursiva; `docs_devout/02-design/adr/archive/` (quando houver) fica reservado à investigação histórica ou revisão arquitetural ampla. Não carregar `docs_devout/explanation/archive/` em massa; rascunhos e briefings não substituem o contrato aprovado.

As revisões M01-T01–M01-T06 estão finalizadas. Suas seleções preservadas usam `docs_devout/plano.md` no checkout **anterior ao arquivamento** (referência: `35c1834906709628fee7889ca263c08ff7a9893e`); não executar comandos M01 no checkout atual nem reutilizar essas entradas com o novo plano. A configuração inclui a seleção M02-T01, validada na preparação do baseline. Para uma nova revisão independente, a entrada deve ser preparada antes de relatos, Observações, diffs irrestritos ou documentos mistos. Exemplo histórico M01-T06 (demais seleções M01 trocavam somente o ID):

```powershell
python .agents/skills/implement/scripts/review_inputs.py docs_devout/03-execucao/registro.md M01-T06 --sources docs_devout/03-execucao/fontes-revisao.json
```

Exemplo atual, revisão manual futura de M02-T01 após implementação, em conversa independente:

```powershell
python .agents/skills/implement/scripts/review_inputs.py docs_devout/03-execucao/registro.md M02-T01 --sources docs_devout/03-execucao/fontes-revisao.json
```

Persistir a saída em arquivo temporário **fora do repositório**, conforme `.agents/skills/implement/references/entradas-independentes.md`; não versionar esse JSON gerado. A configuração fornece task completa, restrições e fontes iniciais, adiando evidências anteriores, trechos mistos e experimentos históricos. Persistir a avaliação inicial antes de consultar `deferred_sections`, relatos e todos os diffs adiados; o filtro não reduz a revisão final. Revalidar a entrada com o mesmo comando e `--check-input <entrada-temporaria.json>`. Para M02, há seleção apenas de M02-T01; as demais tasks requerem preparação específica autorizada: sem seleção válida, pedir o recorte, sem fallback integral. Nas M01-T02, M01-T03, M01-T04, M01-T05 e M01-T06, o guia `src/README.md` fica integralmente adiado para não antecipar o desenho/relato da implementação; nas M01-T03, M01-T04, M01-T05 e M01-T06, isso também vale para `src/PI-LOCK.md`. Nas M01-T04, M01-T05 e M01-T06, `src/ROLE-RUNNER.md` também fica integralmente adiado. Na M01-T06, `src/OPENCLAW.md` fica integralmente adiado, incluindo procedimento, evidências e limites relatados; código, testes e o roteiro executável `src/test/openclaw-procedure.txt` permanecem entregáveis examináveis na fase inicial, sem liberar os guias ou relatos. O exame completo desses guias continua obrigatório na fase de confronto. Os quatro campos das M01-T01, M01-T02, M01-T03, M01-T04, M01-T05 e M01-T06 são subtítulos Markdown para compatibilidade com o preparador, sem mudança dos requisitos.

## Convenções e limites atuais

- **Plataforma inicial:** Windows 10/11 nativo, Node.js (módulos `.mjs` nos protótipos), OpenClaw e Pi Agent RPC. Não introduzir Docker, WSL2, serviço HTTP permanente ou framework genérico no Slice 1 sem autorização.
- **Execução:** no máximo **um processo Pi controlado pelo workflow por vez**. O Role Runner é temporário, um por papel/execução; verificar encerramento antes de permitir outro.
- **Segurança:** a restrição de acesso a arquivos no Windows foi considerada insuficiente para isolamento forte. Executar Pi experimental somente sobre projetos e dados fictícios, sem segredos ou credenciais Git amplas. Não usar `spawn(..., { shell: true })` com argumentos variáveis; jamais aceitar parâmetros arbitrários de shell de um modelo.
- **Papéis e estados:** no desenho automatizado, o Pi produz evidências; o OpenClaw valida gates e controla transições. Essa automação de papéis/transições ainda não integra o Slice 1. `exitCode=0`, `prompt accepted` ou `success=true` isolados não comprovam conclusão. O Slice 1 **não** atualiza o `registro.md` nem faz commits automáticos de tasks. No ensaio M02, o orquestrador também não altera o registro oficial nem faz commits da task fictícia; o parecer técnico não satisfaz o gate oficial de estado nem o T01 integral do MVP. Isso não proíbe commits manuais autorizados do desenvolvimento do próprio Devout.
- **Escopo:** preservar `.agents/`, `prototipo/` e documentos existentes. Mudanças de requisitos/arquitetura ou ações fora da task exigem decisão humana. Não fazer operações destrutivas nem modificar `main` automaticamente.
- **Código:** concentrar código novo e seus testes em `src/`; manter registros operacionais (`runs/`, estados, logs) fora das pastas versionadas e não incluir credenciais nem históricos completos `.pi`/`.openclaw` no Git.

## Diagnóstico e testes

Executar os comandos de `docs_devout/how-to/diagnosticar-ambiente-windows.md`. Comandos validados no Windows nativo em 2026-11-17, a partir da raiz:

- `npm.cmd --prefix src test` — testes automatizados do Pi Driver com processos fictícios.
- `npm.cmd --prefix src run test:smoke` — smoke opt-in com Pi real, provedor configurado e workspace temporário sem segredos; não executar em paralelo com outro Pi do workflow. Roteiro e limites em `src/README.md`.

Sem dependências externas ou etapa de instalação; ainda não há comando de lint definido. Esses testes não substituem a revisão independente da task.

## Antes de implementar uma task

1. Exigir plano M02 aprovado e ativo em `docs_devout/plano.md`, com baseline versionado, e ler o registro em `docs_devout/03-execucao/registro.md`, além das instruções da skill aplicável. O M01 arquivado não satisfaz essa pré-condição. Na avaliação independente, obter primeiro task/restrições e metadados pelo preparador acima, sem Observações/relatos. Ambos são pré-condições obrigatórias; ausência ou divergência bloqueia implementação.
2. Conferir a task, dependências obrigatórias, estado, branch, arquivos existentes e baseline Git; preservar trabalho preexistente.
3. Implementar **somente** `Fazer` e respeitar integralmente `Não alterar`. Persistir testes/evidências; relatar achados, limites e pendências.
4. Não declarar uma task pronta para a próxima sem revisão, condições de conclusão e commits manuais autorizados do workflow vigente. O Git Gateway futuro não integra o M02.
