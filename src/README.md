# Pi Driver — M01-T01

Node.js sem dependências externas; lançamento suportado em **Windows nativo**.
Código/testes ficam neste diretório; nenhum log operacional ou histórico é gravado pelo Driver.

## Comandos (na raiz do repositório)

```powershell
npm.cmd --prefix src test
# Opcional: usa o provedor já configurado no Pi; pode consumir tokens.
$env:DEVOUT_PI_CMD = (Get-Command pi.cmd).Source
npm.cmd --prefix src run test:smoke
```

Não instala pacotes nem exige Gateway OpenClaw. Testes automatizados usam processos
Node fictícios, sequenciais. O smoke inicia **um Pi real** em diretório temporário,
com ferramentas, MCP, extensões, skills, templates e contexto de projeto desabilitados.
Requer Pi compatível, acesso ao provedor e nenhuma execução Pi anterior do workflow
ativa/incerta. Não executar vários smokes em paralelo: a trava global pertence à T03.
Não trocar políticas/credenciais para contornar um bloqueio.

O smoke envia apenas `get_state` e um pedido de resposta `PONG-DEVOUT-T01`.
Valida texto em memória, aceitação `started`, ausência de erro do assistente,
`agent_settled aborted=false`, stdin ainda aberto e término normal. Observa identidade
(PID + criação) do launcher/descendentes via CIM e verifica ausência após o término.
Fecha stdin; após 10 s, somente no teste, pode usar `taskkill /PID /T /F` sobre a
identidade observada do launcher vivo. Encerramento forçado reprova o smoke.
Processo sobrevivente/incerto produz diagnóstico de reconciliação, não aprovação.
A implementação reutilizável de cancelamento/escalonamento será entregue na T02.

Saída é um resumo JSON sanitizado: contagens/tipos de eventos, booleanos, versões,
código de saída e encerramento. Não imprime respostas, session IDs, modelo,
configurações, tokens, mensagens de erro do provedor ou stderr bruto. Diretório
fictício é removido somente após comprovar o término observado; se isso falhar,
preservá-lo e reconciliar os processos informados antes de repetir o teste.

## Interface mínima (`pi-driver.mjs`)

```js
import { startPi } from './src/pi-driver.mjs';

const driver = startPi({
  piCmd: process.env.DEVOUT_PI_CMD,       // caminho absoluto confiável para pi.cmd
  cwd: process.env.DEVOUT_WORKSPACE,     // workspace descartável sem segredos
  profile: 'isolated',                   // 'default' mantém recursos do Pi habilitados
});

driver.on('event', record => { /* eventos espontâneos, incluindo agent_settled */ });
driver.on('diagnostic', bytes => { /* stderr; não persistir sem sanitizar */ });
driver.on('failure', error => { /* error.code; não significa processo encerrado */ });

try {
  await driver.ready;
  const state = await driver.getState(); // resposta RPC completa: id, success, data
  const run = await driver.promptAndWait('Responda somente PONG.');
  // run.response é a aceitação; run.settled é o evento observado.
  // run.assistantError sinaliza message_end error/aborted/errorMessage ou abort.
  // Nada disso aprova uma task: o consumidor precisa validar as evidências.
} finally {
  driver.closeInput(); // solicita EOF ordenado, não mata o processo
  const closed = await driver.closed; // { exitCode, signal, failure }
  // Este await não tem escalonamento: consumidor deve supervisionar o prazo (T02).
}
```

- `startPi({ piCmd, cwd, profile, commandTimeoutMs, maxRecordBytes, maxQueuedBytes, maxPending })`
  retorna o Driver imediatamente; `ready` resolve em `spawn` e rejeita falha de lançamento.
  Não significa que o protocolo já respondeu: usar `getState` para comprovar comunicação.
- `getState({ timeoutMs }?)` equivale a `command('get_state', {}, options)`.
- `prompt(message, { timeoutMs }?)` retorna **somente a resposta de aceitação**.
  Para gerenciar eventos manualmente, inscrever-se antes de chamar. Não misturar essa
  modalidade com `promptAndWait` nem enviar prompts concorrentes: eventos são da sessão,
  não correlacionados a um prompt. O consumidor da modalidade manual acompanha o run.
- `command(type, payload?, { timeoutMs }?)` envia JSONL com UUID `id` gerado internamente.
  Payload não pode sobrescrever `type`, `id` ou `requestId`. `requestId` também é aceito
  como alias na resposta; nunca correlacionar por ordem de chegada ou pelo ID de eventos.
  Método é para o controlador confiável, **não** uma ponte para comandos arbitrários do modelo.
