# Pi Driver, exclusividade e Role Runner — Slice 1 e M02-T01–T03

CLI temporária, solicitação local e evidências por execução: [`ROLE-RUNNER.md`](ROLE-RUNNER.md)
(M01-T04/T05; papel de teste e cancelamento entre invocações). O Runner adquire a lease antes de lançar Pi.
Perfil opt-in de engenharia em Git fictício, ferramentas e limites Windows:
[`ENGINEERING.md`](ENGINEERING.md) (M02-T01).
Entrada aprovada/baseline: [`TASK-INPUT.md`](TASK-INPUT.md) (M02-T02).
Papel implementador, relatório e gate de entrega: [`IMPLEMENTER.md`](IMPLEMENTER.md)
(M02-T03; ensaio técnico sem transições oficiais, commits ou revisão).
Disparo/acompanhamento pelo Gateway real no Windows, incluindo duplicidade, cancelamento,
falhas e limites de restart: [`OPENCLAW.md`](OPENCLAW.md) (M01-T06, opt-in separado).
Aquisição global, uso com Driver, testes concorrentes e procedimento de reconciliação:
[`PI-LOCK.md`](PI-LOCK.md). O Driver isolado e os smokes T01/T02 abaixo não adquirem
trava implicitamente.

Node.js sem dependências externas; lançamento suportado em **Windows nativo**.
Código/testes ficam neste diretório; nenhum log operacional ou histórico é gravado pelo Driver.

## Comandos (na raiz do repositório)

```powershell
npm.cmd --prefix src test
# Opcional: usa o provedor já configurado no Pi; pode consumir tokens.
$env:DEVOUT_PI_CMD = (Get-Command pi.cmd).Source
npm.cmd --prefix src run test:smoke
# Cancelamento real com provedor (também opt-in; executar separadamente):
npm.cmd --prefix src run test:cancel
# CLI Role Runner com Pi real e trava global (opt-in; executar separadamente):
npm.cmd --prefix src run test:runner
# Runner assíncrono + controle de cancelamento em outra invocação (Pi real):
npm.cmd --prefix src run test:runner-cancel
# Perfil de engenharia: edição + node --test em Git fictício, opt-in separado:
npm.cmd --prefix src run test:engineering
# Implementador real: task selecionada + código/teste/relatório e gate de entrega:
npm.cmd --prefix src run test:implementer
```

Não instala pacotes nem exige Gateway OpenClaw. Testes automatizados usam processos
Node fictícios; a suíte de exclusividade disputa a trava entre processos concorrentes.
A suíte do Runner também usa a raiz global padrão da trava: executar `test` e os
smokes **separadamente**, sem outro Pi do workflow ativo/incerto.
O smoke T01 inicia **um Pi real** em diretório temporário,
com ferramentas, MCP, extensões, skills, templates e contexto de projeto desabilitados.
Requer Pi compatível, acesso ao provedor e nenhuma execução Pi anterior do workflow
ativa/incerta. Não executar testes/smokes em paralelo. Os smokes T01/T02 chamam o
Driver diretamente, sem a trava global da T03; `test:runner` e `test:runner-cancel`
adquirem essa trava. O último testa cancelamento durante texto em streaming e
junto ao encerramento, preservando evidências sanitizadas fora do Git.
Não trocar políticas/credenciais para contornar um bloqueio.

