# M01-T06 — Relatório da implementação inicial, com tentativas preservadas

## Situação atual

**Implementação pronta para revisão independente, não aprovação técnica.** A cadeia real com os quatro casos foi demonstrada, os artefatos e chamadas do runtime OpenClaw foram confrontados, e a suíte final passou **152/152**, sem skips. Procedimento em `src/OPENCLAW.md`; evidências finais e limites nas últimas seções deste relatório. Bloqueios/tentativas anteriores abaixo são históricos, não apagados. Sem commits, sem revisão realizada e sem avanço para outra task.

## Histórico — situação no primeiro diagnóstico

**Implementação bloqueada na verificação do ambiente; não pronta para revisão.**
Não constitui aprovação técnica, conclusão da task ou demonstração da cadeia real.

## Escopo e gates verificados

- Task consultada integralmente em `docs_devout/plano.md`, com Fazer, Não alterar, Entregáveis e Critério de conclusão; limites globais e dependências também consultados.
- Checkout inicialmente limpo, branch `main`, HEAD `fb991a9c21170edfea1e50852e3e7d15565ab66d`. Nenhuma troca de branch, commit ou integração realizada.
- `AGENTS.md`, plano e registro rastreados e sem alterações pendentes antes desta tentativa. Baseline existente: `c771c4b39a34716f15728c1e0d5b2596e776bc41`.
- Dependências M01-T04 e M01-T05 constam como concluídas. Commits funcionais `3331968cc85834cad17ca625f6a8305452518e0c` e `5e71f1a4869cf0d77ba4afb1a1494696a4a1b7ef`, e commits de metadados `e552e8c5044ba09e8305eb57cb52d03db0e4c12b` e `fb991a9c21170edfea1e50852e3e7d15565ab66d`, confirmados no histórico atual.

## Diagnóstico próprio desta tentativa

Comandos executados na raiz, conforme `docs_devout/how-to/diagnosticar-ambiente-windows.md`:

| Comando | Resultado sanitizado |
| --- | --- |
| `node --version` | `v24.20.0` |
| `npm.cmd --version` | `11.19.0` |
| `openclaw.cmd --version` | `2026.11.3 (847611d)` |
| `pi.cmd --version` | `1.5.2` |
| `where.exe pi.cmd` | Launcher encontrado na instalação local `.pi/agent/bin/pi.cmd` |
| `openclaw.cmd config get gateway.mode` | `local` |
| `openclaw.cmd gateway status --json` | Gateway inacessível; `rpc.ok=false`, `connect ECONNREFUSED 127.0.0.1:18789`; porta livre; serviço Scheduled Task não carregado |

A mesma consulta de status reportou configuração CLI/daemon inválida (`valid:false`), com a questão `agents.entries must contain at least one configured agent`. Nenhuma configuração completa, credencial, histórico ou log bruto foi copiado para o repositório.

## Bloqueio e decisão

O plano prevê interrupção por bloqueios externos de OpenClaw/Gateway. Sem Gateway acessível e com configuração reportada como inválida, não é possível comprovar a interface local `exec`/`process` nem executar a cadeia real requerida. Interrompida a tentativa antes de criar scripts, lançar Runner/Pi, abrir portas ou alterar configuração, políticas e credenciais.

Não se tentou iniciar/reiniciar o Gateway, configurar agentes, instalar serviço ou substituir a integração real por simulação. A resolução exige preparar/validar o OpenClaw local com decisão humana sobre qualquer alteração necessária. Este diagnóstico não afirma quais permissões/ferramentas estarão disponíveis após a resolução.

## Alterações desta tentativa

- Este relatório de bloqueio.
- `docs_devout/03-execucao/registro.md`: transição de M01-T06 de `não iniciada` para `pausada`, exclusivamente via `update_registro.py`, com motivo e referência ao relatório.

Nenhum código do Runner/Driver, skill, protótipo ou requisito alterado. Sem commits.

## Entregáveis e critério de conclusão

