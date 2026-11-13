Data: 2026-11-13
Node.js: v24.20.0
OpenClaw: OpenClaw 2026.11.3 (847611d)
Pi Agent: 1.5.2
Gateway: modo local, porta 18789
Sistema: Windows nativo

Testes aprovados:
- Comunicacao RPC basica
- Persistencia via ponte Node.js
- Recebimento de eventos
- E09: cancelamento
- E10: erros de protocolo
- E11: falha e reinicializacao
- E12: timeout simulado e recuperacao
- E13: sessoes sequenciais independentes

Pendente:
- E14: restricoes de acesso a arquivos

Decisao:
- Apenas um processo Pi ativo por vez
