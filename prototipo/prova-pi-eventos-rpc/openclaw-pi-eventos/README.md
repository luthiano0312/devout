# Prova corrigida de eventos RPC (Windows nativo)

Objetivo: enviar **um** `prompt` ao Pi via RPC, manter `stdin` aberto e observar `agent_settled`, sem modificar as skills. É uma prova isolada, não um orquestrador.

## Preparação

1. Pare a ponte anterior na porta 18790 com Ctrl+C, para não manter dois processos Pi ativos.
2. Copie `pi-rpc-eventos.mjs` para `C:\temp\pi-rpc-prova`.
3. Mantenha o Gateway do OpenClaw funcionando.

## Execução local

```powershell
node C:\temp\pi-rpc-prova\pi-rpc-eventos.mjs
```

Se o teste local passar, solicite ao OpenClaw executar o mesmo comando via `exec` no host `gateway`, `pty: false`, com timeout de pelo menos 180 segundos. Este teste chama o modelo configurado no Pi e consome tokens.

## Critérios

- `response success=true` com `disposition=started`;
- `agent_start`;
- `message_end` do assistente, texto `PONG-EVENTOS`;
- `agent_settled`;
- `TEST_RESULT PASS` e código de saída 0.

Se falhar, registre a sequência de eventos, o erro (se houver), o estado `PI_EXIT`, e o `TEST_RESULT`, ocultando quaisquer credenciais. O teste contém timeout e tenta abortar a geração antes de encerrar o subprocesso.

Não confundir `response success=true` com resposta completa. Não modificar `plan`, `implement`, `registro.md` nem repositórios reais.