Não atingidos: procedimento validado na instalação real, evidências OpenClaw → Runner → Driver → Pi, acompanhamento por mesmo `runId`, exclusividade, cancelamento e falhas sem falso sucesso. Não foram executados testes/smokes, pois o bloqueio precede a implementação e não houve mudança de código. Nenhum processo Pi de teste foi iniciado nesta tentativa.

## Atualização após início manual pelo usuário

O usuário informou ter executado `openclaw.cmd gateway run --verbose`. Duas novas consultas a `openclaw.cmd gateway status --json` observaram primeiro timeout de conexão e depois `rpc.ok:true`, servidor `2026.11.3`, escutando somente em loopback. Portanto, a indisponibilidade inicial do Gateway deixou de ser o bloqueio observado.

A consulta ainda reporta configuração CLI/daemon `valid:false`, com `agents.entries must contain at least one configured agent`. A conexão identificou capacidade `connected_no_operator_scope`, sem scopes; isso não comprova autorização para executar ferramentas. Nenhum ajuste de configuração ou chamada de execução foi realizado nesta atualização. A task permanece pausada até esclarecer configuração e acesso efetivo aos mecanismos necessários.

## Investigação autorizada, sem alterar configuração

Após autorização do usuário para investigar o ajuste mínimo:

- `openclaw.cmd config validate --json` retornou `valid:true`, sem avisos.
- `openclaw.cmd agents list --json` e `gateway call agents.list` reconheceram o agente `main`; o runtime informou propriedade `sole` e seleção padrão desse agente. Portanto, não há evidência para criar outro agente apenas com base no diagnóstico inicial de status.
- `gateway status --json` ainda reportou `agents.entries` vazio/configuração inválida e conexão sem scopes. Esses campos não devem ser tomados isoladamente como diagnóstico definitivo: as consultas RPC de agentes e ferramentas funcionaram. A causa da divergência entre as consultas não foi determinada.
- `gateway call tools.catalog` listou `exec` e `process`; `tools.effective` para `agent:main:main` também os marcou como disponíveis na projeção da sessão. A documentação ressalva que projeção não garante execução.
- Tentativa de invocar somente `node --version` via `gateway call tools.invoke` retornou `ok:false`, `not_found`, `Tool not available: exec`. Não foi iniciado Runner/Pi. Uma primeira tentativa com caminho Windows explícito foi recusada localmente por JSON inválido; a chamada corrigida omitiu esse caminho.
- A documentação instalada (`docs/gateway/tools-invoke-http-api.md` e `docs/gateway/protocol/operator-methods.md` do pacote OpenClaw) descreve que `tools.invoke` compartilha a política da API direta, cuja lista padrão bloqueia `exec`. Portanto, essa recusa não comprova ausência de `exec` em um turno normal do agente.

Recomendação: não criar agente redundante nem liberar `exec` em `gateway.tools.allow` para contornar a proteção da API direta. O próximo teste proposto é um turno normal e delimitado do OpenClaw, inicialmente só com `node --version`, antes da demonstração do Runner. Isso ainda precisa de validação real; não representa conclusão da integração. Nenhuma configuração, permissão, credencial ou serviço foi alterado nesta investigação.

## Retomada autorizada e implementação parcial

O usuário autorizou o teste em turno normal e a retomada se funcionasse. A chamada pelo Gateway `openclaw.cmd agent --agent main --session-key agent:main:devout-t06-diagnostic-20261118 --message <pedido delimitado> --timeout 90 --json` retornou a versão Node `v24.20.0`; o recibo do runtime registrou `exec` entre as ferramentas bem-sucedidas (run OpenClaw `bcb1af42-1d58-4dee-b76f-35de3f6aafc6`). Nenhuma configuração foi alterada. O registro foi retomado via script para `em andamento`.

Criados, ainda **parciais e não aprovados**:

