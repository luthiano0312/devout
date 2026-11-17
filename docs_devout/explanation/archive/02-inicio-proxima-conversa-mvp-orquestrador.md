# Início de nova conversa — Especificação do MVP de orquestração OpenClaw + Pi

**Data de referência:** 16/11/2026  
**Situação:** prova de integração finalizada; próximo trabalho = **Etapa A, contrato de orquestração**.  
**Leia junto com:** `01-registro-integracao-openclaw-pi-e-decisoes.md` e `contexto-projeto-automacao-workflow-atualizado.md` nas fontes do projeto.

## Briefing para a nova conversa

Quero continuar meu projeto de automação do workflow de desenvolvimento. Já realizei uma prova de integração no Windows nativo e **comprovei que OpenClaw pode controlar Pi Agent por RPC**: comandos, sessões persistentes via ponte Node.js, eventos de execução e conclusão, cancelamento, erros de protocolo, reinício de processo após falha, timeout simulado e sessões sequenciais independentes.

**Não repetir a pesquisa/instalação nem os experimentos básicos**, salvo para verificar uma hipótese técnica realmente nova. O objetivo agora é **projetar e começar a implementar o MVP em passos pequenos**, preservando meu workflow existente (`grill-me`, `docs`, `plan`, `implement`) e as decisões já aprovadas. Inicialmente **não quero modificar as skills** nem automatizar um marco inteiro.

## Decisões fechadas que devem orientar a solução

1. **Windows 10/11 nativo**, OpenClaw como orquestrador, Pi Agent como executor RPC, Node.js como ponte/driver se necessário. Sem Docker ou WSL2 no MVP.
2. **Máximo de um processo Pi ativo por vez**. Implementador, revisor e corretor usam processos/sessões **independentes, sequenciais**. Um processo termina comprovadamente antes de iniciar o próximo. Não exigir nem implementar sessões paralelas.
3. Começar com **uma task aprovada**, passando por implementação, revisão independente, correção quando necessária e reauditoria. O Pi produz código e evidências; **OpenClaw verifica condições e controla estados oficiais**.
4. Preservar as regras atuais da `implement`: duas fases da revisão, relatórios/evidências persistidos, bloqueio por achado obrigatório, reporte de todos os achados, até três correções completas/quatro revisões, pausas por decisão ou inconsistência, revisão técnica por IA e homologação humana do marco.
5. Na revisão fase 1, instruções + `pi-file-permissions` e filtragem por `review_inputs.py` são **mitigações contra exposição acidental**, **não segurança forte**. O E14 comprovou que o controlador RPC `bash` pôde ler um arquivo marcado como proibido. O usuário **aceitou explicitamente adiar isolamento forte** para depois do MVP, desde que isso seja tratado como risco, em experimento descartável, e exposição efetiva interrompa o fluxo.
6. Persistência da task no `registro.md`; estado operacional mínimo do OpenClaw **separado** do registro oficial. Resultado de prompt, exit code e mensagem do modelo não bastam para aprovar transições.
7. Para falha local anterior aos commits oficiais, considerar **no máximo uma reinicialização automática adicional**, após validar baseline e ausência de trabalho de terceiros; não descartar trabalho preexistente, nem reiniciar cegamente após commit/integração/publicação.
8. O plano e as skills existentes continuam como fontes das regras, com adaptações **mínimas e posteriores**, verificadas contra o conteúdo real do repositório.
9. Git Gateway restrito, dois commits oficiais, branches de task/marco, sincronização e autorização humana para `main` continuam aprovados **conceitualmente**, mas **não integram a próxima etapa imediata**. Sem `force push`, squash ou permissões Git amplas para o Pi.

## Prova técnica encerrada — evidências essenciais

| Capacidade | Resultado |
|---|---|
| OpenClaw Gateway Windows `2026.11.3` | `rpc.ok=true`, UI local `127.0.0.1:18789` |
| OpenClaw → Pi RPC | `get_state`, `success=true`, saída `0` |
| Mesma sessão em chamadas separadas | Ponte Node.js `127.0.0.1:18790`, mesmo `sessionId` |
| Geração e eventos | `message_update` observado, `agent_settled aborted=false`, `PONG-EVENTOS.`, `PASS` |
| Cancelamento | `abort` → `agent_settled aborted=true`, `isStreaming=false`, `PASS` |
| Erros de protocolo | Erro parse estruturado seguido de comando válido, `PASS` |
| Falha abrupta / nova sessão | Encerramento forçado, novo Pi e novo `sessionId`, `PASS` |
| Timeout simulado | Detectado e recuperado com Pi real em seguida, `PASS` |
| Sessões independentes sequenciais | Segunda sessão `messageCount=0`, histórico vazio, 0 Pi restantes, `PASS` |
| Restrição de arquivo E14 | `read` permitido funcionou; modelo recusou read proibido sem chamar ferramenta; comando RPC `bash` **leu arquivo proibido** — risco aceito no MVP |

