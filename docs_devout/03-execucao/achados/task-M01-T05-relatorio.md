# M01-T05 — Relatório da implementação inicial

**Papel:** implementador; não é revisão independente nem aprovação da task.  
**Data:** 2026-11-18. **Branch:** `feat/m01-t05`, criada com autorização humana.  
**HEAD de partida:** `e552e8c5044ba09e8305eb57cb52d03db0e4c12b`. Sem commits nesta execução.

## Pré-condições e escopo

- Task lida integralmente em `docs_devout/plano.md`; registro inicial `não iniciada`.
- Checkout inicialmente limpo; mapa, plano e registro rastreados/commitados, sem mudanças pendentes nesses caminhos. Baseline documental `c771c4b` presente no histórico.
- Dependências obrigatórias concluídas, com commits funcionais e de metadados ancestrais do HEAD: T02 (`9c6e88c534e47f95c4c42c72c3797d40631710d1`, `fbde012`); T04 (`3331968cc85834cad17ca625f6a8305452518e0c`, `e552e8c`). A implementação não mudou `main`.
- Consultados contrato v1.0 (processos/cancelamento/exclusividade), ADRs ativos, diagnóstico Windows e interfaces existentes do Driver/lease/Runner.
- Apenas cancelamento local do papel descartável `test`, seus testes e guia. Sem integração OpenClaw, serviço, rede, IPC genérico, segundo Pi para cancelar ou automação de Git/registro pelo executável.

## Arquivos e implementação

- `src/run-control.mjs` (novo): mailbox fechado `control.json` por UUID de run; validação de alvo/identidade, guarda exclusiva por `mkdir`, transações curtas e publicação atômica. Solicitação idempotente, sem sinal por PID ou manipulação da lease global.
- `src/operational-json.mjs` (novo): escritor atômico já existente extraído do Runner para compartilhar exatamente flush/rename/backoff com o controle. Reexportação no Runner preserva a API anterior.
- `src/role-runner.mjs`: CLI `cancel --artifacts-root <absoluto> --run-id <run-UUID>`; checagem antes das fases e polling de 100 ms durante esperas; consumo do pedido com `Driver.cancel()` e término pela lease. Corte final serializado com solicitações antes da publicação do resultado; pedido aceito domina observação técnica correta. Eventos sanitizados `response_started`, `cancel_observed`, `control_closed`; resultado com `cancellation.requested`.
- `src/test/runner-cancel.test.mjs` e `src/test/fixtures/runner-cancel-rpc.mjs` (novos): cancelamento efetivo por CLI independente, streaming, abort/EOF e fallback forçado real sobre Pi fictício; repetições concorrentes, alvo errado/PID histórico, processo alheio vivo, corridas antes/depois do corte, fases/bootstrap, controle inválido/guarda abandonada e lease incerta bloqueando nova aquisição.
- `src/test/smoke-runner-cancel.mjs` (novo), `src/package.json`: smoke opt-in `test:runner-cancel` com Pi real e controlador em processo distinto do Runner.
- `src/ROLE-RUNNER.md`, `src/README.md`: interface, identidade, prazos, recibos, limites, recuperação conservadora e roteiro dos testes.
- Este relatório e `docs_devout/03-execucao/registro.md`: continuidade manual pela skill; não são arquivos alterados pelo Runner.

### Semântica e limites

1. `requested`/`already_requested` confirmam somente persistência, nunca abort, morte ou aprovação. Um Runner morto pode não consumir o pedido; ausência de resultado/prova continua bloqueante para o controlador.
2. Cada fase lineariza seu início sob a mesma guarda usada pelo solicitante. Bootstrap já iniciado pode terminar de vincular o Driver; pedido nesse intervalo cancela antes da fase seguinte. Não há novo prompt ou retry de Pi.
3. A guarda só protege operações síncronas curtas; não permanece adquirida durante a espera de Pi. Contenção: até 2 s, intervalos de 25 ms, sem recuperação automática de guarda abandonada.
4. Pedido vencedor até o corte final resulta em `interrupted`, nunca aprovação/`completed`, inclusive quando Pi já respondeu corretamente ou começou shutdown normal. Após o corte: `too_late`, sem alterar resultado. Estado incerto fechado: `blocked`, exit 1, sem liberar/reconciliar lock.
5. Apenas a prova do Driver vinculada à lease autoriza liberar exclusividade. `closed` do controle, exit 0 da CLI de solicitação e recibo de abort não são essa prova. Controle/resultados podem faltar após falha de disco/crash; não inferir sucesso.
6. Diretórios confiáveis e restritos à conta continuam sendo premissa; arquivos/UUID/PID não oferecem autenticação ou sandbox contra manipulação hostil da mesma conta. Nenhum artefato operacional foi criado no Git.