- `src/test/probe-openclaw.mjs`: preparador de quatro solicitações fictícias fora do Git, mensagem de instruções e verificações de resultado/eventos/state/control, CIM, exclusividade e hash do registro. Não lança Runner/Pi: o disparo é feito pelas ferramentas reais do OpenClaw. Não altera configuração ou tarefas oficiais.
- `src/test/openclaw-procedure.txt`: roteiro delimitado para um turno real, usando `exec` com `yieldMs:1000`, `pty:false`, `timeoutSeconds:240` e acompanhamento por `process.poll`/`process.log`. Sem liberação da API direta, delegação, portas ou restart.
- `src/test/helpers/openclaw-evidence.mjs`: verificador determinístico de conclusão normal, cancelamento ativo, duplicidade e resposta divergente, sem aprovação de task.
- `src/test/openclaw-evidence.test.mjs`: 20 testes determinísticos, incluindo rejeição de resultado ausente, exit zero sem settlement, identidade/diário incoerentes, liberação incerta, falso sucesso e cancelamento tardio.

### Primeira demonstração real — evidência insuficiente, preservada

Raiz operacional: `%TEMP%/devout-openclaw-probe-5WqPAf`. Turno pelo Gateway `7794148a-b7b1-4a30-aacb-fae16756c1af`, sessão `agent:main:devout-t06-probe-5WqPAf`; recibo do runtime registrou `exec` e `process` bem-sucedidos. O controlador retornou 32 chamadas de ferramentas e interrompeu a sequência quando o verificador recusou a evidência. Não foram executados os casos normal/mismatch.

| Caso | runId do Runner | Handle exec OpenClaw | Evidência própria |
| --- | --- | --- | --- |
| Cancelamento | `run-3f072a27-dc06-4d1f-8cc1-88a1550af1f1` | `mild-atlas` | Resultado `interrupted`, `taskApproved:false`, abort aceito, `observed.settled:true`, `observed.aborted:true`, árvore encerrada e lease liberada; check de cronologia **falhou** |
| Duplicidade | `run-baf649e9-5884-45f1-b63f-bbe99b33621d` | `clear-shoal` | `failed`, `LOCK_BUSY`, `lock.acquired:false`, `termination:null`, nenhum evento Pi; check passou |

Cronologia sanitizada do primeiro Runner (UTC): `state_observed` 13:30:59.486, `response_started` 13:31:10.949, pedido persistido 13:31:33.540, `cancel_observed` 13:31:33.584, resultado final 13:31:33.816. A duplicidade ocorreu de 13:31:28.970 a 13:31:30.516, dentro da janela ativa. O Runner contou 679 eventos Pi. Como a interface T04/T05 documenta resumos Pi somente até 512 eventos, o `agent_settled` não ficou no diário; o verificador estrito de cancelamento ativo recusou a comprovação temporal. Não se promoveu a tentativa a sucesso apenas pelo resultado/abort.

Após a tentativa, conferência independente via CIM encontrou zero PIDs entre Runner `7796` e os processos observados `7688`, `192`, `1416`, `6372`, `416`; `inspectPiLock` retornou `free`, `canAcquire:true`. Nenhum arquivo de lease foi removido/reconciliado e nenhum processo foi morto por PID.

O roteiro foi ajustado para disputar duplicidade após `state_observed` (Pi já pronto), preferencialmente antes do primeiro texto, e cancelar imediatamente após `response_started`, na mesma execução Code Mode quando disponível. O gate temporal passou a aceitar duplicidade após Pi pronto, sem impor geração de texto como pré-condição não exigida pela task. A verificação estrita de cancelamento antes de settlement foi mantida. **Nenhuma alteração no Runner/Driver ou limite de 512 eventos.**

`%TEMP%/devout-openclaw-probe-4hgK9k` contém somente preparação intermediária, sem disparos. Nova preparação pelo script atualizado: `%TEMP%/devout-openclaw-probe-s0Ydvd`.

### Novo bloqueio — Gateway caiu durante o disparo ajustado

