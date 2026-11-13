# Prova de eventos RPC v2 — Windows nativo

## O que mudou

A v1 invocava `cmd.exe /d /s /c` montando um comando com aspas manualmente. No Windows do teste, a invocação falhou com `pi.cmd não é reconhecido`. Esta v2 utiliza o mesmo padrão de criação de subprocessos que já funcionou na ponte anterior: `spawn(piCmd, flags, { shell: true, stdio: ['pipe','pipe','pipe'] })`.

O uso de `shell: true` aqui é **temporário para a prova**: o caminho é local conhecido e os argumentos são constantes. Não utilizar entradas externas para compor comandos de shell. Para uma implementação definitiva, preferir iniciar diretamente o executável do Node com o módulo CLI do Pi, ou usar o `RpcClient` oficial, após confirmar a instalação.

## Como executar

1. Confirme que nenhuma ponte/teste com Pi está ativo. Não é preciso encerrar o Gateway do OpenClaw.
2. Substitua o arquivo `C:\temp\pi-rpc-prova\pi-rpc-eventos.mjs` pelo deste pacote.
3. Opcionalmente, confira a sintaxe: `node --check C:\temp\pi-rpc-prova\pi-rpc-eventos.mjs`.
4. Primeiro, no PowerShell local: `node C:\temp\pi-rpc-prova\pi-rpc-eventos.mjs`.
5. Se passar, peça ao OpenClaw para executar exatamente o mesmo comando no host gateway (`pty: false`).

O script envia **um único** prompt `PONG-EVENTOS`, captura eventos do Pi até `agent_settled`, tenta fechamento ordenado e tem timeout. O prompt usa o modelo configurado, podendo consumir tokens. Nenhum arquivo do projeto ou skill é alterado.

**Aprovação:** `RESPONSE success=true`, `agent_settled`, texto `PONG-EVENTOS`, `PI_EXIT code=0` e `TEST_RESULT PASS`. Se falhar, não repita automaticamente: copie os eventos e os erros (removendo segredos) para diagnóstico.