## Comandos e resultados

Ambiente nativo: Windows, Node `v24.20.0`, npm `11.19.0`, OpenClaw `2026.11.3 (847611d)`, Pi `1.5.2`; launcher descoberto com `Get-Command pi.cmd`.

| Comando/verificação | Resultado observado pelo implementador |
| --- | --- |
| `npm.cmd --prefix src test` após integrar o controle, antes de acrescentar os testes T05 | 90/90, sem falhas/skips |
| `node --test --test-concurrency=1 src/test/runner-cancel.test.mjs` na primeira versão dos testes T05 | 15/15; depois ampliado com controle inválido, streaming textual e testemunha de processo alheio |
| `npm.cmd --prefix src test` na versão final | **106/106**, 0 falhas/cancelamentos/skips; aproximadamente 123,5 s |
| `npm.cmd --prefix src run test:runner-cancel` na versão final | **2/2 casos reais**: streaming e junto ao encerramento, ambos `interrupted`; CIM sem PIDs sobreviventes, repetição `too_late`, nova aquisição/liberação e registro inalterado |
| `npm.cmd --prefix src run test:runner` | **Passou**: regressão normal com Pi real, `succeeded`, `taskApproved:false`, sem força, prova+CIM e reaquisição, registro inalterado |
| `git diff --check` | Sem erros |

Suíte e smokes executados sequencialmente, sem outro Pi do workflow ativo/incerto; os smokes verificam a raiz global padrão. Workspace fictício marcado, perfil isolado sem ferramentas/extensões/MCP/contexto, nenhum segredo ou histórico copiado.

### Evidências reais preservadas fora do repositório

- `%TEMP%\devout-runner-cancel-smoke-gFUaqj\smoke-summary.json` e árvore operacional:
  - Streaming: `run-d8592fba-593c-4c17-834e-88f56e7eb805`; controle pela CLI após primeiro delta textual. `abortAccepted:true`, sem força, Pi e Runner encerrados; `interrupted`, lease liberada, CIM e reaquisição confirmados.
  - Junto ao encerramento: `run-b61fcf64-2e18-475e-9454-ffa11c8756bc`; API local no controlador independente já carregado, após evento `stopping`. Resposta esperada já observada e `termination.workCompleted:true`, mas pedido aceito antes do corte prevaleceu: `interrupted`. Shutdown normal já iniciado não é reaberto; `abortAccepted:false` nesse caso não produz falso sucesso.
- `%TEMP%\devout-runner-smoke-MshvfS\smoke-summary.json`: regressão normal real, `run-9ffa50b8-9062-4ff9-a3d8-28f689e8f784`, sucesso técnico sem aprovação de task, término e reaquisição confirmados.
- Primeira tentativa do novo smoke, preservada em `%TEMP%\devout-runner-cancel-smoke-PnpCex`: streaming passou; a CLI iniciada somente ao receber `stopping` chegou **depois** do corte no segundo caso e retornou corretamente `too_late`. A asserção que exigia `requested` falhou; o Runner manteve sucesso técnico normal, sem aceitar/descartar um pedido. Ajustado **somente o teste** para usar a API local do controlador independente já carregado no ponto estreito; streaming e repetições continuam usando a CLI real. Não foi introduzida espera artificial no Runner nem alterada a arbitragem para fazer o smoke passar.

## Entregáveis e critério de conclusão — conferência do implementador

