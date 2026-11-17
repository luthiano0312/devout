# AGENTS.md — Devout

## Sobre o projeto

`devout` implementa, de forma incremental, um orquestrador de desenvolvimento de software. OpenClaw coordena as execuções e Pi Agent realiza operações de programação por RPC. O ambiente inicial é **Windows nativo**; a primeira entrega de código é o **Slice 1** (Driver, Runner temporário, processos e integração).

## Mapa de caminhos

- **Código e testes do orquestrador:** `src/` (Pi Driver em `src/pi-driver.mjs`; testes em `src/test/`; interface e roteiro em `src/README.md`). Não criar `orquestrador/` nem um `src/src/`.
- **Skills de engenharia:** `.agents/skills/` (`grill-me`, `docs`, `plan`, `implement`). São instruções para agentes, não a implementação do orquestrador.
- **Protótipos e evidências históricas:** `prototipo/`. Usar como referência, **não reescrever** experimentos já registrados para ajustá-los ao código novo.
- **Documentação do projeto e precedência das fontes:** `docs_devout/README.md`. A raiz real é `docs_devout/`, não `docs/`.
- **Visão e escopo:** `docs_devout/01-requisitos/escopo.md`.
- **Arquitetura:** `docs_devout/02-design/arquitetura-hld.md`; decisões em `docs_devout/02-design/adr/`.
- **Procedimentos:** `docs_devout/how-to/`; diagnóstico em `docs_devout/how-to/diagnosticar-ambiente-windows.md`.
- **Plano do marco atual:** `docs_devout/plano.md` (M01 aprovado em 2026-11-17; confirmar commit de baseline). O plano está na raiz documental, não em `03-execucao/`.
- **Registro oficial de execução:** `docs_devout/03-execucao/registro.md` (M01 inicializado em 2026-11-17; confirmar commit de baseline).
- **Seleção de fontes para revisão independente:** `docs_devout/03-execucao/fontes-revisao.json` (configuração v1, com seleções para M01-T01 e M01-T02).
- **Relatórios e revisões de tasks:** `docs_devout/03-execucao/achados/` (quando houver).
- **Planos encerrados:** `docs_devout/03-execucao/planos/` (quando houver).

O plano e o registro foram preparados após aprovação do M01. **Não iniciar implementação até que esses arquivos e este mapa estejam versionados em commit de baseline confirmado**. Conferir o baseline Git antes da primeira task. Se houver divergência entre este mapa e o checkout real, interromper a execução e reconciliar.

## Fontes de verdade e leitura seletiva

- **Contrato MVP aprovado (v1.0):** `docs_devout/02-design/contrato-orquestracao-mvp.md` (conferido na `main` em 2026-11-17, antes da migração documental). O arquivo `docs_devout/explanation/archive/contrato-orquestracao-mvp.md` é o rascunho 0.1, não a versão em vigor.
- **Resultados comprovados da integração:** `docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md`.
- **Contexto consolidado:** `docs_devout/explanation/contexto-projeto-automacao-workflow-atualizado.md`.
- **Decisões conceituais de workflow:** `docs_devout/explanation/decisoes-workflow-automacao-2026-11-12.md`.
- **Skills:** `.agents/skills/plan/SKILL.md`, `.agents/skills/implement/SKILL.md`, `.agents/skills/docs/SKILL.md` e referências necessárias a cada papel.

O contrato define o comportamento do MVP; o plano limita a execução atual ao Slice 1; somente o registro informa o progresso oficial. HLD e ADRs resumem decisões existentes, sem substituir o contrato. Contexto conceitual e protótipos não autorizam antecipar slices nem migrar a `plan` para arquivos por task.

Fora da avaliação independente, carregar primeiro a task atual em `docs_devout/plano.md` e apenas as fontes pertinentes. Na avaliação independente, preparar primeiro a entrada filtrada conforme abaixo, sem abrir o plano inteiro. Consultar os ADRs antes de propor mudanças arquiteturais relevantes. Por padrão, ler somente `docs_devout/02-design/adr/*.md` (ativos), sem busca recursiva; `docs_devout/02-design/adr/archive/` (quando houver) fica reservado à investigação histórica ou revisão arquitetural ampla. Não carregar `docs_devout/explanation/archive/` em massa; rascunhos e briefings não substituem o contrato aprovado.

