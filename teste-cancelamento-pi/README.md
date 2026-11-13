# E09 — Prova de cancelamento controlado Pi RPC (Windows nativo)

**Objetivo:** demonstrar que o OpenClaw inicia uma execução Pi, recebe um evento de progresso, envia o comando `abort` enquanto a execução está ativa, recebe confirmação da interrupção (`agent_settled.aborted=true`) e confirma que a sessão ficou ociosa por `get_state` antes de encerrar o subprocesso.

## Preparação

1. Confirme que nenhuma ponte/instância Pi de teste está ativa. **Não** encerre o Gateway OpenClaw.
2. Copie `pi-rpc-abort.mjs` para `C:\temp\pi-rpc-prova\pi-rpc-abort.mjs`.
3. Verifique sintaxe localmente: `node --check C:\temp\pi-rpc-prova\pi-rpc-abort.mjs`.
4. Execute com OpenClaw (`exec` no host gateway, `pty:false`): `node C:\temp\pi-rpc-prova\pi-rpc-abort.mjs`. Se retornar sessão ativa, use `process.poll` até terminar.

## Procedimento

- Inicia **um único** Pi com `--no-tools`, `--no-extensions`, `--no-skills`, `--no-context-files`, `--no-session`.
- Envia um prompt inofensivo suficientemente longo para produzir eventos de streaming. **Consome alguns tokens** até o cancelamento.
- No primeiro `message_update`, envia `{"id":"e09-abort","type":"abort"}` enquanto o `stdin` continua aberto. Se o modelo demorar, usa um fallback após 10 segundos do `agent_start`.
- Espera `abort` respondido com sucesso, `agent_settled.aborted=true` e `get_state.isStreaming=false`. Só então fecha o `stdin` para encerrar normalmente.
- Se o prompt terminar antes do abort, o teste é **inconclusivo** (`FAIL`), não conta como cancelamento aprovado.
- Prazo total de 90 segundos; após timeout solicita encerramento e tem último recurso limitado à árvore do subprocesso de teste.

## Aprovação

`PROMPT_RESPONSE success=true disposition=started`, `EVENT agent_start`, `ABORT_SENT`, `ABORT_RESPONSE success=true`, `AGENT_SETTLED aborted=true`, `STATE_RESPONSE success=true isStreaming=false`, `PI_EXIT code=0`, `TEST_RESULT PASS`.

`success=true` de `abort` sozinho não prova que o cancelamento ocorreu: é necessário também verificar o evento final. Se houver `TEST_RESULT FAIL`, compartilhe o registro e investigaremos antes de repetir. O Pi não deve ter acesso a ferramentas nem repositórios importantes neste teste.

## Notas

- O script usa o padrão `spawn(pi.cmd, args, {shell:true})` já validado na máquina. Os argumentos são **constantes**, mas Node 24 pode imprimir `DEP0190`. A implementação definitiva deve resolver o wrapper para `node <cli.js>` ou usar `RpcClient` oficial, evitando `shell:true`.
- Este teste **não** valida execução paralela, segurança do Windows nem integração Git.
- Documentação de referência: https://docs.pi.dev/latest/rpc-commands e https://docs.pi.dev/latest/json.