Na chamada `openclaw.cmd agent --agent main --session-key agent:main:devout-t06-probe-s0Ydvd --message-file <raiz>/openclaw-instructions.txt --timeout 360 --json`, a CLI informou `Gateway agent call connection closed` e alertou que o turno poderia ainda estar executando, vedando repetição cega. A projeção da resposta não trouxe `runId`/resultado; isso **não** foi tratado como sucesso. Não houve retry nem fallback `--local`.

A consulta posterior `gateway status --json` mostrou porta 18789 livre, nenhum listener e `rpc.ok:false`, `ECONNREFUSED`. A raiz `s0Ydvd` contém só solicitações/mensagem/workspace de preparação, sem pasta `operacional` ou resultado de Runner. A causa da queda é desconhecida; não houve reinício deliberado pelo implementador.

Checagens conservadoras após a queda:

- `inspectPiLock`: `status:free`, `canAcquire:true`, `canReconcile:false`.
- CIM filtrando processos Node do Runner/host: `CONTROLLED_PROCESS_COUNT=0`. Essa observação não substitui reconciliação de uma lease incerta; nesta consulta não havia lease bloqueante.
- Teste focal atualizado `node --test src/test/openclaw-evidence.test.mjs`: **20/20 passaram**, sem skips.

A M01-T06 volta a **pausada**. Arquivos e tentativas preservados; sem alteração de configuração, restart, limpeza ou commits. A suíte completa ainda não foi executada; o roteiro ajustado, conclusão normal, resposta divergente, resumo final e documentação de uso consolidada continuam pendentes. Esta atualização substitui qualquer interpretação de que os entregáveis já estejam completos.

## Histórico — retomada que estava pendente após a queda

1. O operador deveria esclarecer a queda/disponibilizar novamente o Gateway local, sem expor logs com tokens ou outras credenciais.
2. Antes de repetir ou despachar, conferir o transcript da sessão exata `agent:main:devout-t06-probe-s0Ydvd`, as evidências em disco e a exclusividade. Reconectar não comprova retomada durável. Não reiniciar a execução apenas porque o cliente perdeu a conexão.
3. Retomar somente após resolução explícita do bloqueio, preservando esta tentativa, e completar os casos reais, documentação e suíte. Sem revisão/commits/avanço enquanto o critério de conclusão não estivesse demonstrado.

## Retomada após o operador reabrir o Gateway

O usuário informou ter reaberto o Gateway. Foram verificados `rpc.ok:true`, loopback, `sessions.get` sem mensagens e `sessions.describe` com `session:null` para `agent:main:devout-t06-probe-s0Ydvd`; a raiz continuava sem runs, `inspectPiLock` retornava livre/adquirível e CIM não encontrava Runner/host. Essa reconciliação autorizou nova tentativa identificada; não houve replay ou retomada durável presumidos. O registro foi retomado via script, sem alterar configuração.

### Experimento de limite assíncrono — preservado, não aprovado

Raiz `%TEMP%/devout-openclaw-probe-hrlWDP`, turno OpenClaw `23c53beb-d6fa-475a-85a2-bd672b9ddb29`, sessão `agent:main:devout-t06-probe-hrlWDP`. Runner `run-79b4b107-f8c7-4cf1-9682-3b934df44eed` chegou a `response_started`, mas o shell ficou bloqueado até `SETTLED_TIMEOUT`, sem handle intermediário: resultado `failed`, `terminated`, sem pedido de cancelamento, árvore encerrada e lease liberada. PIDs `11596`, `9152`, `9320`, `5100`, `2316`, `8668` ausentes em conferência independente via CIM antes de nova preparação.

O transcript do runtime mostrou `yieldMs:1000` no shell, porém `awaitResults:true` na célula externa Code Mode, propagado à chamada interna. A documentação instalada `docs/tools/code-mode/tool-surface.md` explica que células required coletam shells até o término. Isso não prova ausência de suporte assíncrono; foi uso inadequado do modo de espera para este procedimento. O roteiro passou a explicitar `awaitResults:false` em ambos os níveis, mantendo `yieldMs:1000` e sem mudar política/configuração ou iniciar serviço independente.

