# ADR-0002: Execução Pi sequencial com exclusividade comprovada

## Status

Aceito — registro retrospectivo da decisão de 16/11/2026, consolidada no contrato v1.0; implementação da trava e encerramento ainda depende do M01.

## Contexto

Sessões independentes por papel não exigem concorrência. Dois Pi simultâneos aumentam conflitos de escrita, consumo de recursos e complexidade de falhas. PID antigo, exit code ou arquivo de lock isolado não provam identidade nem término seguro.

Fontes: [prova de integração](../../reference/01-registro-integracao-openclaw-pi-e-decisoes.md), seção 2; [contrato MVP](../contrato-orquestracao-mvp.md), seções 2 e 5.

## Decisão

Permitir no máximo um Pi do workflow ativo por vez. OpenClaw só despacha o próximo papel após os gates pertinentes e confirmação do encerramento anterior. Cada Runner adquire trava global exclusiva antes de iniciar Pi e libera somente após término verificado, incluindo subprocessos relevantes.

Cancelamento pede abort, tenta término normal com prazo limitado e, quando necessário, usa `taskkill /T /F` apenas sobre alvo seguramente identificado, com verificação posterior. Processo, PID ou lock incerto bloqueia novas execuções até reconciliação.

## Consequências

- Positivo: menor complexidade e ausência de disputa intencional entre papéis.
- Positivo: invocação duplicada não deve criar segundo Pi.
- Negativo: não há paralelismo; falha incerta pode exigir intervenção e manter o fluxo bloqueado.
- Pendente de validação: aquisição atomicamente exclusiva, identidade de processo, PID reutilizado, timeouts e confirmação da árvore Windows, conforme M01-T02/M01-T03.
- Limite: a exclusividade cobre Pi iniciados/controlados pelo workflow, não qualquer Pi aberto por software externo.
