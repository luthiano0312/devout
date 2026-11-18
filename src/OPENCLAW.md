# OpenClaw → Role Runner no Windows — M01-T06 / Slice 1

Procedimento opt-in na instalação **real**, não um serviço/cliente RPC genérico.
O OpenClaw inicia a CLI do [Runner](ROLE-RUNNER.md) via seu `exec`; o Runner mantém
os pipes do Pi através do Driver. Não conectar Pi diretamente ao stdin de `exec`.
Não há aprovação de task, papéis de engenharia, transições oficiais, Git ou retry.

## Pré-condições

- Windows nativo, Node compatível, `openclaw.cmd`/`pi.cmd`, provedores já configurados
  e agente OpenClaw autorizado. Pode consumir tokens **dos dois agentes**.
- Nenhum Pi do workflow ativo/incerto; mesma [trava global](PI-LOCK.md) de sempre.
  Não executar suíte/smokes simultaneamente a esta demonstração.
- Gateway local em loopback, sob controle humano. Não abrir portas adicionais,
  instalar serviço, mudar credenciais/políticas ou expor o Gateway na rede.
- Os dados do Pi serão fictícios, em workspace temporário marcado, sem ferramentas,
  extensões, sessão persistida ou contexto de projeto (`configured-isolated`).
  Isso **não** oferece sandbox. O OpenClaw usa seu próprio contexto/configuração
  existente; não fornecer segredos nem executar sobre dados de produção.

Diagnóstico na raiz, PowerShell interativo (sem executar arquivo `.ps1`):

```powershell
node --version
npm.cmd --version
openclaw.cmd --version
pi.cmd --version
openclaw.cmd config validate --json
openclaw.cmd agents list --json
openclaw.cmd gateway status --json
```

Se necessário, o operador mantém **outro terminal** aberto com
`openclaw.cmd gateway run --verbose`. Não iniciar/reiniciar automaticamente.
O teste local usou OpenClaw `2026.11.3 (847611d)`, Pi `1.5.2`, Node `v24.20.0`,
npm `11.19.0`. Revalidar em outra versão/host.

**Diagnóstico divergente observado:** `gateway status` reportou configuração inválida
por `agents.entries` vazio e conexão sem scopes, enquanto `config validate` retornou
válido, `agents list`/RPC reconheceram `main` e um turno normal executou ferramentas.
Não criar agentes/permissões apenas para silenciar esse status. Conexão/catalogação
não prova execução: validar no caminho efetivamente usado.

## 1. Preparar entradas descartáveis

```powershell
$env:DEVOUT_PI_CMD = (Get-Command pi.cmd).Source
$prepared = node src/test/probe-openclaw.mjs prepare | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Preparação bloqueada; não disparar Pi' }
$root = $prepared.root
# Use um agente existente e autorizado; main foi o agente observado neste host.
$session = 'agent:main:devout-t06-' + [guid]::NewGuid().ToString('N')
```

`prepare` consulta a trava, valida solicitações do Runner e cria
`%TEMP%/devout-openclaw-probe-<sufixo>/` com:

- `workspace/` marcado como descartável;
- `cancel.json`, `duplicate.json`, `normal.json`, `mismatch.json` (schema fechado T04);
- `probe.json`: identificação local e hash inicial do registro oficial;
- `openclaw-instructions.txt`: roteiro com os caminhos absolutos desta preparação.

Nada é instalado. O preparador **não lança** Runner/Pi. Não editar as solicitações
para aceitar comandos/flags arbitrários. Prompt longo só cria uma janela inofensiva
de cancelamento; o cenário normal exige `PONG-DEVOUT-T06`. O cenário mismatch pede
esse mesmo texto, mas espera deliberadamente outro marcador.

## 2. Disparar pelo Gateway e acompanhar

```powershell
openclaw.cmd agent --agent main --session-key $session `
  --message-file $prepared.messageFile --timeout 360 --json