- Interface controlada de cancelamento por `runId` ativo: CLI/API implementadas e documentadas, com identidade por diretório único + `runId` interno, sem selecionar processo por PID.
- Runner ativo recebeu pedido de outra invocação de controle durante resposta textual real, acionou abort e verificou encerramento do Pi identificado; persistiu interrupção sem `completed`/aprovação.
- Pedidos concorrentes/repetidos e ambos os lados da corrida final testados; pedido tardio não altera execução/resultado nem mata processo alheio. Pedido aceito imediatamente antes de encerrar não vira sucesso técnico.
- Fallback com `taskkill` real sobre alvo fictício resistente foi exercitado; prova de término continua no Driver. Falha/identidade incerta conserva a lease e bloqueia outro lançamento no teste com o código da lease e observador simulado, sem abrir Pi adicional.
- Proibições preservadas: nenhum serviço/HTTP/IPC genérico, nenhum segundo Pi para cancelar e nenhuma liberação sem prova. Driver e implementação da trava global não foram alterados.

## Pendências / próxima conversa

- Revisão independente ainda necessária; este documento não a substitui. Nenhum commit autorizado/realizado nesta execução; nenhuma próxima task iniciada.
- Na entrega inicial, `fontes-revisao.json` autorizava apenas T01–T04; a preparação da seleção T05 exigia autorização/recorte antes da revisão, sem fallback para plano/relatos integrais. A autorização e a preparação posteriores estão registradas no apêndice abaixo.
- Após essa preparação, iniciar conversa nova no papel de revisor. Dois commits somente depois de aprovação e autorização humana explícita cobrindo ambos.

## Apêndice — preparação autorizada da entrada de revisão T05

**Data:** 2026-11-18. O usuário autorizou a preparação após a entrega inicial. Esta etapa é configuração da entrada, não mudança de papel para revisor nem aprovação técnica. A task permanece `aguardando revisão`; nenhum commit foi realizado/autorizado nesta preparação.

### Alterações e recorte

- `docs_devout/03-execucao/fontes-revisao.json`: acrescentada somente a seleção M01-T05, com task integral, restrições globais e dependências, contrato vigente e decisões aplicáveis. As seleções T01–T04 foram comparadas estruturalmente com a configuração anterior e permaneceram idênticas.
- `AGENTS.md`: mapa e instruções passam a incluir T05; comando de exemplo usa T05. Nenhum resultado técnico da implementação foi introduzido na entrada normativa.
- `docs_devout/plano.md`: apenas os quatro rótulos em negrito de T05 foram convertidos em subtítulos Markdown. Uma comparação normalizando esses quatro rótulos confirmou igualdade integral com HEAD: texto dos requisitos, proibições, entregáveis, critério, dependências e demais tasks preservados.
- `src/README.md`, `src/PI-LOCK.md`, `src/ROLE-RUNNER.md` e diagnóstico Windows: integralmente adiados. Evidências históricas/protótipos e trechos mistos permanecem adiados; do registro de integração entra inicialmente somente a decisão de exclusividade. Tasks T01–T04 e T06 ficam fora do recorte inicial de T05, salvo metadados/referências na tabela de dependências.
- Relatório, Observações, configuração e diffs integrais das fontes continuam adiados para o confronto. O código/testes da entrega continuam disponíveis para inspeção independente na fase inicial. O adiamento não elimina nenhum arquivo da revisão final.
- Nenhum arquivo de `src/`, `.agents/`, protótipos ou contrato foi alterado nesta preparação. Hashes dos 28 arquivos de `src/` foram comparados com o estado imediatamente anterior à preparação e permaneceram iguais; por isso não se repetiu Pi/provedor para uma mudança apenas documental.

### Validação da preparação

Executados `review_inputs.py <registro> <ID> --sources <config>` e `--check-input <entrada>` para **T01, T02, T03, T04 e T05**: todos passaram. T05 contém os quatro campos, estado `aguardando revisão`, partições completas e 17 fontes com hashes. Foram conferidos o adiamento integral dos três guias, a presença de fontes/registro/relatório em `deferred_changed`, a ausência de relatos em `untracked_allowed` e a ausência dos resultados desta implementação no conteúdo normativo. A entrada T04 anterior à mudança de configuração foi recusada por `--check-input` como desatualizada (exit 2), sem modificar fontes ou index.