### Demonstração final real — extrato sanitizado

Raiz preservada: `%TEMP%/devout-openclaw-probe-GId5dd`. Turno pelo Gateway `4a0217d5-9c17-4cfb-aba5-68e900bdcf7a`, sessão `agent:main:devout-t06-probe-GId5dd`. Runtime e chamadas foram consultados por `gateway call sessions.get` **só para essa sessão descartável**; transcript bruto não foi versionado. O extrato a seguir foi conferido contra os arquivos locais, não aceito por relato do modelo.

Todos os quatro disparos reais usaram `pty:false`, `yieldMs:1000`, `awaitResults:false`, `timeoutSeconds:240`, retornaram `status:running`/handle e tiveram coleta terminal `process.poll` e leitura `process.log`. Cada comando foi `node "<runner-absoluto>" run --config "<root>/<caso>.json"`, sem shell variável, acesso direto ao Pi ou nova raiz de exclusividade.

| Caso | runId persistido | Handle exec | Intervalo Runner (UTC) | Coleta terminal OpenClaw (UTC) | Resultado |
| --- | --- | --- | --- | --- | --- |
| cancel | `run-dd1b5958-e7db-464f-a64d-a32cfcd6f0a9` | `tidal-falcon` | 16:14:26.668–16:14:54.867 | 16:14:55.088, exit 1 | `interrupted`, `CANCELLED` |
| duplicate | `run-5562fd0a-2ff6-41e8-b43e-e51863eca516` | `mild-haven` | 16:14:50.360–16:14:51.693 | 16:14:51.855, exit 1 | `failed`, `LOCK_BUSY`, sem Pi |
| normal | `run-1826920a-daa6-41ec-af61-9042dd7c0b31` | `delta-atlas` | 16:15:14.192–16:15:20.975 | 16:15:21.180, exit 0 | `succeeded`, marcador esperado |
| mismatch | `run-a5d439c1-0a71-4d88-be72-cafc0749e9f7` | `sharp-harbor` | 16:15:28.446–16:15:34.721 | 16:15:35.070, exit 1 | `failed`, `RESPONSE_MISMATCH` |

Data dos intervalos: **2026-11-18**. Todos têm `taskApproved:false`. Para cancel/normal/mismatch, o resultado foi `terminated`, `termination.processesGone:true`, `canRelease:true`, `forced:false`, Pi `exitCode:0`, lease adquirida e liberada. Cancelamento e mismatch **não** se tornaram sucesso pelo exit 0. A duplicidade não adquiriu lease, não tem prova de Pi (`termination:null`), não aceitou prompt nem emitiu evento Pi; o disparo ocorreu com o primeiro Pi ativo. O verificador também confirmou o término do Runner duplicado.

**Cronologia de cancelamento ativo (UTC):**

- Pi pronto: 16:14:30.344.
- Primeiro texto: 16:14:48.814, seq 6.
- Pedido via comando de controle lançado pelo OpenClaw, recibo `requested`: 16:14:54.572.
- Consumo: 16:14:54.607, seq 7.
- `agent_settled`: 16:14:54.656, seq 10.
- Resultado: 16:14:54.867; `observed.aborted:true`, `assistantError:true`, `abortAccepted:true`, `workCompleted:false`; 191 eventos Pi, abaixo do limite de resumos.

O pedido e seu consumo precederam o settlement, sem força. A duplicidade ocorreu depois do primeiro texto, mas **antes do pedido/término**, satisfazendo a janela de Pi ativo; iniciar antes do texto era preferência de latência, não requisito adicional. O controlador não manteve o primeiro disparo e toda a sequência na mesma célula; esse agrupamento era mitigação de latência, não condição assumida como cumprida. A ordem efetiva foi verificada, sem inventar aderência perfeita ao roteiro.

