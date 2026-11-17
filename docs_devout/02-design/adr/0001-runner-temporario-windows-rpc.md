# ADR-0001: Role Runner temporário no Windows com Pi RPC

## Status

Aceito — registro retrospectivo da decisão consolidada no contrato v1.0 em 16/11/2026; não constitui nova aprovação nem comprovação de implementação.

## Contexto

É necessário coordenar papéis independentes preservando as regras das skills e começar com uma task em Windows nativo. Os experimentos mostraram encerramento prematuro de stdin na chamada direta e viabilidade de um driver Node mantendo pipes RPC; a ponte HTTP experimental não define a solução definitiva.

Fontes: [contrato MVP](../contrato-orquestracao-mvp.md), seções 2–4; [prova de integração](../../reference/01-registro-integracao-openclaw-pi-e-decisoes.md), seção 4.

## Decisão

OpenClaw orquestra e invoca por `exec` assíncrono um Role Runner Node.js temporário por papel/execução. O Runner controla Pi Agent via Pi Driver com JSONL em stdin/stdout, separando stderr. Acompanhar por mecanismos `process` disponíveis e arquivos de execução. Não introduzir supervisor Node residente, HTTP permanente, Named Pipe, Docker ou WSL2 no MVP.

## Consequências

- Positivo: ciclo de vida limitado ao papel e aproveitamento da integração RPC demonstrada.
- Positivo: separação entre coordenação do OpenClaw, processo/transporte do Driver e evidências do Pi.
- Negativo: acompanhamento assíncrono e cancelamento precisam de coordenação local explícita, sem serviço residente.
- Pendente de validação: spawn seguro de `.cmd` sem argumentos variáveis em shell, estabilidade de `exec`/`process` no Windows e após reinício do Gateway. Esta decisão não resolve esses testes por si só.