Para revisar M01-T01 ou M01-T02, executar antes de relatos, Observações, diffs irrestritos ou documentos mistos (exemplo M01-T02; para M01-T01, trocar somente o ID):

```powershell
python .agents/skills/implement/scripts/review_inputs.py docs_devout/03-execucao/registro.md M01-T02 --sources docs_devout/03-execucao/fontes-revisao.json
```

Persistir a saída em arquivo temporário **fora do repositório**, conforme `.agents/skills/implement/references/entradas-independentes.md`; não versionar esse JSON gerado. A configuração fornece task completa, restrições e fontes iniciais, adiando evidências anteriores, trechos mistos e experimentos históricos. Persistir a avaliação inicial antes de consultar `deferred_sections`, relatos e todos os diffs adiados; o filtro não reduz a revisão final. Revalidar a entrada com o mesmo comando e `--check-input <entrada-temporaria.json>`. Não há seleção autorizada para outras tasks neste JSON: sem seleção válida, pedir o recorte, sem fallback integral. Na M01-T02, o guia `src/README.md` fica integralmente adiado para não antecipar o desenho/relato da implementação; seu exame completo continua obrigatório na fase de confronto. Os quatro campos das M01-T01 e M01-T02 são subtítulos Markdown para compatibilidade com o preparador, sem mudança dos requisitos.

## Convenções e limites atuais

- **Plataforma inicial:** Windows 10/11 nativo, Node.js (módulos `.mjs` nos protótipos), OpenClaw e Pi Agent RPC. Não introduzir Docker, WSL2, serviço HTTP permanente ou framework genérico no Slice 1 sem autorização.
- **Execução:** no máximo **um processo Pi controlado pelo workflow por vez**. O Role Runner é temporário, um por papel/execução; verificar encerramento antes de permitir outro.
- **Segurança:** a restrição de acesso a arquivos no Windows foi considerada insuficiente para isolamento forte. Executar Pi experimental somente sobre projetos e dados fictícios, sem segredos ou credenciais Git amplas. Não usar `spawn(..., { shell: true })` com argumentos variáveis; jamais aceitar parâmetros arbitrários de shell de um modelo.
- **Papéis e estados:** no desenho automatizado, o Pi produz evidências; o OpenClaw valida gates e controla transições. Essa automação de papéis/transições ainda não integra o Slice 1. `exitCode=0`, `prompt accepted` ou `success=true` isolados não comprovam conclusão. O Slice 1 **não** atualiza o `registro.md` nem faz commits automáticos de tasks.
- **Escopo:** preservar `.agents/`, `prototipo/` e documentos existentes. Mudanças de requisitos/arquitetura ou ações fora da task exigem decisão humana. Não fazer operações destrutivas nem modificar `main` automaticamente.
- **Código:** concentrar código novo e seus testes em `src/`; manter registros operacionais (`runs/`, estados, logs) fora das pastas versionadas e não incluir credenciais nem históricos completos `.pi`/`.openclaw` no Git.

## Diagnóstico e testes

Executar os comandos de `docs_devout/how-to/diagnosticar-ambiente-windows.md`. Comandos validados no Windows nativo em 2026-11-17, a partir da raiz:

- `npm.cmd --prefix src test` — testes automatizados do Pi Driver com processos fictícios.
- `npm.cmd --prefix src run test:smoke` — smoke opt-in com Pi real, provedor configurado e workspace temporário sem segredos; não executar em paralelo com outro Pi do workflow. Roteiro e limites em `src/README.md`.

Sem dependências externas ou etapa de instalação; ainda não há comando de lint definido. Esses testes não substituem a revisão independente da task.

## Antes de implementar uma task

1. Ler o plano aprovado em `docs_devout/plano.md` e o registro em `docs_devout/03-execucao/registro.md`, além das instruções da skill aplicável. Na avaliação independente, obter primeiro task/restrições e metadados pelo preparador acima, sem Observações/relatos. Ambos são pré-condições obrigatórias; ausência ou divergência bloqueia implementação.
2. Conferir a task, dependências obrigatórias, estado, branch, arquivos existentes e baseline Git; preservar trabalho preexistente.
3. Implementar **somente** `Fazer` e respeitar integralmente `Não alterar`. Persistir testes/evidências; relatar achados, limites e pendências.
4. Não declarar uma task pronta para a próxima sem revisão, condições de conclusão e commits manuais autorizados do workflow vigente. O Git Gateway futuro não integra este Slice 1.
