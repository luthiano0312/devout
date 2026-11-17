# Prova OpenClaw → Pi RPC (Windows nativo)

**Data:** 2026-11-13
**Escopo:** comunicação experimental, sem alterar `plan`/`implement`, sem Git e sem orquestrador de tasks.
**Ambiente informado:** OpenClaw 2026.11.3; Pi acessível em `C:\Users\User\.pi\agent\bin\pi.cmd`.

## Evidências relatadas pelo usuário

| Teste | Evidência | Resultado |
| --- | --- | --- |
| Gateway | `gateway status --json` → `rpc.ok: true`, porta 18789, Node PID 6824 | Aprovado |
| Pi RPC direto | `get_state`, ID `teste-1` → `success: true` | Aprovado |
| OpenClaw → Pi RPC | `get_state`, ID `oc-pi-2` → `success: true`, exit 0 | Aprovado |
| Dois comandos na mesma instância | `oc-pi-3a` e `oc-pi-3b` → mesmo `sessionId` e `success: true` | Aprovado |
| Processo persistente sem PTY | EOF antes de `process.write`, código 0 | Não aprovado |
| Diagnóstico Node sem PTY | `STDIN_EOF`, processo encerrou antes do envio | Hipótese EOF confirmada para o processo de teste |
| Diagnóstico Node com PTY | Processo ativo, `stdinWritable: true`, escrita aceita; sem `ECHO` | Inconclusivo: não comprovou entrega de dados |

## Decisão experimental

Prosseguir com uma ponte mínima Node.js usando HTTP apenas em `127.0.0.1:18790` para solicitações fixas `GET /health` e `GET /state`; a ponte mantém o Pi filho via pipes nativos. Essa é uma **prova de conceito**, não um Gateway de produção.

Arquivo: `pi-rpc-bridge.mjs`.

### Execução no Windows

1. Colocar `pi-rpc-bridge.mjs` em `C:\temp\pi-rpc-prova`.
2. Na primeira janela PowerShell: `node C:\temp\pi-rpc-prova\pi-rpc-bridge.mjs`.
3. Esperar `PONTE_PRONTA`; a ponte realiza um handshake `get_state` ao iniciar.
4. Na segunda janela: `curl.exe -sS http://127.0.0.1:18790/health` e `curl.exe -sS http://127.0.0.1:18790/state`.
5. No chat OpenClaw, solicitar `exec` no gateway de `curl.exe -sS http://127.0.0.1:18790/state` em duas mensagens separadas.
6. Comparar `data.sessionId` e respostas; a ponte mantém o Pi ativo entre chamadas se tudo funcionar.
7. Parar com Ctrl+C na janela da ponte.

## Restrições e pendências

- Até agora a ponte **não foi executada no Windows do usuário**. A lógica HTTP/JSONL foi testada apenas com um processo RPC simulado em ambiente Linux.
- Nenhum prompt a modelo é enviado, portanto os testes não verificam inferência, eventos de geração, cancelamento ou consumo de tokens.
- A ponte não autentica chamadas HTTP. Expõe somente as duas operações de leitura, em loopback. Não deve ser usada como serviço permanente ou exposta na rede.
- O Pi RPC recebe newline LF por pipes. Não substituir os pipes internos por PTY sem testes de framing e eco.
- Ainda não existe isolamento de permissões, controle de acesso a arquivos, retomada após crash, múltiplos processos de papéis ou Git Gateway.
- Sessões comuns de processo do OpenClaw não sobrevivem a reinícios do Gateway no Windows.

## Critério de aprovação seguinte

OpenClaw chama `/state` em duas mensagens separadas, ambas retornam `success: true` e o mesmo `data.sessionId`, enquanto `/health` continua `piAlive: true`. Após isso, avançar para dois processos Pi independentes e recepção de eventos reais.
