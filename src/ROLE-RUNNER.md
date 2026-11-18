# Role Runner temporário — M01-T04/T05 / Slice 1

```powershell
node src/role-runner.mjs run --config "C:\caminho-local\request.json"
```

Uma invocação cria um `runId`, adquire a [trava global](PI-LOCK.md), abre **um** Pi
via Driver, consulta `get_state`, envia **um** prompt de teste, observa aceitação +
`agent_settled` + resposta esperada e encerra/verifica a árvore antes de liberar a
lease. Sem retry de Pi, outra sessão, transição oficial, Git ou serviço residente.
O Runner termina depois de persistir o resultado e drenar sua saída.

Somente `role: "test"` está autorizado neste Slice. Não representa implementador,
revisor ou corretor de uma task real. Gates desses papéis pertencem ao Slice 2;
cancelamento local entre invocações está descrito abaixo (M01-T05). O procedimento
OpenClaw da M01-T06 está em [`OPENCLAW.md`](OPENCLAW.md).

## Solicitação local (schemaVersion 1)

Exemplo de formato, com caminhos reais a serem preparados pelo controlador humano:

```json
{
  "schemaVersion": 1,
  "taskId": "TEST-T04",
  "role": "test",
  "workspace": "C:\\Users\\conta\\AppData\\Local\\Temp\\devout-test\\workspace",
  "artifactsRoot": "C:\\Users\\conta\\AppData\\Local\\devout\\runner-artifacts",
  "piCmd": "C:\\Users\\conta\\.pi\\agent\\bin\\pi.cmd",
  "modelProfile": "configured-isolated",
  "prompt": "Teste inofensivo. Responda somente PONG-DEVOUT-T04.",
  "expectedText": "PONG-DEVOUT-T04",
  "driver": {
    "commandTimeoutMs": 30000,
    "settlementTimeoutMs": 120000,
    "normalWaitMs": 10000
  }
}
```

- JSON UTF-8 sem BOM, até 256 KiB; campos desconhecidos, tipos errados, flags extras
  e versões diferentes são recusados **antes** de criar Pi ou diretório de run.
  Todos os campos acima são obrigatórios exceto `driver`.
- `taskId`: metadado local, 1–64 caracteres alfanuméricos, `_` ou `-`, começando por
  alfanumérico. Não é prova de task aprovada, não seleciona entrada oficial e não
  recebe resultado `completed`. Não colocar segredos em IDs.
- `workspace`: diretório real local, descendente de `os.tmpdir()`, não o próprio
  temporário, sem `.git`, `.pi`, `.openclaw`, links/junctions internos ou arquivos
  especiais. Até 1024 entradas na árvore. Exige arquivo `.devout-disposable.json`
  na raiz com **exatamente** `{"schemaVersion":1,"disposable":true}`. Esse marcador
  é a autorização/atestação local de que só há dados fictícios e nenhum segredo;
  o validador não descobre credenciais arbitrárias nem oferece sandbox. A checagem
  é repetida imediatamente antes do lançamento. O Runner não apaga o workspace.
- `artifactsRoot`: caminho absoluto local, fora de qualquer árvore Git, deste
  repositório e do workspace; também não pode ser ancestral do workspace nem raiz
  do volume. Ancestrais existentes são canonicalizados. A subpasta `runs` não pode
  ser junction/link. O controlador deve usar diretórios confiáveis, com permissões
  restritas à conta, sem manipulação concorrente hostil. Não usar UNC/device paths.
- `piCmd`: launcher `.cmd` **confiável**, existente, absoluto, validado pelo Driver,
  sem metacaracteres de shell. Não é fragmento de comando nem parâmetro de modelo.
- `modelProfile`: somente `configured-isolated`. Usa o modelo/provedor **já
  configurado no Pi**, sem alterar credenciais, selecionar modelo arbitrário por
  RPC ou persistir sua identificação. `get_state` deve confirmar modelo disponível
  e ausência de streaming anterior. O perfil mapeia para o launcher fixo `isolated`
  do Driver: `--no-session`, ferramentas, extensões, MCP, skills, templates,
  arquivos de contexto e aprovação desabilitados. Não habilita o perfil `default`.
- `prompt` e `expectedText`: strings locais controladas, não vazias, sem NUL, até
  64 KiB UTF-8 cada. Só o prompt vai ao stdin RPC, nunca ao shell. Compara o último
  texto de assistente observado (trim) com `expectedText`; nenhum deles é gravado
  nas evidências ou saída do Runner. Usar só pedidos fictícios e inofensivos.