O smoke envia apenas `get_state` e um pedido de resposta `PONG-DEVOUT-T01`.
Valida texto em memória, aceitação `started`, ausência de erro do assistente,
`agent_settled aborted=false`, stdin ainda aberto e término normal. Observa identidade
(PID + criação) do launcher/descendentes via CIM e verifica ausência após o término.
Encerra pelo `shutdown()` do Driver, com prova de Job Object e conferência CIM
independente. Encerramento forçado reprova esse smoke normal.
O `test:cancel` pede uma lista inofensiva, cancela enquanto a atividade está aberta
e exige `abort` aceito, término comprovado sem força e ausência dos PIDs observados.
A suíte `test` não usa provedor: inclui árvore Node descartável resistente ao EOF,
fallback real no Windows e processo alheio de controle que deve permanecer vivo.
Processo sobrevivente/incerto produz diagnóstico de reconciliação, não aprovação.

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
  // Após trabalho terminado: shutdown(). Se houver atividade, usar cancel().
  const ended = await driver.cancel(); // abort limitado + EOF + eventual fallback
  if (!ended.canRelease) {
    // NÃO iniciar outro Pi nem liberar a trava; reconciliar a incerteza.
  }
  // canRelease comprova término, não sucesso funcional nem aprovação da task.
}
```

- `startPi({ piCmd, cwd, profile, commandTimeoutMs, maxRecordBytes, maxQueuedBytes, maxPending })`
  retorna o Driver imediatamente; `ready` resolve após identificar e atribuir o host
  ao Job Object e lançar o `.cmd`. Rejeita falha de lançamento/supervisão.
  Não significa que o protocolo já respondeu: usar `getState` para comprovar comunicação.
  Aceita também os prazos de processo documentados abaixo.
  `profile: 'engineering'` exige `engineering: { baseline, branch, testPolicy }` e
  valida o Git descartável antes de lançar; detalhes em [`ENGINEERING.md`](ENGINEERING.md).
  Os perfis existentes `default` e `isolated` não mudam.
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
- `shutdown()` recusa atividade/comando pendente com `WORK_ACTIVE`, sem fechar stdin.
  Após settlement, solicita EOF, verifica término e escala somente se necessário.
- `cancel()` / `shutdown({ cancel: true })` impedem novos comandos, rejeitam observação
  ativa com `CANCELLED`, tentam RPC `abort` por prazo limitado e então solicitam EOF.
  O primeiro pedido de término prevalece; chamadas concorrentes/repetidas retornam
  a **mesma Promise/resultado**, inclusive em `uncertain`, sem repetir sinais/matança.
- `closeInput()` continua sendo primitiva de EOF, não substitui `cancel()`/`shutdown()`.
  No Driver gerenciado aciona supervisão automática, com resultado de cancelamento,
  mas o EOF já enviado impede um novo RPC `abort`. Falhas terminais também acionam
  supervisão automaticamente. Consultar `await driver.cancel()` para obter o resultado.
- `closed` resolve no `close` do host `{ exitCode, signal, failure }`, **sem** prova
  de descendentes. Só o resultado de `shutdown`/`cancel` autoriza liberar processos.
- Eventos: `event` (registros espontâneos), `response` (resposta correlacionada),
  `unmatchedResponse` (ID desconhecido, **nunca** sucesso do comando pendente),
  `diagnostic` (Buffer stderr), `failure` (uma falha terminal), `closed`,
  `lifecycle` (string de estado), `termination` (resultado final).
  Callbacks seguem a semântica síncrona de `EventEmitter`; não lançar exceções neles.
- `new PiDriver(child, options)` mantém a entrada de transporte com três pipes.
  Sem observador de árvore, término gerenciado retorna `uncertain / NO_PROCESS_OBSERVER`;
  o chamador supervisiona o processo. `options.processTree` é uma costura confiável
  para testes, não configuração aceita de modelos ou do `startPi`.

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
Não há retry/restart automático. O consumidor deve aguardar o término gerenciado,
diagnosticar processo que não sai e bloquear nova execução incerta.
A trava global e sua recuperação estão em `pi-lock.mjs` (T03), não neste Driver.

### Término gerenciado e identidade (M01-T02)

`lifecycle`: `starting` → `running` → `stopping` → `terminated` ou `uncertain`.
O resultado inclui `state`, `canRelease`, `cancelled`, `abortAccepted`, `forced`,
`taskkillExitCode`, `processesGone`, `workCompleted`, `exitCode`, `signal`,
`failureCode`, `identity` (PID, criação FILETIME e imagem do host), `observed`
(PID + criação) e, na incerteza, `reason`. `workCompleted` exige settlement
não abortado/sem erro observado e encerramento normal; não é aprovação técnica.
Falha ou cancelamento podem ter `canRelease=true` **sem** sucesso funcional.
`forced=true` registra tentativa de escalonamento, não sucesso do `taskkill`.

Prazos configuráveis em `startPi`/`PiDriver` (ms; inteiros positivos `<=2^31-1`):

| Opção | Inicial | Uso |
| --- | ---: | --- |
| `abortTimeoutMs` | 5000 | Aguardar resposta correlacionada de abort |
| `normalWaitMs` | 10000 | Aguardar EOF/término normal e árvore vazia |
| `forceCommandMs` | 5000 | Limitar execução de taskkill |
| `forceWaitMs` | 5000 | Conferir árvore após fallback |
| `pollMs` | 100 | Intervalo máximo entre consultas do Job |

São orçamentos por fase, medidos com relógio monotônico, não timeout funcional
do modelo. Cada consulta ao helper é limitada a 15 s e pode exceder o orçamento
da fase por esse limite. Bootstrap/ack do host: 25 s por espera; host não liberado
expira em 30 s. Falha de observação retorna incerteza, nunca sucesso presumido.

`startPi` cria um **host Node temporário bloqueado**, sem Pi iniciado. Um helper
PowerShell privado carrega as APIs Windows via `Add-Type` (sem dependências externas,
instalação ou alteração de política), verifica pai/imagem/criação, mantém handle
nativo do host e o atribui a um **Job Object sem breakaway**. Só então o host lança
as linhas `.cmd` fixas. O console `conhost.exe` criado antes dessa atribuição também
é incluído, somente se pai, criação, imagem do sistema e handle vivo forem verificados.
Isso contabiliza descendentes pelo kernel, inclusive subprocessos que nascem entre
consultas ou sobrevivem ao pai. Não depende apenas de snapshots de ParentProcessId.
O helper não é serviço residente nem interface do futuro cancelamento de Runner;
usa somente canais privados desta execução e fecha seus handles ao final.

Depois do prazo normal, o helper só executa `taskkill /PID <host> /T /F` se o handle
original ainda está vivo, a criação confere e a árvore enumerada pertence ao Job.
Mantém handles dos alvos inspecionados durante o fallback para evitar reciclagem
de identidade. Links de pai antigos para processos fora do Job recusam a operação.
Nunca há fallback contra root já encerrado. `SIGTERM` não é usado como prova nem
como substituto de abort. `taskkill` textual/exit 0 tampouco é prova: são necessários
Job vazio, root encerrado e `close` dos pipes antes de `canRelease=true`.

Root ausente com filhos vivos, falha de acesso/Job/identidade, sobrevivente ou perda
do observador produzem `uncertain, canRelease=false`. Não há retry de matança nem
reset no mesmo Driver. Preservar diagnóstico/workspace e reconciliar manualmente;
o consumidor **não pode liberar a trava/iniciar nova execução** nesse caso.
Falha de bootstrap impede liberação do host para lançar Pi. Nenhuma garantia de
sandbox/isolamento forte é oferecida contra processos privilegiados externos,
brokers ou manipulação hostil dos processos da conta Windows.

Até 4096 identidades observadas são mantidas em memória por execução; exceder o
limite bloqueia a prova de término. O Driver não grava logs nem comandos de processos.

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
