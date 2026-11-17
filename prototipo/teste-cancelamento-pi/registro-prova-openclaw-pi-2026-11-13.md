# Prova de integração OpenClaw ↔ Pi Agent (RPC)

**Data:** 2026-11-13  
**Ambiente:** Windows nativo, OpenClaw 2026.11.3, Gateway `127.0.0.1:18789`  
**Escopo:** verificar comunicação e controle via RPC; sem alterar `plan`, `implement`, `registro.md` ou Git.

## Arquitetura e decisão de escopo

- OpenClaw: orquestrador.
- Pi Agent: executor controlado por RPC (JSONL por `stdin` e `stdout`).
- Uma **única instância Pi ativa por vez** durante o workflow do MVP. Cada papel inicia uma sessão nova **sequencialmente**, sem compartilhar o histórico de conversação.
- A ponte Node.js usada no teste de persistência foi **experimental**; não é o orquestrador definitivo.
- Não haverá teste de duas sessões Pi simultâneas nesta etapa.

## Evidências já informadas pelo usuário

| ID | Verificação | Evidência | Situação |
| --- | --- | --- | --- |
| E01 | Gateway OpenClaw | `rpc.ok=true`, PID `6824`, porta `18789` em escuta | Aprovado |
| E02 | Pi RPC direto | Requisição `teste-1`, `get_state`, `success=true` | Aprovado |
| E03 | OpenClaw → Pi RPC | Requisição `oc-pi-2`, `get_state`, `success=true`, exit `0` | Aprovado |
| E04 | Dois comandos no mesmo Pi | Requisições `oc-pi-3a` e `oc-pi-3b`, mesmo `sessionId`, exit `0` | Aprovado |
| E05 | Processo direto em segundo plano sem PTY | `STDIN_EOF`, processo encerrou com exit `0`; `process.write` não encontrou sessão ativa | Não aprovado para persistência |
| E06 | Processo de eco com PTY | Processo ativo e `stdinWritable=true`, mas nenhum eco registrado | Inconclusivo para transmissão de dados |
| E07 | Ponte Node HTTP local → Pi RPC | `bridge-5` e `bridge-6` retornaram `success=true`, com o mesmo `sessionId` `01a1d62d-9d52-750f-9f52-ca2ccf38b8d2` em duas mensagens do OpenClaw | Sessão persistente confirmada; PID do processo Pi ainda não aferido |

Até E07, foram utilizados comandos `get_state`, sem invocar inferência do modelo do Pi.

## E08 — Eventos durante inferência (aprovado)

**Primeira tentativa:** via pipe PowerShell, o Pi recebeu `prompt` e emitiu `agent_start`, mas o fechamento do `stdin` não permitiu observar conclusão. O teste foi considerado parcial.

**Segunda tentativa:** script Node.js v1 não conseguiu iniciar `pi.cmd` devido a aspas incorretas no Windows (`PI_EXIT code=1`, nenhum evento). Esse erro era de invocação do subprocesso, não do RPC.

**Terceira tentativa (v2):** `pi-rpc-eventos.mjs`, mantendo `stdin` aberto. Validado primeiro localmente pelo usuário e posteriormente executado por OpenClaw no Gateway. Saída fornecida:

```text
RESPONSE success=true disposition=started
EVENT agent_start
EVENT turn_start
MESSAGE_END assistant stopReason=stop
EVENT turn_end
EVENT agent_end
AGENT_SETTLED aborted=false
EVENT_COUNTS {"response":1,"agent_start":1,"turn_start":1,"message_start":3,"message_end":3,"message_update":8,"turn_end":1,"agent_end":1,"agent_settled":1}
ASSISTANT_TEXT "PONG-EVENTOS."
PI_EXIT code=0 signal=none
TEST_RESULT PASS
```

**Status E08: APROVADO**, com evidências de recebimento de eventos durante execução e conclusão. Houve aviso Node.js `DEP0190` ao usar `spawn(..., {shell:true})`; não impediu o resultado, mas deve ser corrigido antes de incorporar o código à arquitetura definitiva.

## Próximo teste: E09 — Cancelamento controlado

- Iniciar **um Pi** com `stdin` aberto; enviar prompt inofensivo de saída longa.
- Ao primeiro `message_update`, enviar RPC `abort` no **mesmo processo** antes de encerrá-lo.
- Verificar resposta RPC do `abort`, `agent_settled.aborted=true` e `get_state.isStreaming=false`.
- Encerrar o Pi ordenadamente e confirmar código de saída; timeout e última medida de limpeza devem atingir apenas a árvore do processo de teste.
- `abort` aceito sem evidência de `agent_settled.aborted=true` não comprova interrupção.

## Testes seguintes

- Falhas: encerramento inesperado, indisponibilidade do provedor e timeout.
- Sessões **sequenciais** independentes, verificando não transferência de contexto entre papéis.
- Restrições de acesso a arquivos no Windows, incluindo caminhos indiretos e permissões efetivas, não apenas instruções ao modelo.

## Limites do registro

Este arquivo registra resultados **informados pelo usuário**; nenhum dos testes foi executado diretamente no Windows pelo assistente. Evidências de isolamento do sistema de arquivos, de controle seguro das credenciais Git ou do Git Gateway **não existem ainda**. O serviço HTTP experimental é restrito a loopback, mas não possui autenticação.

## Referências técnicas

- [Pi RPC Mode](https://docs.pi.dev/latest/rpc)
- [Pi RPC Commands](https://pi.dev/docs/latest/rpc-commands)
- [Pi JSON Event Stream](https://pi.dev/docs/latest/json)
- [OpenClaw exec](https://docs.openclaw.ai/tools/exec)
- [Documento de contexto do projeto](contexto-projeto-automacao-workflow-atualizado.md)