- `driver`: objeto fechado. Aceita `commandTimeoutMs`, `settlementTimeoutMs`,
  `abortTimeoutMs`, `normalWaitMs`, `forceWaitMs`, `forceCommandMs`, `pollMs`
  (inteiros de 1 a 600000 ms); `maxRecordBytes`/`maxQueuedBytes` (1 a 8 MiB) e
  `maxPending` (1 a 32). Defaults do [Driver](README.md), settlement de 120 s.
  Orçamentos são por fase, não um prazo total: bootstrap/observação nativa têm
  seus próprios limites. Não aceita shell, argv, comandos RPC, factories, raiz
  de lock ou IDs de run/sessão/exec escolhidos pelo solicitante.

A raiz de exclusividade é **sempre** a padrão da T03, compartilhada por invocações:
`%LOCALAPPDATA%\devout\pi-exclusivity` (fallback `<home>\devout\pi-exclusivity`).
`artifactsRoot` não muda essa raiz. Nunca criar outra raiz para contornar bloqueio.
O segundo argumento de `runRole` é costura confiável de teste (`acquire`, `notify`),
não opção de solicitação, CLI ou modelo.

### Preparar um teste inofensivo no PowerShell

A partir da raiz do repositório, sem outro Pi do workflow ativo/incerto:

```powershell
$root = Join-Path ([IO.Path]::GetTempPath()) ('devout-test-' + [guid]::NewGuid())
$workspace = Join-Path $root 'workspace'
New-Item -ItemType Directory -Path $workspace | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $workspace '.devout-disposable.json'),
  '{"schemaVersion":1,"disposable":true}', $utf8)
$request = @{
  schemaVersion = 1; taskId = 'TEST-T04'; role = 'test'; workspace = $workspace
  artifactsRoot = Join-Path $env:LOCALAPPDATA 'devout\runner-artifacts'
  piCmd = (Get-Command pi.cmd).Source; modelProfile = 'configured-isolated'
  prompt = 'Teste inofensivo. Responda somente PONG-DEVOUT-T04.'
  expectedText = 'PONG-DEVOUT-T04'
}
$config = Join-Path $root 'request.json'
[IO.File]::WriteAllText($config, ($request | ConvertTo-Json -Depth 4), $utf8)
node src/role-runner.mjs run --config $config
```

## Evidências e acompanhamento

```text
<artifactsRoot>/runs/<runId>/
    events.jsonl       # sequência de resumos JSONL, sem payload bruto
    state.json         # último estado operacional conhecido, substituição atômica
    result.json        # resultado final técnico, publicação atômica
    control.json       # mailbox fechado de cancelamento, substituição atômica
    control.guard/     # presente somente durante uma transação curta de controle
```

`runId = run-<UUID>` é gerado internamente, distinto de `taskId`, ID de sessão Pi,
PID do Runner e identificador `exec` do controlador. Nenhum histórico de sessão é
copiado. O Runner não lê nem modifica `registro.md`; a atualização feita pela
skill durante o desenvolvimento deste código não é uma operação desse executável.

**stdout:** os mesmos eventos JSONL persistidos (`runId`, `seq` crescente, instante
ISO, `type` e detalhes fechados), seguidos por um resumo final `type: "result"`.
Estados: `starting` → `running` → `stopping` → `terminated` ou `uncertain`.
Há resumos de aquisição, comunicação, settlement e falha. `response_started` marca
somente o primeiro `message_update` com `text_delta`, sem texto nem payload;
`cancel_observed` registra consumo do pedido e `control_closed` o corte final.
Só tipos conhecidos
`agent_start`/`agent_settled` são resumidos, até o limite de 512 eventos Pi observados;
o total de eventos e bytes de diagnóstico continua contado. `stderr` da CLI contém
somente código fechado para falhas de invocação/publicação. stderr bruto do Pi,
nomes de eventos desconhecidos, respostas, prompts, session IDs, modelo, stack,
mensagens do provedor e credenciais não são encaminhados a nenhum desses canais.

**state.json:** `schemaVersion`, `runId`, `taskId`, `role`, `runnerPid`, `state`,
`updatedAt`. É snapshot de processo, **não** cópia dos estados oficiais da task
nem prova atual de vida. Após falha de I/O pode estar atrasado; não inferir sucesso.

**result.json:** identidade da execução, instantes inicial/final, `state`,
`technicalOutcome` (`succeeded`, `failed`, `interrupted`), `taskApproved: false`,
`observed` (comunicação, modelo disponível, aceitação, settlement, abort, erro do
assistente, marcador, `responseStarted` e contadores), `cancellation.requested`,
`errorCodes`, `lock.acquired/released` e
`termination`. Este último contém estado, prova de árvore vazia, `canRelease`,
`workCompleted`, cancelamento/abort, força, exit codes, motivo/falha sanitizados,
identidade e PIDs/criações observados (sem imagens/linhas de comando).