**Cronologia normal (UTC), mesmo runId em eventos/state/control/result:** starting 16:15:14.203 → lock 16:15:15.683 → running 16:15:17.361 → comunicação/modelo 16:15:18.368 → `agent_start` 16:15:18.391 → texto 16:15:20.706 → `agent_settled` 16:15:20.719 → prompt aceito/sem erro/marcador correto 16:15:20.721 → stopping 16:15:20.726 → controle fechado 16:15:20.962 → terminated 16:15:20.973 → resultado persistido 16:15:20.975 → coleta do handle 16:15:21.180. Não se usou apenas aceitação, `agent_end`, exit code ou texto como conclusão.

`summary.json` gerado às 16:15:51.360 registrou os quatro checks, ordem, PIDs ausentes via CIM, hash do registro inalterado e reaquisição/liberação final. A projeção independente `trace` também passou: quatro handles distintos, chamadas exatas, coleta terminal, logs e recibo correspondentes aos runIds. Contagens de poll/log por Runner: cancel 4/2, duplicate 2/1, normal 10/1, mismatch 11/1. O normal só foi invocado às 16:15:13.284, após coleta/liberação/verificação do cancelamento; mismatch foi invocado às 16:15:27.711, após coleta normal.

**Erro do controlador preservado:** o runtime conta um `SyntaxError` em `exec`, às **16:16:08.333**, posterior ao resumo/checks (16:15:51.360). O agente relatou falha ao interpretar novamente o log final. O erro não foi apagado nem tratado como aprovação; a projeção `gateway-trace.json` conserva `controllerToolErrors:1`. A validação dos artefatos e retornos originais foi refeita localmente, inclusive por pipeline PowerShell nativo, e passou. Este relatório comprova os quatro cenários técnicos delimitados, **não** afirma turno sem erros nem orquestração robusta de workflow por modelo.

## Entrega final e comandos verificados

Arquivos entregues/alterados nesta task:

- `src/OPENCLAW.md`: pré-condições, comandos PowerShell repetíveis, diagnóstico divergente, papéis dos IDs/handles, invocação/timeout, verificação e limites/falhas/restart.
- `src/test/openclaw-procedure.txt`: roteiro usado no turno real, com caminhos preenchidos pelo preparador e explicitação do modo ordinary/assíncrono.
- `src/test/probe-openclaw.mjs`: preparação sem lançar Pi, checks por cenário, resumo com reaquisição e projeção whitelist de transcript recebido por stdin, sem persistir material bruto.
- `src/test/helpers/openclaw-evidence.mjs`: gates determinísticos de artefatos/cronologia/correlação runtime. Não implementa estados oficiais ou aprovação.
- `src/test/openclaw-evidence.test.mjs`: **38 testes novos**, positivos/negativos, inclusive canário de sanitização, campos ausentes/tipos, identidade nativa, cancelamento tardio, replay/disparo repetido, falta de coleta, IDs divergentes e `awaitResults` inadequado.
- `src/README.md`, `src/ROLE-RUNNER.md`: links para o procedimento, sem mudar contrato do Runner/Driver.
- Este relatório e `docs_devout/03-execucao/registro.md` (apenas skill, via script).

| Verificação | Resultado |
| --- | --- |
| `node --test src/test/openclaw-evidence.test.mjs` final | **38/38**, sem skips |
| `npm.cmd --prefix src test` intermediário | **134/134**, antes de adicionar gates de trace e endurecer campos |
| `npm.cmd --prefix src test` final | **152/152**, sem skips/falhas, aproximadamente 121 s |
| `node src/test/probe-openclaw.mjs prepare` + turno real `openclaw.cmd agent` | quatro casos reais acima; tentativas anteriores preservadas |
| `gateway call sessions.get ... --json` canalizado a `node src/test/probe-openclaw.mjs trace <root>` | passou, reconfirmando artefatos, handles/coleta/logs e cronologia; um erro posterior do controlador explicitamente contado |
| Mesma projeção em Windows PowerShell, UTF-8 e escape JSON para `.cmd` | passou, sem reduzir política; consulta de sessão ausente também validada |
| `git diff --check` | passou |
| Consulta final da trava após suíte | `free`, `canAcquire:true` |