Limitações: a ponte é experimental; `DEP0190` ao usar `spawn(..., shell:true)` precisa ser removido antes de interface genérica; não existe implementação de orquestração/estado/transições/Git Gateway pronta. Falhas reais do provedor e restauração da task não foram validadas. Não afirmar isolamento de arquivos real.

## Próximo objetivo concreto: **Etapa A — especificar o contrato de orquestração**

Quero uma especificação enxuta e verificável antes da implementação. Precisamos definir, priorizando o mínimo necessário:

- **Camada de processo/RPC:** API mínima (`start`, `sendPrompt`, `getState`, `abort`, `stop`, `events`, ou nomes melhores), correlação de requisições, leitura de JSONL, ciclo de vida de subprocesso Windows, EOF, timeout, confirmação de morte e proibição de múltiplos Pi ativos. Decidir como OpenClaw chama essa camada sem transformar um HTTP experimental não autenticado em serviço de produção.
- **Resultados e estados:** como diferenciar `completed`, `changes_required`, `blocked`, `failed`, `interrupted`; quais observações provêm de eventos RPC e quais dependem de evidências verificáveis em disco; estado operacional mínimo separado de `registro.md`.
- **Contrato de papéis:** entrada/contexto autorizados e saída esperada para implementador, revisor fase 1, revisor fase 2, corretor e reauditor; como garantir troca de processo entre papéis; limites da mitigação de exposição acidental.
- **Gates:** quais verificações programáticas permitem transições; o que notifica, o que pausa, o que reinicia; como usar e quando adaptar `review_inputs.py` e `update_registro.py` sem apagar dados.
- **Persistência e falhas:** estados intermediários e recuperação após interrupção; segurança do baseline, não iniciar nova sessão com processo anterior incerto, escopo de uma nova tentativa, limites existentes.
- **Critérios de aceite:** cenários pequenos e observáveis para a primeira task simulada, incluindo aprovação, achado obrigatório, cancelamento e falha.

**Entregável inicial:** um `contrato-orquestracao-mvp.md` com responsabilidades, interface, estados, transições, evidências e casos de teste; se houver pontos que ainda exigem escolha, apresente alternativas com trade-offs e recomende uma, sem inventar decisões já aprovadas.

## Sequência de execução sugerida após o contrato

**Etapa B — vertical slice de uma task em projeto descartável:** implementar a camada mínima e demonstrar `implementador → revisor → [corretor → revisor]`, sem alterar `plan`/`implement` de início. Só depois adaptar as skills com mudanças mínimas e validações.

**Etapa C — Git Gateway mínimo:** operações Git específicas, permissões e duas autorizações, integração task → marco preservando commits e sincronização remota em repositório descartável. `main` apenas após autorização humana explícita.

**Fora de escopo imediato:** execução paralela, automação de marco inteiro, migração plena da `plan`, checkpoints remotos parciais, isolamento forte do Windows, servidor de produção e estrutura genérica de multiagentes.

## Onde encontrar os recursos locais

No computador de teste: `C:\temp\pi-rpc-prova\` (scripts `.mjs` dos experimentos); `C:\temp\pi-rpc-e14\` (arquivos sintéticos de permissão). Pi CLI em `%USERPROFILE%\.pi\agent\bin\pi.cmd`; Gateway local na porta `18789`. Os caminhos podem mudar em outro computador. Não copiar `.pi`/`.openclaw` integralmente nem versionar tokens e históricos.

Repositório de referência das skills: <https://github.com/luthiano0312/my-skills>.

## Primeira ação esperada do assistente na nova conversa

1. Ler os **dois documentos de fonte** mencionados no início e identificar decisões novas versus conceitos ainda pendentes.
2. Verificar a implementação real dos scripts/skills **quando essa informação for necessária para especificar interfaces**, em vez de pressupor conformidade.
3. Propor o **esqueleto do contrato mínimo de orquestração** e começar a fechá-lo por blocos de decisões, sem reabrir perguntas já resolvidas, sem instalar ferramentas de novo e sem codificar o orquestrador inteiro antes de aprovar o contrato.

**Pergunta inicial sugerida para orientar a próxima conversa:** “Qual é o menor contrato técnico entre OpenClaw, o gerenciador de processos Pi e os artefatos de uma task que permite executar um ciclo sequencial completo e auditável?”
