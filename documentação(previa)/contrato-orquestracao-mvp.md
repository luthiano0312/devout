# Contrato de orquestração MVP — OpenClaw + Pi Agent

**Versão:** rascunho 0.1 · **Data:** 2026-11-16  
**Situação:** especificação inicial; recomendações técnicas **não equivalem a aprovação do usuário**.  
**Escopo:** Etapa A — uma task em projeto descartável; nenhuma alteração nas skills ou implantação de orquestrador nesta etapa.

## 1. Fontes e precedência

1. Decisões aprovadas e evidências: `01-registro-integracao-openclaw-pi-e-decisoes.md` e `contexto-projeto-automacao-workflow-atualizado.md`.
2. Regras concretas atuais: `my-skills/.agents/skills/implement/` e `my-skills/.agents/skills/plan/` na branch `main`, consultadas em 16/11/2026. Antes de codificar, fixar a revisão Git consultada.
3. Protocolo: [Pi RPC](https://docs.pi.dev/latest/rpc), [comandos](https://docs.pi.dev/latest/rpc-commands) e [eventos](https://docs.pi.dev/latest/json). O comportamento da versão **instalada** prevalece sobre documentação de `latest`, após teste de compatibilidade.

Em caso de divergência entre plano aprovado, registro e Git: **pausar para reconciliação**; o estado operacional não os substitui.

## 2. Decisões já aprovadas (não reabrir)

- Windows nativo; OpenClaw orquestra; Pi executa via RPC; Node.js pode controlar pipes. Sem Docker/WSL2.
- **No máximo um Pi ativo por vez.** Papéis sempre em processos/sessões novos e sequenciais. O revisor executa suas fases 1 e 2 **na mesma sessão de revisão**, com um gate entre elas.
- Só uma task aprovada no primeiro ciclo; sem automação de marco inteiro nem Git Gateway agora.
- `registro.md` é status oficial; somente o controlador autorizado pelo OpenClaw atualiza estados. Resultado textual ou código de saída do Pi nunca constitui aprovação.
- Manter até três correções completas/quatro revisões, achados `bloqueador` e `importante` obrigatórios, `melhoria opcional` não bloqueante, e notificação de **todos** os achados.
- Mitigação da leitura antecipada com `review_inputs.py`, instruções e `pi-file-permissions`; **não** afirmar isolamento real. Exposição efetiva na fase 1 interrompe o fluxo.
- Um reinício automático **adicional**, no máximo, apenas para falha local pré-commits e descarte comprovadamente seguro de uma tentativa isolada; nunca descartar alterações preexistentes, trabalho de terceiros ou commits.
- Commits oficiais, branches de marco/task, sincronização remota, homologação e autorização para `main` permanecem no desenho-alvo, mas fora deste contrato executável inicial.

## 3. Responsabilidades e fronteiras — proposta

| Componente | Responsabilidade | Não deve fazer |
|---|---|---|
| OpenClaw | Iniciar task aprovada; solicitar papéis; notificar achados e pausas; autorizar gates com verificadores determinísticos | Confiar na frase final do Pi; decidir requisito ou escopo novo |
| Controlador local (módulo Node separado do driver) | Máquina de estados, lock, invocar validadores, gravar estado operacional, solicitar atualizações oficiais através do script | Editar `registro.md` manualmente; executar Git privilegiado |
| Driver Pi (Node) | `spawn`, stdin/stdout JSONL, correlação, eventos, timeouts, abort/stop, PIDs e confirmação de término | Decidir aprovação técnica; atualizar registro; executar comandos arbitrários solicitados pelo modelo |
| Pi por papel | Produzir código, relatório/revisões e sinalização estruturada para validação | Alterar estados oficiais, publicar Git, autorizar outro papel |
| Verificadores | Conferir tarefa, Git, arquivos, integridade dos relatos, contagem, snapshot e transições | Inferir conclusão apenas de exit code, marcador isolado ou declaração do agente |

**Proposta de princípio:** validação determinística no controlador, com regras de engenharia consumidas das skills. Não duplicar toda a skill em código, mas automatizar os gates que impedem avanço incorreto.

## 4. Comunicação OpenClaw ↔ controlador — **escolha ainda pendente**

- **A — CLI síncrona por papel:** OpenClaw chama `node ... run-role`, que gerencia Pi até o fim. **Vantagem:** nenhum serviço residente, menos superfície. **Limite:** controle/cancelamento no meio da execução e gate de revisão fase 1 exigem que a CLI contenha boa parte do controlador e que a execução longa seja compatível com os limites de `exec` do OpenClaw.
- **B — controlador local residente via Windows Named Pipe + CLI cliente:** OpenClaw chama uma CLI restrita (`start-role`, `send`, `status`, `abort`, `stop`, `events`) que fala com um único supervisor Node. **Vantagem:** chamadas separadas preservam processo/sessão, permitem gate entre os dois prompts de revisão e recuperação de estado. **Custo:** ciclo de vida e autorização de acesso ao pipe precisam de testes.
- **C — HTTP em loopback:** aproveita a ponte de prova, mas requer autenticação, proteção contra acesso de outros processos e controle operacional. **Não recomendado** reaproveitar o endpoint experimental sem autenticação.

**Recomendação inicial:** B, por corresponder às chamadas independentes já comprovadas e permitir que o OpenClaw inspecione o gate antes de liberar a fase 2. É uma **recomendação para validação**, não interface já existente. O pipe local também não cria isolamento forte entre programas executados sob a mesma conta Windows. Testar permissões do pipe e não expor funções RPC genéricas (`bash`, `set_model`, etc.) ao cliente.

## 5. API mínima proposta — controlador/driver

| Operação | Entrada mínima | Saída/garantia |
|---|---|---|
| `startRole` | `taskId`, `role`, `round?`, `workspace`, `modelProfile`, `attempt` | `runId`, `pid`, `sessionId`, processo novo, lock exclusivo adquirido |
| `sendPrompt` | `runId`, `phase`, `promptRef` | `requestId`; resposta Pi correlacionada; eventos **não** são uma resposta ao comando |
| `getStatus` | `runId` | ciclo de vida, `isStreaming`, último evento e contadores; consulta não implica gate aprovado |
| `readEvents` | `runId`, `afterSequence` | eventos ordenados, sem perda no limite da retenção, com sequência própria do controlador |
| `abortRole` | `runId`, `reason` | solicitação de abort; aguardar `agent_settled(aborted=true)` ou aplicar timeout/encerramento |
| `stopRole` | `runId` | stdin encerrado, filho finalizado, saída e árvore de processos verificadas; libera lock somente após confirmação |
| `reconcile` | `taskId` | estado revalidado a partir de processo, artefatos, Git e registro; se ambíguo, bloqueia início |

**Envelope sugerido:** `{runId, taskId, role, attempt, phase, requestId?, timestamp, payload}`. Todos os IDs são atribuídos pelo controlador. **Somente um prompt em andamento por Pi** no MVP; não usar `steer`/`follow_up` como mecanismo de concorrência. O par `requestId` identifica respostas RPC; eventos de sessão não têm necessariamente esse ID, logo recebem sequência e `runId` do controlador.

**Reuso antes de implementação própria:** a documentação atual do Pi oferece `RpcClient` para integração TypeScript por subprocesso. Verificar disponibilidade, comportamento no Windows e compatibilidade com o Pi **instalado** antes de escrever parser e correlação próprios. Se não for compatível, usar o driver JSONL mínimo já validado na prova, com as salvaguardas abaixo.

**JSONL:** delimitador LF somente; buffer de bytes/UTF-8 com tratamento de fragmentos; CRLF permitido; limite de tamanho por mensagem; stdout interpretado exclusivamente como protocolo, stderr como diagnóstico separado; consumo contínuo de ambos e backpressure de stdin. Não usar `readline` do Node como separador universal (U+2028/U+2029 podem aparecer em strings JSON). O prompt é **aceito**, não concluído, com resposta `success=true` / `disposition=started`. Esperar `agent_settled` e conferir erros de mensagem/provedor, estado e artefatos. `disposition=handled` não produz necessariamente um run a aguardar. `agent_end` isolado não é garantia de encerramento completo.

**Windows:** retirar `spawn(..., shell:true)` com argumentos variáveis. **Proposta:** descobrir entrada JavaScript executável do Pi instalado e invocar `node` com argumentos em array, sem shell, **se compatível com a instalação**; caso contrário, desenvolver launcher `.cmd` com argumentos estritamente fixos e testar o processo-filho. Em falha, encerrar a **árvore** iniciada, verificar término real e não reutilizar lock se houver Pi sobrevivente/órfão. Testar em máquina real; resultado E11 (morte de Pi) não provou reconciliação da task.

## 6. Estado operacional mínimo (separado de `registro.md`)

Persistir um arquivo atômico do controlador, por exemplo `.orquestrador/state.json` **fora do commit funcional**, com:

```json
{
  "schemaVersion": 1,
  "taskId": "M01-T01",
  "attempt": 1,
  "runId": "identificador-da-execucao",
  "role": "reviewer",
  "phase": "review_phase1",
  "reviewRound": 1,
  "process": {"pid": null, "sessionId": null, "status": "stopped"},
  "workflow": "verifying",
  "baselineCommit": "hash-real-a-preencher",
  "workspaceId": "ambiente-descartavel-identificado",
  "lastEventSequence": 0,
  "restartUsed": false
}
```

`process.status`: `starting | running | stopping | stopped | uncertain`.
`workflow`: `idle | running | verifying | technically_approved | paused | failed`.
`phase`: `implementation | review_phase1 | review_phase2 | correction | reaudit_phase1 | reaudit_phase2 | none`.

Persistir também eventos técnicos resumidos e resultados por `runId`, sem segredos ou transcrição bruta obrigatória. Usar escrita temporária + rename atômico; antes de avançar após reinício, conferir PIDs, lock, status oficial do `registro`, snapshot e Git. `state.json` **não replica o status oficial**. Recuperação ambígua = pausa, não retomada presumida.

## 7. Resultados normalizados — proposta

| Resultado do papel | Significado | Efeito |
|---|---|---|
| `completed` | Papel encerrou sem erro de protocolo **e suas evidências passaram no gate** | Habilita a próxima etapa, conforme papel; **não significa task concluída** |
| `changes_required` | Revisão finalizada contém achado `bloqueador` ou `importante`, com evidências consistentes | Notifica tudo; se rodada 1–3, vai para correção; na rodada 4, pausa |
| `blocked` | Decisão, acesso, contradição, escopo ou evidência necessária não recuperável | Pausa e solicita decisão/recomposição |
| `failed` | Erro técnico ou saída inválida, com encerramento de processo conhecido | Reinicia uma vez **apenas se** tentativa for comprovadamente descartável; caso contrário, pausa |
| `interrupted` | Abort/timeout/crash; pode haver processo sobrevivente ou resultado parcial | Conciliar e encerrar processo antes de qualquer continuação; depois classificar recuperação segura ou pausa |

**Resultado declarado pelo Pi:** sidecar JSON por execução (`role`, `round`, `declaredOutcome`, `evidencePaths`, `findings[]`, `runId`). É **sinalização**, não decisão. O validador exige consistência com os arquivos Markdown oficiais, Git e eventos; divergência bloqueia. O esquema definitivo do sidecar e o parser de `Decisão final` exigem ajuste mínimo posterior nas skills/templates.

## 8. Papéis, entradas, saídas e gates

| Papel/fase | Entrada permitida | Evidência/gate para seguir |
|---|---|---|
| Implementador | Task aprovada (quatro campos), mapa de caminhos, fontes pertinentes, baseline; sem todas as tasks do marco | Arquivos/relatório `task-<ID>-relatorio.md` existem; critérios testáveis identificados; mudanças atribuíveis à task; status oficial `em andamento` → `aguardando revisão` |
| Revisor, fase 1 | Task, fontes, `review_inputs.py` (metadados e diffs filtrados), entregáveis permitidos. **Não** ler Observações/relatos anteriores | Gerar `task-<ID>-revisao-<R>.md` com `Estado: incompleta`, `snapshot` correspondente e `Avaliação independente` efetivamente preenchida. **Gate determinístico antes da fase 2** |
| Revisor, fase 2 | **Mesma sessão Pi** da fase 1; agora ler relatório e revisões anteriores | Preencher `Confronto com relatos` e `Decisão final`; `Estado: finalizada`; achados e contagem válidos; sem narrativa reescrita da fase 1 |
| Corretor | Nova sessão; task, revisão **finalizada** mais recente e relatório | Corrigir obrigatórios, acrescentar `Correção após revisão R` sem destruir histórico; devolver `em correção` → `aguardando revisão` |
| Reauditor | **Novo processo revisor**, mesmos gates fase 1/fase 2 | Revisão de rodada seguinte, sem herança do chat da correção; max. 4 revisões |

**Gates gerais:** task existente e ID estável, quatro campos presentes, dependências/baseline verificados, branch/workspace esperado, nenhum trabalho não atribuível modificado, limites respeitados, snapshots válidos, ausência de leitura indevida **observada**, relatórios presentes e coerentes, nenhum erro pendente, processo anterior comprovadamente morto. Checklist técnico da revisão inclui reexecutar testes relevantes. Marcadores escritos pelo Pi sem conferência não bastam.

**Notificação ≠ interrupção:** reportar todo achado de revisão ao usuário, inclusive opcionais; correção obrigatória conhecida pode prosseguir automaticamente dentro do limite. Achado que exija mudança de requisito/arquitetura/`Não alterar` pausa.

## 9. Máquina de transições oficial

`registro.md` mantém exatamente os estados legados:

```text
não iniciada → em andamento → aguardando revisão
                                │           │
                                ├─ achado obrigatório (R1–R3) → em correção
                                │                                     │
                                │                      aguardando revisão
                                │
                                └─ revisão técnica aprovada → mantém
                                   aguardando revisão até a Etapa C (Git)
```

Para o MVP sem commits, **`concluída` não é atingida**: aprovação técnica é registrada **apenas operacionalmente**, e o status oficial permanece `aguardando revisão`. O futuro gate de conclusão exigirá commit funcional confirmado, `update_registro.py` para `concluída` e segundo commit de metadados. `pausada` é aplicado com motivo para inconsistência, contaminação ou limite; a evolução para outro ID é responsabilidade futura da `plan` com aprovação humana.

## 10. Persistência, restart e falhas

- Baseline: registrar commit Git, caminhos aprovados, inventário inicial e identidade do workspace; recusar execução se houver arquivos de usuário não atribuíveis ou material sensível.
- Cada tentativa usa **workspace descartável dedicado**, sem mudanças preexistentes de terceiros. Para reinício técnico, é preferível **arquivar o workspace da tentativa** e reconstruir outro a partir do baseline verificado, em vez de `reset --hard` no workspace do usuário.
- Se o Pi/crash/timeout deixa morte incerta, nenhum novo Pi pode iniciar; tentar encerramento controlado e confirmar **árvore** de processos. Se não for possível confirmar, pausar.
- Reinicialização técnica: primeira execução `attempt=1`; se seguro, segunda `attempt=2`, com `restartUsed=true`. Falha na segunda, ambiguidade de Git, trabalho alheio ou ação irreversível: pausa.
- Interrupção para decisão **não consome reinício técnico**. Revisões/correções previamente válidas não são zeradas por uma falha nem por reinício arbitrário. Como o descarte de tentativa pode apagar artefatos intermediários ainda não versionados, exigir guarda/arquivo de diagnóstico e política explícita de consistência com o registro antes de implementar restart.
- Nenhum commit, push, merge ou `main` neste slice; se um deles ocorrer inesperadamente, interromper para reconciliação, nunca fazer rollback cego.

## 11. Auditoria do repositório real — diferenças a tratar **depois** do contrato

Verificado em `my-skills/.agents/skills/` (`main`, 16/11/2026):

1. `implement/SKILL.md` ainda manda iniciar cada papel manualmente numa conversa nova e proíbe avanço automático/subagentes. A orquestração por processos Pi independentes demandará **adaptação mínima explícita**.
2. A `plan` atual concentra o marco em um `plano.md`; arquivos individuais por task + índice são **aprovados conceitualmente, mas não implementados**. O primeiro slice pode usar um `plano.md` real/fixture, sem migrar a `plan`.
3. `review_inputs.py` já retorna `snapshot`, diffs filtrados, `reviews` e metadados sem narrativas. É base útil para o gate da fase 1, **não ACL** e não detector completo de leitura indireta.
4. `update_registro.py` valida os estados, rejeita conclusões sem hash e substitui `Observações` quando `--obs` é passado; não há transição para reinício técnico (`não iniciada`) nem operação de append de observações. Não inventar reset de status; propor **append atômico com controle de concorrência** ou evento de tentativa separado, sem apagar histórico.
5. A revisão atual é narrativa Markdown; `Estado: incompleta/finalizada` e `snapshot` aparecem no contrato do revisor, mas classificações/conclusões ainda exigem esquema ou validador específico para permitir gates programáticos. Não aceitar um marcador como aprovação automática.
6. A skill atual só aceita dois commits após autorização humana explícita; a autorização conceitual do marco muda esse comportamento **em etapa posterior**. **Não liberar commits no MVP A/B.**

## 12. Critérios de aceite do primeiro slice (Etapa B)

| ID | Cenário em repositório descartável | Resultado observável |
|---|---|---|
| T01 | Task pequena, implementador conclui, revisor aprova | Relatório + revisão fase 1/2, `technically_approved`, registro `aguardando revisão`; nenhum commit |
| T02 | Revisão R1 com achado `importante` | Notificação e status `em correção`; nova sessão do corretor; revisão R2 independente |
| T03 | Achado `melhoria opcional` sem obrigatório | Notificar, não corrigir automaticamente, aprovação técnica possível |
| T04 | Achados obrigatórios sobrevivem à revisão R4 após 3 correções | Status `pausada` com motivo; nenhuma R5/correção 4 |
| T05 | `prompt` aceito, mas ainda sem `agent_settled` | Não avança; acompanha eventos e timeout, não interpreta resposta como conclusão |
| T06 | `abort` em andamento | Cancelamento/interrupção reportados; processo e árvore encerrados antes de qualquer novo Pi |
| T07 | Crash/EOF/JSONL inválido, timeout ou falha de provedor | Erro identificado, sem gate falso; reconciliação; no máximo um restart seguro |
| T08 | Falha com mudanças preexistentes ou PID órfão incerto | Pausa; preserva trabalho; não reinicia nem abre segundo Pi |
| T09 | Revisão fase 1 sem avaliação persistida ou com relato lido indevidamente de forma detectada | Fase 2 bloqueada; contaminação detectada pausa o fluxo |
| T10 | Processo Pi anterior ainda ativo | `startRole` rejeitado; nunca dois Pi ativos |
| T11 | Revisão aprovada com registro alterado inesperadamente | Gate falha, reconciliação; não escreve por cima das Observações |

**Limites dos testes:** E12 original exercitou timeout simulado, não falha real do provedor; E14 demonstrou bypass pelo controlador RPC `bash`, não isolamento forte. Testes de observação de contaminação não provam que todas as leituras sejam detectáveis.

## 13. Decisões que faltam fechar, na ordem sugerida

1. **Canal OpenClaw ↔ controlador:** opção B (Named Pipe + CLI) recomendada versus opção A (CLI por papel). Verificar compatibilidade com o `exec` do OpenClaw Windows e com a versão local do Pi.
2. **Contrato de evidências legíveis por máquina:** sidecar JSON mínimo + validação dos Markdown oficiais, sem duplicar fonte de verdade; definir campos obrigatórios e parser de `Decisão final`.
3. **Condições objetivas de reinício:** formato do inventário do workspace, guarda de evidências, controles anti-concorrência e efeito sobre status intermediários.
4. **Ajustes mínimos futuros:** primeiro criar protótipo descartável B; depois adaptar `update_registro.py`, `implement` e, mais tarde, `plan` — cada alteração com testes e compatibilidade com o fluxo manual.

**Próximo experimento novo (não repetir E09–E14):** criar um controlador local mínimo capaz de iniciar um revisor, receber o primeiro prompt, conferir artefato incompleto, enviar o segundo prompt **na mesma sessão**, parar o processo e impedir o lançamento de outro antes do encerramento confirmado.