Uma tentativa de executar arquivo diagnóstico `.ps1` foi bloqueada pela política local. Não houve bypass/mudança de política: o procedimento documentado usa comandos interativos e o teste equivalente com `powershell.exe -Command` funcionou. Não há lint definido. Nenhum smoke antigo extra com provedor foi necessário: os quatro cenários reais T06 consumiram Runner/Driver/lease reais, e a suíte cobriu as regressões de T01–T05 com processos fictícios.

As evidências completas sanitizadas de Runner e os resumos estão fora do Git na raiz `GId5dd`; este relatório é o extrato curado versionável. `trace` descarta o transcript bruto após projetar apenas campos permitidos. O hash do registro é o snapshot de preparação: a atualização manual desta skill para revisão, feita depois dos checks, naturalmente altera esse hash. Não editar o snapshot para forçar revalidação futura; nova reprodução deve preparar nova raiz após confirmar exclusividade.

## Critério de conclusão confrontado pelo implementador

- **Invocação iniciada pelo OpenClaw e acompanhada até resultado persistido:** normal real, handle e runId distintos/correlacionados; retorno `running`, polling/logs e coleta terminal comprovados no runtime; arquivos/settlement/prova nativa verificados.
- **Duplicidade não cria segundo Pi:** Runner concorrente retornou `LOCK_BUSY`, sem aquisição/lançamento, durante o primeiro Pi ativo.
- **Cancelamento não libera sessão seguinte prematuramente:** pedido consumido antes de settlement abortado, término/liberação e coleta do primeiro handle antes do disparo normal.
- **Falhas sem falso sucesso:** duplicidade e mismatch falharam tecnicamente; timeout e evidência insuficiente anteriores não passaram; erro pós-check do controlador foi preservado; perda de conexão não disparou replay/fallback.
- **Procedimento/limites mínimos repetíveis:** documentados e validados na instalação real, inclusive nuances de Code Mode, IDs, quoting, timeouts e perda de Gateway.
- **Limites do Slice 1 preservados:** nenhum workflow de revisão/correção/papel real, persistência oficial por executável, Git Gateway, commit, integração remota, checkpoint, marco, porta adicional ou implantação. Runner/Driver/lease, protótipos, skills e requisitos não foram modificados.

Essa conferência é a declaração da implementação inicial, **não** revisão independente nem aprovação da task.

## Limites e pendências para revisão

- Não há garantia para execuções prolongadas, cancelamento com latência arbitrária ou retomada durável. Mantidos os limites de 512 resumos Pi e de timeout, sem antecipar outra arquitetura.
- Não foi provocado crash/restart do Gateway com Pi ativo, pois o Gateway era aberto/compartilhado pelo operador. A queda real observada ocorreu antes de sessão/runs; a reconciliação posterior foi descrita. Não inferir comportamento mais forte desse experimento.
- O teste usa o agente OpenClaw existente e ambos os provedores locais. Os scripts não modificam credenciais/políticas/modelos, nem constituem isolamento forte do OpenClaw contra sua própria conta/contexto.
- O turno demonstrativo teve erro de parsing posterior às verificações e consultas de skills pelo agente. Isso limita previsibilidade do controlador por prompt; não foi escondido como turno perfeito. As provas exigidas do cenário foram verificadas por retorno original + disco + observação nativa, não por conclusão textual do agente.
- A **revisão independente permanece pendente** em nova conversa. Ao encerrar a implementação, a configuração autorizava somente T01–T05 e faltava autorização/preparo de T06, sem fallback para plano/relatórios integrais. Essa pendência de preparação foi resolvida pela autorização posterior e pelo apêndice abaixo; não se realizou revisão nesta conversa.
- Sem commits nesta conversa. Aprovação independente e autorização explícita dos dois commits continuam necessárias. Não avançar para outra task/marco.