JSONs gerados e resumo de validação preservados **fora do repositório** em `%TEMP%\devout-T05-fontes-n2w_q1k9\`; não devem ser versionados nem usados como avaliação independente. O próximo revisor deve gerar/revalidar sua própria entrada antes de ler narrativas.

Identificação da entrada T05 validada nesta preparação (não é parecer):

- `git_revision`: `e552e8c5044ba09e8305eb57cb52d03db0e4c12b`.
- `config.sha256`: `50cd7b833200359959934e85a2cbbfaaaec4679b83341804cbf3d98a97408cab`.
- `input_id`: `8bc7bf4235c9bc915c7d7b849b818400a8e9d103880fdd4610a05b9777ad64d1`.
- `snapshot`: `f1a7851e9087686dab869c4b975d6ebf47a4c87c86b73271b97000ff939dee48`.
- Hashes integrais das fontes: `source_manifest` no JSON temporário `M01-T05.json`; verificações em `validation-summary.json` no mesmo diretório.

**Próximo passo:** conversa nova para revisar M01-T05 pela entrada filtrada. A autorização recebida não foi tratada como autorização de commits nem como permissão para o implementador revisar o próprio trabalho.

## Correção após revisão 1

**Papel:** corretor, em conversa nova; **data:** 2026-11-18; **branch:** `feat/m01-t05`; HEAD preservado `e552e8c5044ba09e8305eb57cb52d03db0e4c12b`. Referência: [task-M01-T05-revisao-1.md](task-M01-T05-revisao-1.md), `Estado: finalizada`, Decisão final **T05-R1-I01 (importante)**. Primeira correção completa; sem commits, aprovação técnica ou avanço para T06.

### Gate e retificação

- Task e proibições conferidas; registro recebido em `em correção`, R1 com zero correções completas, relatório inicial presente. Baseline e commits funcionais/de metadados das dependências T02/T04 confirmados como ancestrais de HEAD. Alterações preexistentes preservadas; sem troca de branch/index.
- **Retificação explícita:** os `pass:true` de streaming da implementação inicial (`gFUaqj`) e da R1 (`azUKs1`) não comprovam cancelamento durante geração. O pedido chegou após settlement; abort aceito e resultado `interrupted` não bastavam. A afirmação anterior de cancelamento ativo real na conferência do critério deve ser lida como superada por esta correção, não como evidência válida. As evidências e seções anteriores foram preservadas, sem reescrita. O caso de último instante e os testes fictícios continuam distintos e válidos.

### Arquivos modificados nesta correção

- `src/test/helpers/active-cancellation.mjs` (novo): verificador compartilhado pelo smoke e suas regressões. Exige identidade do run, primeiro delta, pedido persistido, consumo e settlement únicos, ordem por sequência e instantes (`response_started <= requestedAt <= cancel_observed < agent_settled`), ausência de falha/encerramento antes do consumo, evidência final de abort/erro do assistente, abort aceito, sem força nem `workCompleted`. Ordem ausente/inconclusiva, inclusive empate de milissegundo entre consumo e settlement, falha conservadoramente.
- `src/test/smoke-runner-cancel.mjs`: usa controlador independente já carregado nos dois pontos estreitos, sem criar segundo Pi, esperar artificialmente no Runner ou mudar o corte. Prompt fictício de prosa longa substitui enumeração que podia concluir rapidamente. Só marca streaming como aprovado após a validação cronológica e de interrupção; resumo registra cronologia sanitizada. Repetição tardia continua pela CLI. Acrescenta testemunha de processo alheio vivo; mantém prova do Driver, CIM, término do Runner, exclusividade, reaquisição e registro inalterado.
- `src/test/runner-cancel.test.mjs`: oito testes novos. Cobrem evidência ativa válida e rejeições por pedido tardio, consumo tardio, empate temporal, encerramento prévio, recibo isolado e settlement ausente. Regressão integrada determinística completa resposta naturalmente e só depois solicita pela CLI independente durante `finish`: o Runner corretamente publica `interrupted`, mas a validação do smoke rejeita `ACTIVE_CANCEL_ORDER_INVALID` mesmo com `abortAccepted:true`. Sem depender de atraso arbitrário para ordenar a corrida. CLI ativa com processos fictícios e fallback forçado preservados.
- `src/ROLE-RUNNER.md`: roteiro corrigido para distinguir API no controlador independente de CLI de repetição e explicitar rejeição de falsos positivos.
- Este relatório e, após sua persistência, `docs_devout/03-execucao/registro.md`, via script oficial. Nenhuma mudança nesta correção em Driver, lease, Runner, mailbox, contrato, plano, fontes de revisão, mapa, protótipos ou skills.

`Driver.cancel()` pode rejeitar `promptAndWait` imediatamente e só depois receber o settlement abortado. Por isso `prompt_observed` não é obrigatório no verificador: se presente, precisa estar após settlement e indicar interrupção; em todos os casos são obrigatórios settlement no journal e flags finais de interrupção do assistente. Não se infere interrupção apenas do recibo de abort.

### Comandos e resultados próprios

Ambiente Windows nativo: Node `v24.20.0`, npm `11.19.0`, Pi `1.5.2`, OpenClaw `2026.11.3 (847611d)`; launcher confirmado por `Get-Command pi.cmd`. Testes/smokes executados sequencialmente, sem outro Pi do workflow ativo/incerto, apenas workspaces fictícios marcados e perfil isolado sem ferramentas/contexto.

| Comando/verificação | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 src/test/runner-cancel.test.mjs` | 24/24, zero falhas/skips; log `%TEMP%\devout-t05-I01-focused.log` |
| `npm.cmd --prefix src test` na versão final | **114/114**, zero falhas/cancelamentos/skips, 123281 ms; log `%TEMP%\devout-t05-I01-tests.log` |
| `npm.cmd --prefix src run test:runner-cancel` na versão final | **2/2 reais**, exit 0; streaming ativo com settlement abortado e caso distinto de pedido em `stopping`; log `%TEMP%\devout-t05-I01-real-final.log` |
| `npm.cmd --prefix src run test:runner` | Exit 0, sucesso técnico normal, término+CIM e reaquisição confirmados, registro inalterado; log `%TEMP%\devout-t05-I01-normal.log`, evidência `%TEMP%\devout-runner-smoke-8Vdhcx\smoke-summary.json` |
| Verificador final aplicado aos journals/controles/resultados históricos `gFUaqj` e `azUKs1`, sem modificá-los | Ambos rejeitados com **`ACTIVE_CANCEL_ORDER_INVALID`**; evidência nova `jo9EIP` aceita |
| `git diff --check` | Exit 0, sem erros |