- `promptAndWait(message, { timeoutMs = 120000, commandTimeoutMs = 30000 }?)`
  instala a observação antes do envio, exige disposição `started` e aguarda resposta
  **e** `agent_settled`, em qualquer ordem. Recusa outro observador/prompt enquanto ativo.
  `handled`/`queued` rejeitam com `PROMPT_NOT_STARTED`, sem inventar um fim de execução.
  Não encerra stdin ao receber `agent_end`, aceitação ou settlement.
- `closeInput()` é idempotente; `closed` resolve somente no `close` do filho.
  Isso não comprova sozinho ausência de descendentes nem resultado técnico da task.
- Eventos: `event` (registros espontâneos), `response` (resposta correlacionada),
  `unmatchedResponse` (ID desconhecido, **nunca** sucesso do comando pendente),
  `diagnostic` (Buffer stderr), `failure` (uma falha terminal), `closed`.
  Callbacks seguem a semântica síncrona de `EventEmitter`; não lançar exceções neles.
- `new PiDriver(child, options)` é a entrada para testes com processo recém-criado
  e três pipes; o chamador mantém responsabilidade pela supervisão desse processo.

### Limites e erros

Defaults: comando 30 s; até 32 comandos pendentes; registro de entrada/saída 8 MiB;
fila de escrita 8 MiB. Limites e prazos devem ser inteiros positivos até `2^31-1`.
Cada registro é separado apenas por LF, admite CRLF e UTF-8 fragmentado. U+2028/2029
não são quebras de registro. O limite é aplicado **antes** de parsear inclusive
linhas completas; várias linhas válidas no mesmo bloco não somam um único registro.
Escritas respeitam `drain` e os limites de fila; nenhum histórico é acumulado.

Rejeições são `DriverError` com `code`. `RPC_ERROR` inclui a `response` original,
que pode conter informação sensível e não deve ser registrada indiscriminadamente.
É erro daquele comando, não automaticamente falha do transporte. `QUEUE_LIMIT`
recusa o envio sem invalidar a conexão.

JSON/UTF-8 inválido, registro/resposta malformado, resposta sem ID, comando
incompatível com o ID, linha excessiva, EOF truncado/inesperado, falha de pipes,
falha de spawn, saída anormal e timeout de comando/settlement tornam o transporte
inutilizável: rejeitam pendências, publicam `failure` e solicitam fechamento de stdin.
Os códigos correspondentes incluem `INVALID_JSON`, `INVALID_RECORD`,
`INVALID_RESPONSE`, `UNCORRELATED_RESPONSE`, `COMMAND_MISMATCH`, `RECORD_LIMIT`,
`TRUNCATED_RECORD`, `EARLY_EOF`, `EARLY_EXIT`, `SPAWN_ERROR`, `STDIN_ERROR`,
`STDOUT_ERROR`, `STDERR_ERROR`, `PROCESS_EXIT`, `COMMAND_TIMEOUT`, `SETTLED_TIMEOUT`.
Não há retry/restart automático. O consumidor deve aguardar `closed`, diagnosticar
um processo que não sai e bloquear nova execução incerta. Término robusto,
identidade de árvore, abort e liberação de exclusividade não estão nesta task.

### Lançamento `.cmd` e segurança

`windowsLaunchSpec` usa `cmd.exe /d /s /v:off /c`, `shell:false` e
`windowsVerbatimArguments:true`, com **duas linhas literais fechadas** (perfis
`default` e `isolated`). O caminho do `.cmd` vai em variável de ambiente própria,
entre aspas; deve existir, ser absoluto e não conter metacaracteres de shell.
Caminhos com espaços/Unicode são testados. Nenhum argumento CLI extra é aceito.
Prompts e comandos RPC trafegam exclusivamente pelo pipe stdin, não pelo shell.
Isso evita `spawn(..., { shell:true })` com argumentos e o `DEP0190` das provas.
O launcher e seu diretório são código confiável, não material controlado pelo modelo.
Não é isolamento de segurança: o Pi ainda usa a conta/configuração do Windows.

## Evidência de implementação inicial

Em 2026-11-17, Windows nativo, Node v24.20.0, npm 11.19.0, Pi 1.5.2:
smoke real com `getStateCorrelated=true`, `promptAccepted=true`, `settled=true`,
`stdinOpenAtSettled=true`, `markerMatched=true`, `assistantError=false`,
`dep0190=false`, `exitCode=0`, `forced=false`, `processesGone=true`.
Detalhes sanitizados e resultados da suíte estão no
[`task-M01-T01-relatorio.md`](../docs_devout/03-execucao/achados/task-M01-T01-relatorio.md).
Provas históricas consultadas, não modificadas, em `prototipo/`.