`terminated` só indica que não há Pi lançado ou que seu término foi verificado e
a lease liberada. Aquisição recusada pode terminar assim com resultado **failed**.
`uncertain` ou `lock.released=false` após uma aquisição mantém bloqueio conservador.
Se o Driver comprovar término mas a lease não puder ser arquivada, não declarar
exclusividade livre. Seguir reconciliação da T03, sem apagar arquivos/PIDs às cegas.

`technicalOutcome: succeeded` exige aceitação, settlement não abortado, ausência
de erro do assistente, texto esperado, término comprovado normal, exit code zero,
`workCompleted` e liberação da lease, sem erro de persistência. **Não aprova task,
papel de engenharia, gate de qualidade ou commit.** Erro RPC, crash/EOF, timeout,
resposta divergente, cancelamento ou incerteza nunca viram sucesso. Falhas ativas
acionam `finish({cancel:true})`: abort limitado, EOF e fallback verificado da T02.
O Runner não reinicia Pi nem envia outro prompt.

Saídas CLI: `0` observação técnica bem-sucedida; `1` falha/interrupção/incerteza/I/O;
`2` solicitação ou argumentos inválidos. Não usar somente exit code como gate.
Após aguardar encerramento e gravações, a CLI drena stdout/stderr e sai mesmo se
um processo incerto ainda retiver pipes/IPC. **Sair do Runner não prova término do
Pi**: a lease persistida continua impedindo novas sessões nessa situação.

### Segurança de gravação e falhas

Cada evento usa append e flush. `state.json` e `result.json` são escritos em
candidato exclusivo com UUID, flush, close e rename no **mesmo diretório/volume**.
Substituições Windows que recebem `EPERM`/`EACCES`/`EBUSY` tentam o mesmo candidato
novamente por no máximo 250 ms, sem remover previamente o destino válido. Leitura
concorrente agressiva/antivírus/permissão permanente pode esgotar esse limite;
nesse caso a falha é explícita, nunca uma gravação parcial promovida a sucesso.
Não manter handles abertos nem fazer polling apertado; intervalos de 500 ms ou
mais são suficientes para este teste. A visibilidade é atômica, não uma garantia
absoluta contra falta de energia, falha de disco ou manipulação hostil.

Candidatos `.write-*.tmp` são diagnósticos, **não resultados publicados**. Falha ao
publicar resultado dá exit 1 e preserva temporários. Crash do Runner pode deixar
apenas eventos/state ou um candidato: ausência de `result.json` é ausência de
conclusão, não sucesso. Mesmo `result.json` deve ser confrontado com a lease/prova
e término do Runner pelo controlador. Não limpar workspace/evidências enquanto
processo/lock estiver incerto; não há limpeza, reconciliação ou restart automático.

## Cancelamento entre invocações (M01-T05)

Em outra invocação do controlador, enquanto o Runner estiver ativo:

```powershell
node src/role-runner.mjs cancel --artifacts-root "C:\caminho-local\runner-artifacts" --run-id "run-UUID-obtido-do-Runner"
```

Usar o `runId` completo gerado pelo Runner e a mesma raiz de artefatos (não o
`taskId`, PID ou ID de `exec`). A CLI aceita exatamente os argumentos acima, nessa
ordem. API local equivalente: `requestCancellation({artifactsRoot, runId})` em
`run-control.mjs`. Não aceita shell, caminho de run arbitrário, sinal de SO ou RPC.
O controlador **não** abre Pi nem mata por PID: só altera o mailbox daquele run.
IDs inválidos, diretórios ausentes, links/junctions em `runs`/run, identidade
incompatível ou mailbox inválido falham sem selecionar outra execução.

`control.json` tem esquema fechado: `schemaVersion:1`, `runId`, `runnerPid`,
`status` (`open`, `requested`, `closed`), `requestedAt` (ISO UTC ou null) e
`finalState` (null até fechar; depois `terminated` ou `uncertain`). O PID é
metadado conferido pelo Runner, **nunca** autorização para matar um processo.
A identidade do alvo é o diretório novo, não reutilizado, com UUID v4 e `runId`
interno correspondente. Não editar, copiar, reutilizar ou remover esses arquivos.

A exclusão por `mkdir(control.guard)` serializa leitores/escritores do controle,
o início de cada fase (aquisição, lançamento, consulta e prompt) e o corte final.
A seção crítica é síncrona e curta; libera a guarda antes de aguardar Pi/I/O
assíncrono. Escrita usa o mesmo flush + rename de `state`/`result`. Contenção tenta
novamente a cada 25 ms, por até 2 s; erro/guarda abandonada falham fechados, sem
reivindicação automática. Arquivos operacionais são confiáveis/restritos à conta;
isso não é autenticação nem isolamento contra outro processo hostil da mesma conta.