## Apêndice — preparação de fontes T06 autorizada após a implementação

O usuário autorizou preparar a seleção de revisão independente da M01-T06. Esta etapa só configura a entrada: **não é avaliação independente, revisão ou autorização de commits**. Estado mantido `aguardando revisão`, sem reiniciar implementação ou consumir rodada de revisão/correção.

Alterações autorizadas:

- `docs_devout/03-execucao/fontes-revisao.json`: inclusão de `M01-T06`, preservando integralmente os objetos de seleção T01–T05. Task/restrições comuns e decisões normativas iniciais; demais tasks e seções de evidência/histórico adiadas, com partição completa de cada fonte.
- `docs_devout/plano.md`: somente os quatro rótulos em negrito da T06 passaram a subtítulos Markdown (`####`), compatíveis com o preparador. Comparação automática com o texto anterior confirmou que Fazer, Não alterar, Entregáveis e Critério de conclusão não sofreram outra mudança.
- `AGENTS.md`: mapa/comando e limites da leitura seletiva estendidos à T06. `src/README.md`, `src/PI-LOCK.md`, `src/ROLE-RUNNER.md` e `src/OPENCLAW.md` ficam integralmente adiados para o confronto, assim como o diagnóstico misto e os protótipos históricos pertinentes. Código, testes e o roteiro executável `src/test/openclaw-procedure.txt`, que é entrada da demonstração e não relato de resultados, continuam entregáveis examináveis na fase inicial.
- Este apêndice e Observações da T06, via `update_registro.py`; sem alteração de status/timestamp. Não houve nova alteração de código/testes, chamada de modelo/Pi, configuração OpenClaw, skill ou requisito.

Validações próprias desta preparação:

1. Preparador com `--sources` e `--check-input` passou para **T01, T02, T03, T04, T05 e T06**.
2. Comparação estrutural confirmou as cinco seleções anteriores inalteradas e a T06 com todos os quatro campos, sem texto de outras tasks no `task_input`.
3. Na T06, os quatro guias estão em `deferred_sections`; não entram em `normative_input`, diffs iniciais ou `untracked_allowed`. `src/OPENCLAW.md`, ainda novo, continua no inventário e em `deferred_changed`, sem ocultar seu exame posterior. Os quatro arquivos de código/teste/roteiro continuam em `untracked_allowed`; relatos não entram ali.
4. Entrada inicial inspecionada automaticamente para ausência de resultados/IDs/raiz operacional da demonstração, preservando somente metadados autorizados do registro. A filtragem não elimina o confronto final obrigatório.
5. Uma entrada T05 gerada **antes** das mudanças foi recusada por `--check-input` como desatualizada; T07 sem seleção/linha válida também foi recusada, sem fallback.
6. `git diff --check` passou. Não se repetiu a suíte de execução nem os testes com provedor, pois esta etapa não alterou código; o resultado 152/152 acima continua o da implementação.

Entradas e resumo de validação foram persistidos exclusivamente em `%TEMP%/devout-t06-review-sources-qcldo40e/`, fora do repositório, incluindo `validation-summary.json`, seis entradas temporárias e a entrada antiga de teste. Não versionar esses JSONs nem reutilizá-los automaticamente como entrada do revisor.

Identificação da preparação T06: HEAD `fb991a9c21170edfea1e50852e3e7d15565ab66d`, configuração SHA-256 `d7d9508e3bea3a6de89492b31680e1fbc3d8cb9ee7ebcfc1e613f5691fd74731`, `input_id: 53bfc2a5f663d699ada4038308e3e5f4cd64b840579e957de7a99cc0c90add7e`. São identificadores desta checagem, não um parecer nem congelamento da entrega. O revisor deve gerar entrada própria e reconferir atualidade em conversa nova, pelo comando atualizado no mapa; após persistir sua avaliação inicial, deve examinar também todos os conteúdos/diffs adiados e este relatório.