```

Não usar `--local`/`agent exec`: são caminhos embedded, não demonstram o Gateway.
Não usar `tools.invoke` para executar shell: a API direta bloqueia `exec` por padrão.
Não liberar `gateway.tools.allow` nem afrouxar outra política para contornar recusa.

O roteiro pede **uma** invocação por caso, diretamente pela ferramenta real:

```text
node "<runner-absoluto>" run --config "<root>\cancel.json"
node "<runner-absoluto>" run --config "<root>\duplicate.json"
node "<runner-absoluto>" cancel --artifacts-root "<root>\operacional" --run-id "<runId-original>"
node "<runner-absoluto>" run --config "<root>\normal.json"
node "<runner-absoluto>" run --config "<root>\mismatch.json"
```

Parâmetros das chamadas de shell: `yieldMs:1000`, `pty:false`,
`timeoutSeconds:240`, `awaitResults:false`; sem `background:true`, host remoto ou
wrappers de shell. **Em Code Mode, a célula externa também não deve ser required**
(`awaitResults:false` ou omitido). `awaitResults:true` propaga espera até o término
do shell, mesmo com `yieldMs`, impedindo esse acompanhamento/cancelamento assíncrono.
Retomar uma célula `waiting` por seu `wait` quando necessário, sem refazer ações.

Distinguir: ID da sessão OpenClaw, `runId` da célula Code Mode, `sessionId`/handle
retornado por `exec`, PID e `runId` do **Runner** (`run-UUID`). Só o último seleciona
cancelamento e `operacional/runs/<runId>/`. Não inferir handle de texto comum.

O controlador acompanha **os mesmos handles** por `process.poll` (esperas limitadas)
e `process.log`, sem tratar conclusão do modelo como prova do Runner:

1. Pi pronto (`state_observed`), `probe active <root>` confirma execução ainda ativa.
2. Disparo duplicado durante atividade: exit 1/`LOCK_BUSY`, sem lease nem Pi novo.
3. Após `response_started`, pedir cancelamento do run original imediatamente.
   Recibo `requested` não prova interrupção: aguardar `cancel_observed` anterior a
   `agent_settled`, resultado `interrupted`, encerramento e lease liberada.
4. **Só após coleta terminal do handle e check do cancelamento** iniciar normal.
5. **Só após término e check normal** iniciar mismatch. Pi exit 0 com resposta
   divergente deve continuar `failed`/`RESPONSE_MISMATCH`.

Os checks (`node src/test/probe-openclaw.mjs check <root> <caso>`) confrontam
state/control/result/eventos, mesmo runId, flags/resultados, prova do Driver,
ausência dos PIDs via CIM, trava livre quando aplicável e hash do registro inalterado.
`summary <root>` reconfere os quatro casos, cronologia e reaquisição/liberação final.
`pass:true` desses comandos significa apenas que o **cenário técnico esperado** passou;
por isso cancelamento/mismatch/duplicidade podem ter `pass:true` com execução `failed`
ou `interrupted`. `taskApproved` é sempre `false`.

## 3. Conferir prova do OpenClaw, não só relato/arquivos

Depois do turno, consultar **somente a sessão descartável criada acima** e projetar
as chamadas do runtime. A etapa é leitura do Gateway + verificações locais, não retry.
No Windows PowerShell 5.1, escapar as aspas JSON para o launcher `.cmd`:

```powershell
# UTF-8 no pipe nativo; ajuste só deste terminal, sem mudar política/configuração.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
$rpcParams = @{ key = $session; limit = 200 } | ConvertTo-Json -Compress
$rpcParams = $rpcParams.Replace('"', '\"')
openclaw.cmd gateway call sessions.get --params $rpcParams --timeout 10000 --json |
  node src/test/probe-openclaw.mjs trace $root