O Runner verifica o controle antes de cada fase e a cada 100 ms durante esperas.
Pedido consumido impede fases/prompts seguintes e chama `Driver.cancel()` (abort,
EOF e eventual força da T02), sem retry de Pi. Uma fase cujo início já venceu a
arbitragem pode estar em bootstrap: aguarda vincular o Driver, cancela-o e não
inicia a fase seguinte. Os prazos de bootstrap/Driver continuam valendo; 100 ms
não é promessa de término em 100 ms. Erro de controle também impede fases e
provoca término conservador. A guarda de controle não substitui a trava global.

**Recibo stdout** `type:cancel_request` com `runId` e `status`:

- `requested`: pedido persistido; não prova recebimento, abort ou morte.
- `already_requested`: repetição do mesmo pedido, sem alterar identidade/instante.
- `too_late`: o corte final já ocorreu; não altera controle nem resultado.
- `blocked`: controle fechado com processo/liberação incertos; exige reconciliação.

CLI de controle sai com `0` para os três primeiros recibos, `1` para `blocked`,
I/O, `CONTROL_INVALID` ou `CONTROL_BUSY`, e `2` para alvo/argumentos inválidos.
Não interpretar exit 0 do comando de controle como cancelamento concluído.
Se o Runner morreu antes de consumir o pedido, o recibo pode continuar sendo
`requested`/`already_requested`: sem resultado e prova de término, não avançar.

Após terminar o Pi e obter a prova/liberação (ou sua falha), o Runner fecha o
controle **sob a mesma guarda**, consumindo qualquer pedido vencedor antes de
publicar o resultado. Pedido aceito até esse corte domina uma resposta já correta:
resultado `interrupted`, `cancellation.requested:true`, `taskApproved:false`, nunca
`completed`/aprovação. O cancelamento pode chegar quando o Driver já encerra
normalmente; nesse caso não reabre stdin nem cria outro escalonamento, mas a
interrupção técnica ainda prevalece. Após o corte é explicitamente `too_late`.
`closed` pode anteceder `result.json`: não é conclusão nem prova de sucesso.
Falhas de publicação deixam resultado ausente/falho, nunca aprovação implícita.

Só o Driver/lease pode provar término e liberar a exclusividade. Resultado
`uncertain` continua bloqueante mesmo após cancelamento repetido; `cancel` não
reconcilia nem remove lock. Não apagar uma guarda abandonada nem trocar a raiz
para contornar bloqueio; preservar evidências e investigar o dono antes de recuperar.

## Testes

```powershell
npm.cmd --prefix src test             # Pi falso; inclui chamadas CLI no Windows
npm.cmd --prefix src run test:runner  # opt-in, Pi/provedor real; separado da suíte
npm.cmd --prefix src run test:runner-cancel # opt-in, cancelamento real assíncrono
```

A suíte cobre esquema, workspace, links, limites, ordenação, estados, erros,
publicação atômica (incluindo leitores independentes e falhas), canários em payloads
que não podem entrar nos logs, incerteza e CLI com Pi falso (normal, RPC error,
EOF, crash, timeout, erro de assistente, abort e resposta divergente).
T05 acrescenta controladores simultâneos, identidade/traversal/link, guarda
abandonada, pedidos antes de fases e no bootstrap, ambos os lados do corte final,
lease incerta bloqueando outro lançamento e CLI ativa com streaming/força reais
sobre processos fictícios Windows. O smoke T05 usa Pi real com pedido em streaming
(após primeiro texto) e junto ao encerramento, ambos pela API local no controlador
independente já carregado, evitando a latência de bootstrap de outro Node. A CLI
independente continua exercitada nas repetições tardias e na suíte determinística.
Streaming só passa se pedido persistido e `cancel_observed` precederem settlement,
com evidência de interrupção no assistente e término sem força; abort aceito sozinho,
conclusão anterior ou ordem inconclusiva falham, nunca viram `pass:true`. A regressão
de resposta rápida seguida de pedido atrasado exige essa rejeição. O smoke confere
processo alheio vivo, CIM e reaquisição e preserva resumo com cronologia sanitizada
em `%TEMP%\devout-runner-cancel-smoke-*`.
Os testes CLI usam a **mesma raiz global padrão**, exigem que esteja livre e
comprovam nova aquisição após término. Não rodar suíte/smokes em paralelo.

O smoke cria workspace sem segredos, invoca a CLI real, verifica eventos/result,
prova do Driver, `close` do Runner, ausência dos PIDs via CIM, `registro.md`
inalterado e nova aquisição/liberação. Preserva resumo e pequena árvore de
execução em `%TEMP%\devout-runner-smoke-*`, fora do Git. Consome tokens do provedor
já configurado; não imprime resposta/modelo/configuração/diagnóstico bruto.