Primeira tentativa real desta correção preservada em `%TEMP%\devout-runner-cancel-smoke-kfC5GY\smoke-summary.json` (log `%TEMP%\devout-t05-I01-real.log`): retornou exit 1/`pass:false`, pois a primeira versão do verificador exigia `prompt_observed`, ausente quando o Driver rejeita a espera imediatamente por cancelamento. Journal mostrava consumo antes do settlement abortado. Ajustado somente o verificador para a semântica descrita acima, acrescentada cobertura determinística, e repetidos smoke e suíte na versão final. Não houve falso `pass` nesta tentativa nem alteração do Runner para produzi-lo.

### Nova evidência real sanitizada

Resumo e árvore operacional preservados **fora do Git** em `%TEMP%\devout-runner-cancel-smoke-jo9EIP\smoke-summary.json`:

- **Streaming:** `run-878faf69-9556-4b7b-bcdb-20440b4ce238`. Primeiro texto às **12:47:57.138Z** (seq 6); pedido persistido às **12:47:57.151Z**; consumo às **12:47:57.226Z** (seq 7); settlement às **12:47:57.248Z** (seq 10), todos em 2026-11-18 UTC. `aborted:true`, `assistantError:true`, `abortAccepted:true`, `forced:false`, `workCompleted:false`; não houve settlement, falha ou stopping anterior ao consumo. Nova validação cronológica passou.
- **Último instante:** `run-5285e9aa-1afd-4ecd-99ad-ffce7beca50f`. Resposta e marcador já observados, `workCompleted:true`, `aborted:false`; pedido aceito em `stopping` antes do corte prevaleceu como `interrupted`. Não é classificado como cancelamento ativo da geração.
- **Ambos:** Runner exit 1 e fechado; `taskApproved:false`, `state:terminated`, `processesGone/canRelease:true`, lease liberada; repetição CLI `too_late`; CIM independente sem PIDs sobreviventes; testemunha de processo alheio continuou viva (encerrada somente pelo próprio harness ao fim); nova aquisição/liberação possível; `registro.md` inalterado durante o smoke.

**Handoff:** I01 tratado nesta primeira correção, pendente de reauditoria completa R2 em **conversa nova**, com entrada filtrada pelo preparador. Registro devolvido a `aguardando revisão` somente após persistir este relato. Não é declaração de task concluída nem autorização para commits.