if ($LASTEXITCODE -ne 0) { throw 'Prova incompleta; não declarar conclusão' }
```

`trace` não persiste o transcript recebido: projeta uma whitelist em
`gateway-trace.json`, com quatro handles reais, chamadas assíncronas exatas, coleta
terminal por `poll`, uso de `log`, runIds correspondentes e recibo de cancelamento.
Revalida também os artefatos e a ordem. Falta/truncamento de mensagens, novo disparo,
runId errado, espera síncrona ou próximo Pi antes da coleta impedem `pass:true`.
A saída conta erros do controlador; passar a correlação não apaga esses erros.
Não usar o verificador como defesa contra um operador hostil que falsifique o stdin.

Preservar `summary.json`, `gateway-trace.json`, resumos por caso e a pequena árvore
operacional **fora do Git**. Para versionar evidência, usar somente extrato curado
sanitizado no relatório; não copiar sessões `.pi`/`.openclaw`, logs ou transcript bruto.
Não usar handle/resultado ausente, `exitCode=0`, `status:ok`, `prompt accepted` ou
mensagem do Pi/OpenClaw isoladamente como gate. O hash do registro refere-se ao
snapshot de `prepare`: uma atualização manual posterior da skill muda esse hash e
invalida novos checks nessa raiz. Não editar `probe.json` para fazê-los passar;
reprodução posterior exige nova preparação autorizada, após verificar término e
exclusividade. O extrato histórico continua preservado.

## Limites, timeout, erro e reinício

- `yieldMs` só limita a espera inicial; não é prazo de execução. Aqui há prazo de
  exec de 240 s, settlement do Runner de 180 s e turno CLI de 360 s, com orçamentos
  internos por fase. Isso é demonstração limitada, não garantia para papéis prolongados.
  Expiração/Stop do OpenClaw pode matar o shell antes do Runner finalizar: preservar
  a lease e reconciliar; não pressupor que Pi terminou porque o shell sumiu.
- Resumos de eventos Pi no Runner são limitados a 512 eventos; resposta longa com
  cancelamento atrasado pode omitir settlement no diário. O check temporal deve falhar,
  mesmo com abort aceito/`observed.settled:true`. Não afrouxar o gate nem repetir às cegas.
- Polling/modelo/consulta nativa podem atrasar o cancelamento. Agrupar observação e
  pedido em um programa Code Mode ordinary reduz latência, mas não garante janela.
  Não exigir duplicidade antes do primeiro texto: o requisito é Pi anterior ativo.
- Erro de parsing do controlador não vira sucesso do workflow. Conferir os arquivos,
  os retornos originais e a ordem antes de qualquer decisão; registrar o erro mesmo
  quando posterior a todos os checks, sem reexecutar ações já realizadas.
- Na perda de conexão, **não repetir `agent` nem cair em `--local`**. O turno pode
  continuar. Após o operador restaurar o Gateway, conferir `sessions.get` e
  `sessions.describe` da sessão exata, artefatos, [lease/identidade](PI-LOCK.md) e
  processos. `state.json` é última informação conhecida, não prova atual de vida.
- Handles de `process` são memória do Gateway; não prometer recuperação após restart.
  Gateway de teste caiu uma vez antes de haver sessão/runs, depois foi reaberto pelo
  usuário. A reconciliação constatou sessão ausente, raiz sem runs e trava livre.
  **Não foi provocado crash/restart com Pi ativo**: interromper o Gateway compartilhado
  do operador sem avaliação/autorização não era seguro. Não há prova de retomada durável.
- `uncertain`, lease não liberada, resultado ausente, erro de persistência/CIM,
  recibo tardio ou check falho bloqueiam novos despachos. Não apagar locks/guards,
  matar PID antigo, trocar raiz, limpar workspace ou reconstruir evidência como sucesso.

## Testes e evidências

`npm.cmd --prefix src test` não precisa do Gateway/provedor e inclui gates de evidência
T06 com dados sintéticos, canários de sanitização e regressões de async/identidade/ordem.
O roteiro real acima é separado e opt-in. A execução inicial e suas tentativas,
ressalvas e extratos sanitizados estão em
[`task-M01-T06-relatorio.md`](../docs_devout/03-execucao/achados/task-M01-T06-relatorio.md).
Nenhum desses testes implementa os fluxos completos T01/T02 de papéis do contrato.
