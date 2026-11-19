# Contrato de orquestração MVP — OpenClaw + Pi Agent

**Versão:** 1.0 — decisões consolidadas em 16/11/2026  
**Situação:** **contrato de desenho aprovado, parcialmente implementado e ainda não validado integralmente**. O Slice 1 foi implementado, revisado e encerrado no M01; o Slice 2 ainda não foi iniciado e os Slices 3 e 4 permanecem futuros.

**Planejamento vigente:** o [plano M02 ativo](../plano.md) foi aprovado em 2026-11-19 e delimita o Slice 2; sua execução exige confirmação do baseline e dos gates da task. A continuidade do MVP (Etapa B) permanece restrita a **Windows nativo**, com **uma task e um repositório descartável**.

**Rastreabilidade de progresso:** [plano M01 arquivado](../03-execucao/planos/marco-M01.md) e [registro oficial](../03-execucao/registro.md). Esta atualização de situação não altera as decisões, requisitos ou etiquetas originais abaixo; pontos de validação devem ser confrontados com as evidências do slice correspondente.

**Natureza deste documento:** separa **[APROVADO]** (decisões tomadas), **[VALIDAR]** (comportamentos que dependem de testes) e **[DETALHAR]** (parâmetros ou formatos que ainda não foram fechados). Exemplos de comandos, estruturas e JSON são **ilustrativos**, salvo quando expressamente definidos como requisito.

## 1. Objetivo, limites e fontes

**Objetivo imediato.** Automatizar uma task aprovada do workflow existente: `implementador → revisor → [corretor → revisor]*`, com troca real de processos/sessões Pi entre papéis, revisão em duas fases, evidências persistidas, gates determinísticos e transições oficiais controladas pelo OpenClaw. Encerrar o MVP na **aprovação técnica**, sem realizar os commits oficiais.

**Fontes a preservar:**

1. [Contexto consolidado](../explanation/contexto-projeto-automacao-workflow-atualizado.md) — desenho e decisões conceituais do workflow.
2. [Registro da integração](../reference/01-registro-integracao-openclaw-pi-e-decisoes.md) — evidências da prova RPC e decisões de integração, incluindo E14.
3. [Briefing da Etapa A](../explanation/archive/02-inicio-proxima-conversa-mvp-orquestrador.md) — fonte histórica do briefing/escopo, anterior a este contrato.
4. Repositório [`luthiano0312/my-skills`](https://github.com/luthiano0312/my-skills), especialmente `.agents/skills/implement/` (skill, `references/revisor.md`, `references/implementador.md`, `references/corretor.md`, `scripts/review_inputs.py`, `scripts/update_registro.py`) e `.agents/skills/plan/`. Conteúdo inspecionado na branch `main` durante a especificação; **fixar SHA de commit e revalidar antes de adaptar o código**.
5. Protocolo e documentação do Pi RPC: https://docs.pi.dev/latest/rpc e documentação da versão instalada. Comportamento real do Windows e do Pi instalado será testado; não inferir de documentação `latest` que tudo já funciona na versão local.

**Fora do MVP imediato:** Git Gateway, commits oficiais, merge/push, automação de todas as tasks do marco, integração na `main`, migração completa da `plan`, paralelismo, WSL2/Docker, isolamento forte Windows, serviço de produção e arquitetura genérica de multiagentes. O desenho futuro mantém branches por marco/task, **dois commits oficiais** da task e integração sem squash/force push, sincronização remota após aprovação técnica e autorização humana explícita para `main` — mas não serão implementados neste ciclo.

## 2. Decisões principais — [APROVADO]

| Tema | Decisão consolidada |
|---|---|
| Plataforma | Windows 10/11 nativo. OpenClaw orquestra; Pi executa via RPC; Node.js faz a integração. |
| Unidade de automação | **Uma task aprovada por vez** em projeto descartável. |
| Topologia | **Alternativa A:** um **Role Runner temporário por papel**. Sem supervisor Node residente, Named Pipe ou HTTP permanente no MVP. |
| Sequência | **No máximo um processo Pi do workflow ativo por vez**; novos processos e históricos independentes entre implementador, revisor e corretor. |
| Revisão | **Dois prompts RPC na mesma sessão Pi do revisor**, com gate automático entre fase 1 e fase 2; sem autorização humana intermediária. |
| Invocação | OpenClaw chama Role Runner por `exec` assíncrono usando `yieldMs`; acompanha via mecanismos `process` e arquivos operacionais. |
| Encerramento forçado | Após tentativa normal, usar **`taskkill /T /F`** no Windows, com identificação adequada do alvo e confirmação posterior; testar em ambiente descartável. |
| Exclusividade | **Gate de transição no OpenClaw + trava global mínima entre Runners**. Chamada duplicada não pode lançar outro Pi. |
| Retomada técnica | **No máximo uma reinicialização automática adicional na implementação inicial**, somente com baseline e descarte comprovadamente seguros. |
| Falhas em revisão/correção | **Pausar e reconciliar**; não reiniciar automaticamente esses papéis no MVP. |
| Persistência | Arquivos: `registro.md` oficial, estado operacional pequeno por task e diretórios de execução por `runId`. |
| Coordenação de gravações | Intenção de transição → atualização validada do registro → confirmação; reconciliação idempotente após falha. |
| Gates | Estruturais mínimos, com verificações técnicas adicionais apenas quando exigidas pela task/projeto. |
| Testes | Fluxos principais com OpenClaw + Pi reais; situações excepcionais majoritariamente simuladas; testes reais específicos de cancelamento/encerramento no Windows. |

**Princípio invariável:** nenhum `exitCode=0`, retorno `success=true`, `prompt accepted`, mensagem do modelo ou arquivo isolado implica aprovação da task. O controlador valida resultados e evidências antes de transições.

## 3. Arquitetura e responsabilidades — [APROVADO]

```text
OpenClaw (orquestrador: agenda papéis, valida gates, decide transições)
   |
   | exec com yieldMs; acompanha por process.* e arquivos de run
   v
Role Runner (Node.js, temporário, um papel por execução)
   |-- carrega/valida solicitação autorizada
   |-- adquire exclusividade; registra estado e eventos
   |-- coordena prompts e, na revisão, gate fase 1 → fase 2
   |-- inicia, cancela, encerra e verifica o Pi por meio do Pi Driver
   v
Pi Driver (Node.js: subprocesso, JSONL stdin/stdout, correlação, timeout)
   |
   v
Pi Agent (processo RPC exclusivo daquele papel)
   |
   +--> código, relatórios e avaliações da task (evidências)

Separados:
- registro.md: status oficial (atualizado só pelo controlador autorizado)
- state/<task>.json: estado operacional e transição pendente
- runs/<runId>/: eventos e resultado da execução
```

**OpenClaw:** decide qual papel pode ser executado, avalia gates finais, comunica achados, pausa quando necessário e autoriza o atualizador oficial do registro. Não transfere ao Pi decisões de requisito, escopo, arquitetura ou autorização.

**Role Runner:** executa **um** papel até seu término, coordena as duas fases do revisor e verifica gates internos antes de liberar a fase seguinte. Não conclui oficialmente uma task nem altera `registro.md` por conta própria.

**Pi Driver:** controla `spawn`, transporte RPC JSONL, `stdin`/`stdout`, `stderr` diagnóstico, eventos, correlação, cancelamento, timeout, EOF e encerramento. Não julga qualidade técnica nem executa operações Git privilegiadas.

**Pi:** cria/modifica artefatos do papel e reporta seu entendimento. Pode produzir sinalização estruturada, mas sua declaração é **candidata**, não autoridade para transição.

**Validadores:** realizam checagens determinísticas de estado, arquivos, escopo verificável, Git, snapshots, limites, processos e evidências. **Não substituem a revisão técnica independente da IA.**

## 4. Inicialização e acompanhamento — [APROVADO no comportamento; VALIDAR no Windows]

### 4.1 Invocação do Role Runner

Interface inicial proposta e aceita em nível de contrato:

```powershell
node role-runner.mjs run --config "C:\orquestrador\runs\solicitacao.json"
```

Exemplo ilustrativo do arquivo de solicitação:

```json
{
  "taskId": "M01-T01",
  "role": "implementador",
  "attempt": 1,
  "workspace": "C:\\projetos\\mvp-teste",
  "modelProfile": "execution"
}
```

- O **controlador** prepara a solicitação; o Pi não escolhe livremente parâmetros, tarefas, caminhos ou comandos.
- A configuração é validada antes de iniciar o Pi: task aprovada, papel permitido pelo estado oficial, workspace/baseline conhecidos, dependências, Git, permissões, limites, lock e ausência de processo incerto.
- Perfis de modelo (execução mais econômico, revisão mais capaz) são **intenção de desenho**, não fornecedores/modelos definitivos nem economia já comprovada.
- Prompts extensos não são passados como argumentos arbitrários de shell. **[VALIDAR]** modo seguro de lançamento de `pi.cmd` no Windows; remover a combinação problemática de `spawn(..., shell:true)` com argumentos variáveis da prova (`DEP0190`).
- `runId` é criado pelo sistema e identifica uma execução; `taskId` é o identificador estável da task. Não confundir `runId`, `sessionId` Pi e identificador do `exec` OpenClaw.

### 4.2 Execução assíncrona

- OpenClaw inicia via `exec` com `yieldMs`, sem exigir que uma única chamada fique bloqueada até o final; acompanha via `process.poll`/`process.log` ou notificação de conclusão **quando disponíveis na instalação local**.
- Role Runner permanece ativo **somente enquanto executa o papel** e fecha após concluir o encerramento do Pi e registrar o resultado.
- Eventos resumidos são emitidos em `stdout` e persistidos em `runs/<runId>/events.jsonl`; resultado final vai a `runs/<runId>/result.json`, gravado de modo atômico.
- `stdout` do subprocesso **Pi** é reservado ao protocolo JSONL; separar `stderr` de diagnóstico. Lidar com linhas fragmentadas, correlação por `requestId`, limites de buffers e respostas RPC intercaladas com eventos.
- `prompt` aceito não é `prompt` concluído. Aguardar `agent_settled` e verificar erros/estado/evidências; `agent_end` isolado não basta. Registrar EOF inesperado, timeout e falha de parse como falhas, nunca como conclusão.
- **[VALIDAR]** confiabilidade de `exec`/`process` para papéis prolongados no Windows e comportamento após reinício do Gateway. Não presumir persistência durável.

### 4.3 Revisão dentro de um Runner

```text
spawn Pi revisor (sessão nova)
  → prompt RPC fase 1 (entradas filtradas)
  → agent_settled
  → gate automático: arquivo incompleta + avaliação + snapshot
  → prompt RPC fase 2 (mesmo Pi, mesmo sessionId)
  → agent_settled
  → gate de saída da revisão
  → encerrar e confirmar processo
  → entregar evidências para validação do OpenClaw
```

O segundo prompt **não exige interação humana**, porém nunca é enviado se a avaliação independente exigida não foi persistida. Na reauditoria, é criado outro Pi revisor e todo esse fluxo se repete.

## 5. Processos, cancelamento e exclusividade — [APROVADO]

### 5.1 Término normal

1. Aguardar conclusão efetiva do papel e registrar observações/eventos, sem confundir conclusão do prompt com aprovação.
2. Solicitar encerramento normal do Pi (ex.: fechar `stdin` após o trabalho terminar, conforme comportamento validado).
3. Esperar a saída do processo e confirmar sua identidade/encerramento, incluindo subprocessos relevantes.
4. Registrar status final e somente então permitir liberar a exclusividade.

### 5.2 Cancelamento e encerramento forçado

- Quando houver solicitação de cancelamento, **não iniciar nova fase**; pedir abort da execução Pi e tratar eventuais mensagens enfileiradas, conforme comandos disponíveis e testados na versão local. `abort` **não** significa que o processo terminou.
- Em seguida, solicitar encerramento normal e aguardar por prazo limitado.
- Se não terminar, identificar corretamente o processo/árvore e executar **`taskkill /T /F`** como fallback; conferir o resultado e verificar que o Pi e filhos relevantes terminaram. `taskkill` com sucesso textual não comprova sozinho ausência de sobreviventes.
- **[DETALHAR/VALIDAR]** prazos de abort, encerramento e escalonamento; modo concreto de solicitar cancelamento a um Runner assíncrono (p. ex. comando curto e solicitação de controle persistida). Não abrir porta, serviço residente ou IPC genérico apenas para isso.
- Processo incerto, identidade ambígua, PID possivelmente reutilizado ou subprocesso sobrevivente: bloquear novas sessões e reconciliar; **nunca `taskkill` em PID antigo sem verificar identidade**.

### 5.3 Proteção contra concorrência

**Defesas complementares:**

1. **OpenClaw** só despacha próximo papel após resultado apropriado, gates validados e encerramento anterior confirmado.
2. **Role Runner** adquire uma trava exclusiva global do escopo do orquestrador **antes de criar o Pi**; libera apenas após prova de encerramento. Aquisição deve ser realmente exclusiva, inclusive entre duas invocações simultâneas.
3. Registrar identidade da execução/processo para reconciliação. **Arquivo de lock sozinho ou PID isolado não basta**; lock aparentemente abandonado não pode ser apagado às cegas. Após falha, reconciliar processo anterior antes de aceitar novo `run`.

O contrato se refere aos processos iniciados e controlados pelo **MVP**, não a uma promessa de impedir que qualquer outro software do Windows abra Pi fora do orquestrador.

## 6. Três níveis de estado e resultados — [APROVADO]

**Nível 1 — Estado operacional do processo/execução:** `starting`, `running`, `stopping`, `terminated`, `uncertain`. `terminated` indica **encerramento confirmado**, não sucesso funcional.

**Nível 2 — Resultado do papel**, normalizado após conferência das evidências:

| Resultado | Significado | Encaminhamento possível |
|---|---|---|
| `completed` | Papel terminou e entregou evidências esperadas, validadas estruturalmente | Dependendo do papel: revisão, reauditoria ou aprovação técnica |
| `changes_required` | Revisão finalizada contém `bloqueador` ou `importante` | Correção nas R1–R3; pausa após R4 com três correções |
| `blocked` | Contradição, escopo, acesso ou decisão pendente | Pausa; decisão/reconciliação humana |
| `failed` | Falha técnica ou resultado não confiável | Política de recuperação conforme fase |
| `interrupted` | Cancelamento ou interrupção da execução | Encerrar/reconciliar; não assumir aprovação |

O Pi pode declarar um resultado, mas **o Runner e o OpenClaw devem comprovar condições objetivas**. Ausência de `result.json` após crash não equivale a `completed`, nem autoriza classificar a task como concluída. Um resultado normalizado não concede autorização para commits.

**Nível 3 — Estado oficial no `registro.md`:** `não iniciada`, `em andamento`, `aguardando revisão`, `em correção`, `pausada`, `concluída`, `substituída`. **Não introduzir esses estados no `state.json` como cópia da fonte oficial.**

Transições do primeiro MVP:

```text
não iniciada ──[entrada aprovada]──> em andamento
   em andamento ──[implementação validada]──> aguardando revisão
   aguardando revisão ──[revisão R1–R3 com obrigatório]──> em correção
   em correção ──[correção validada]──> aguardando revisão
   aguardando revisão ──[aprovação técnica]──> permanece aguardando revisão
   aguardando revisão ──[R4 com obrigatório após 3 correções]──> pausada
   qualquer estado não final pertinente ──[bloqueio justificado]──> pausada,
      conforme transições permitidas pelo atualizador
```

**`concluída` não é atingida neste MVP**, pois depende dos dois commits oficiais a implementar na Etapa C. Aprovação técnica fica em evidência/estado operacional, e o registro mantém `aguardando revisão` até a etapa Git. Não reabrir estados finais, redefinir IDs ou zerar contagens por falha.

## 7. Gates de papéis — [APROVADO]

### 7.1 Implementador

**Entrada:** task aprovada com `Fazer`, `Não alterar`, `Entregáveis`, `Critério de conclusão`; baseline versionado (plano, registro, mapa `AGENTS.md`/`CLAUDE.md`), dependências verificadas, Git e workspace coerentes, status `não iniciada` ou retomada explicitamente válida, ausência de outro Pi/incerteza.

**Saída:** execução concluída e Pi encerrado; `task-<ID>-relatorio.md` presente e estruturado (alterações, comandos/testes, entregáveis, critérios, pendências); evidências identificáveis; Git consistente; ausência de commits indevidos e violações de escopo **objetivamente detectáveis**. Se tudo passar, o controlador opera `em andamento → aguardando revisão`.

**Limite:** presença de relatórios não prova qualidade de código; revisor avalia tecnicamente e repete testes relevantes. Não criar uma segunda revisão de código automática como gate.

### 7.2 Revisor — entrada, fase 1, fase 2 e saída

**Entrada:** status `aguardando revisão`; relatório disponível, entrega identificável, rodada `R` válida (1 a 4), revisões anteriores sem lacunas/duplicidade, Git sem mudanças concorrentes não reconciliadas e nenhum Pi anterior ativo.

**Fase 1:** o Pi recebe task, fontes e entradas filtradas por `review_inputs.py`; não deve consultar Observações e narrativas anteriores. Executa o checklist técnico, reexecuta testes pertinentes e persiste `task-<ID>-revisao-<R>.md` com:

- `Estado: incompleta`, `Snapshot da entrega: ...` correspondente;
- seção `Avaliação independente` realmente preenchida: evidências, checklist, testes, achados classificados e conclusão preliminar;
- seções futuras ainda não preenchidas (`Confronto com relatos`, `Decisão final`).

**Gate intermediário, dentro do Runner:** antes do prompt 2, conferir arquivo e rodada, marcador, seções obrigatórias não vazias, snapshot coerente e persistência anterior à liberação. **Não exigir autorização humana.** Se houver exposição efetiva detectada de relatos durante fase 1, considerar a revisão contaminada e **pausar**; instruções e `pi-file-permissions` **não são isolamento forte**.

**Fase 2:** no **mesmo processo/sessão Pi**, liberar relato do implementador, correções e revisões anteriores. Registrar confronto e **decisão final** com todos os achados, suas classificações, evidências e encaminhamento; preservar intacta a avaliação independente; mudar para `Estado: finalizada` só depois de preencher a decisão.

**Saída:** validar estrutura, número da rodada, integridade, histórico, snapshot/alterações relevantes e encerramento do Pi. Os validadores não aprovam semanticamente a revisão: conferem que a análise e decisão técnica do revisor foram persistidas e são consistentes com os contratos.

**Achados:** `bloqueador`/`importante` impedem aprovação; `melhoria opcional` não impede. **Reportar todos**, sem interromper automaticamente correções autorizadas. Sem achados obrigatórios, registrar **aprovação técnica** sem chegar a `concluída`.

### 7.3 Corretor e reauditor

Reaproveitar **o mesmo Runner, Pi Driver e gates gerais**. Não criar serviço nem orquestrador exclusivo para esse papel.

**Corretor — diferenças específicas:**

1. Entrada requer status `em correção`, revisão anterior `Estado: finalizada` e rodada apta (R1–R3), com decisão final de achados obrigatórios.
2. Corrige **somente** `bloqueador`/`importante`, sem tratar opcionais como obrigação nem ampliar escopo.
3. Acrescenta `Correção após revisão R` ao **relatório existente**, preservando o texto anterior, com arquivos, achados e testes. Saída válida: `em correção → aguardando revisão`, sem commit.

**Reauditor:** é um **novo processo Pi revisor**, isolado do corretor, que executa integralmente as duas fases e gates do revisor. Máximo de **três correções completas e quatro revisões**. R4 com obrigatório após 3 correções → `pausada`, preservando evidências e encaminhando à `plan`. Falha técnica ou revisão `incompleta` não consome automaticamente uma rodada *finalizada*; divergências exigem reconciliação, não reset silencioso.

## 8. Persistência operacional e consistência — [APROVADO]

### 8.1 Fonte oficial versus informações operacionais

```text
orquestrador/                  # fora do repositório versionado da task
├── state/
│   └── M01-T01.json           # estado mínimo e transição pendente da task
└── runs/
    ├── run-001/
    │   ├── events.jsonl       # sequência observável de eventos resumidos
    │   └── result.json        # resultado estruturado deste papel
    └── run-002/
        ├── events.jsonl
        └── result.json

<local do projeto>/registro.md # status oficial, seis colunas preservadas
<local do projeto>/achados/    # relatórios e revisões; evidências de engenharia
```

O diretório `orquestrador/` é um **exemplo de organização**, não caminho obrigatório. Não guardar tokens, segredos ou históricos completos de `.pi`/`.openclaw` nesses arquivos.

Exemplo mínimo de `state/<task>.json`:

```json
{
  "schemaVersion": 1,
  "taskId": "M01-T01",
  "workspace": "C:\\projetos\\mvp-teste",
  "baselineCommit": "<hash-Git-verificado>",
  "activeRun": {
    "runId": "run-005",
    "role": "revisor",
    "processId": 4820,
    "lastKnownStatus": "terminated"
  },
  "implementationRestartUsed": false,
  "pendingTransition": null
}
```

`activeRun` é **última informação conhecida**, não prova de vida do processo; identidade adicional e registro de lock necessários na implementação. O estado operacional **não replica** as colunas do `registro.md`. Contagens de revisão/correção são reconstruídas de revisões finalizadas e seções de correção; a contagem de **reinício técnico** fica no estado operacional.

### 8.2 Protocolo de transição oficial recuperável

1. **Validar gate**: papel, evidências, processo encerrado, Git, estado oficial atual e inexistência de operação concorrente.
2. **Persistir intenção** de transição com `operationId`, `runId`, estado `from`, estado `to` e referência às evidências (no `state.json`).
3. **Executar atualização oficial** por adaptador validado de `update_registro.py`, exigindo **estado esperado** e exclusividade de gravação do registro.
4. **Reler** o `registro.md` e verificar status, observações, identidade da task e coerência com a intenção.
5. **Confirmar** removendo `pendingTransition` do estado operacional, com histórico rastreável em eventos da execução/operação.

Exemplo ilustrativo de intenção:

```json
{
  "pendingTransition": {
    "operationId": "transition-001",
    "from": "em andamento",
    "to": "aguardando revisão",
    "runId": "run-005",
    "evidence": "runs/run-005/result.json"
  }
}
```

Gravar estado e resultado por arquivo temporário + substituição atômica **no mesmo volume**, com tratamento explícito de erros. Proteger `registro.md` contra **atualizações concorrentes**: o lock global de Pi **não substitui** lock/CAS de registro. Não sobrescrever alterações do usuário.

**Falha antes de alterar o registro:** ao retomar, ler intenção, revalidar estado/evidências e aplicar somente se continuar válido.  
**Falha depois da alteração, antes da confirmação:** reconhecer que o estado desejado já foi alcançado, verificar integridade/observações e **não repetir** a atualização.  
**Estado ou evidência divergente:** bloquear e reconciliar; não escolher silenciosamente um lado.

### 8.3 Preservação de `Observações` e dos contadores

- Manter as **seis colunas atuais** do `registro.md` e seus estados existentes.
- `update_registro.py` atualmente **substitui** `Observações` com `--obs`; adaptar depois para **acréscimo controlado/idempotente**, sem duplicar mensagens nem apagar vínculos históricos. A operação existente `--integration` tem semântica própria; não antecipar integração Git.
- Proteger transições com `expectedStatus` ou equivalente e validação de exclusividade; um estado igual ao destino **não basta**, isoladamente, sem conferir identidade da intenção e evidências.
- Contar revisões a partir do histórico validado (arquivos `Estado: finalizada`) e correções a partir das seções correspondentes; não zerar contadores em falhas técnicas. Tentativas de processo e revisões finalizadas são coisas diferentes.

## 9. Falhas e recuperação — [APROVADO]

| Situação | Encaminhamento |
|---|---|
| Falha técnica na **implementação inicial**, antes de commits | Reconciliar processo/lock e Git. Se a tentativa for isolada e descartável **com prova**, preservar diagnóstico, reconstruir do baseline e permitir **uma** nova tentativa. |
| Segunda falha na implementação inicial | Pausar; sem terceira tentativa automática. |
| Falha durante **revisão ou correção** | Preservar evidências, pausar e reconciliar; **não reiniciar automaticamente** no MVP. |
| Cancelamento humano | Interromper, preservar e não tratar como falha técnica elegível a reinício automático. |
| Falha de comunicação, EOF, timeout ou crash | Não avançar sem resultado confiável; confirmar término do Pi/árvore antes de outra execução. |
| OpenClaw reinicia; estado anterior incerto | Conferir estado operacional, identidade/processos, Git e registro. Não iniciar outro Pi até reconciliação. |
| Alterações preexistentes, concorrentes ou de terceiros | **Nunca descartar**. Pausar quando não for possível separar ou preservar com segurança. |
| Commit, merge ou push já realizado ou descoberto | **Nunca rollback/restart cego.** Parar para reconciliação; operações Git estão fora deste MVP. |
| Fase 1 expôs efetivamente relatos excluídos | Revisão contaminada; interromper e pausar. |
| Quarta revisão finalizada com obrigatório após terceira correção | Pausar task e encaminhar à `plan`; não abrir correção 4. |

**Estratégia aprovada de reinício:** preservar/archive a tentativa antiga para diagnóstico e reconstruir **outro workspace descartável** do baseline aprovado (quando comprovadamente seguro), em vez de executar `git reset --hard` no workspace do usuário. O `registro.md` não volta artificialmente a `não iniciada`; a nova tentativa técnica é identificada no estado operacional sem apagar o histórico oficial.

**Limite aceito para o MVP:** proteção de arquivos na fase 1 por instruções, `review_inputs.py` e `pi-file-permissions` é mitigação contra exposição acidental, **não isolamento forte**. No experimento E14, o controlador RPC `bash` acessou arquivo classificado como proibido. Usar somente dados fictícios, sem segredos nem credenciais Git amplas, e não declarar segurança de produção.

## 10. Critérios de aceite e plano de testes — [APROVADO]

Cada teste deve gerar evidências verificáveis (logs operacionais reduzidos, resultado por run, arquivos, Git e registro); não basta o modelo dizer `PASS`.

| ID | Cenário | Evidência de aceite | Modalidade prioritária |
|---|---|---|---|
| T01 | Implementador → revisor → aprovação técnica | Dois processos/sessões Pi diferentes; revisão completa 1+2; relatórios; estado operacional aprovado; registro `aguardando revisão`; **nenhum commit** | **Real**, OpenClaw + Pi |
| T02 | Achado `importante` → corretor → reauditor | Revisão R1 finalizada; `em correção`; corretor novo Pi; relatório acrescentado; R2 por novo Pi; eventos e estados coerentes | **Real**, OpenClaw + Pi |
| T03 | Apenas `melhoria opcional` | Reporte do achado; aprovação técnica permitida; sem correção obrigatória | Simulação determinística (complementável por real) |
| T04 | Limite: 3 correções / 4 revisões | Pausa após R4 com obrigatório; nenhuma correção 4/R5; histórico íntegro | Determinístico |
| T05 | Gate fase 1 → fase 2 | Sem avaliação/snapshot válido, prompt 2 não enviado; com avaliação válida, prompt 2 na **mesma sessão** | Unitário + integração real focal |
| T06 | Gate de entrada/saída inválido | Relatório ausente, diff inconsistente ou escopo proibido detectável bloqueia transição | Determinístico |
| T07 | Cancelamento e encerramento | `abort`/encerramento normal e fallback `taskkill /T /F` quando necessário; árvore e identidade verificadas antes de liberar | **Real**, Windows descartável |
| T08 | Exclusividade | Chamada duplicada/concorrente não cria segundo Pi; lock incerto bloqueia | Determinístico + integração de processo |
| T09 | Falha técnica inicial + reinício | No máximo **uma** nova tentativa segura; segunda falha pausa | Determinístico + falha de processo focal |
| T10 | Recuperação insegura | Processo/PID incerto ou mudanças preexistentes preservados; não reinicia nem descarta | Determinístico + processo Windows focal |
| T11 | Falha entre intenção, registro e confirmação | Retomada idempotente, sem transição duplicada ou perda de `Observações`; divergências pausam | Determinístico |
| T12 | Exposição efetiva detectada na fase 1 | Interrupção e registro de contaminação; **não** afirmar isolamento forte | Teste sintético controlado |

**Escopo dos testes reais:** T01 e T02 obrigatoriamente com agentes reais; cancelamento e encerramento efetivo também em Windows real. Testes repetitivos/limites/falhas de persistência preferencialmente com *fixtures*, processos falsos e eventos simulados para reduzir custo. Repetir experimentos antigos só se surgir nova hipótese técnica, não refazer instalação ou prova RPC E09–E14 sem motivo.

**Critério global de aceite:** fluxo real completo e rastreável; nenhuma transição sem gates; nenhuma segunda sessão Pi enquanto primeira estiver incerta; relatório e avaliação persistidos; limites respeitados; observações preservadas; falha segura; tudo apenas em projeto descartável.

## 11. Sequência de implementação aprovada

1. **Slice 1 — Runner/driver:** invocação assíncrona, `runId`, JSONL/eventos, comunicação RPC, término normal, cancelamento, `taskkill /T /F`, lock e testes no Windows.
2. **Slice 2 — Fluxo mínimo:** uma implementação e uma revisão em duas fases, gates, resultados/estado operacional e aprovação técnica sem commits.
3. **Slice 3 — Correção e reauditoria:** ciclo de achado obrigatório, reaproveitando Runner/validadores, reportando achados e respeitando limites.
4. **Slice 4 — Persistência/falhas:** intenções idempotentes, atualização segura do registro, reinício técnico limitado, falhas simuladas e reconciliação.

Realizar testes ao concluir cada slice; **não** codificar um orquestrador genérico antes do ciclo simples funcionar. Antes de tocar nas skills atuais, auditar e adaptar minimamente os pontos incompatíveis, com testes que preservem o fluxo manual enquanto aplicável.

## 12. Diferenças verificadas na implementação atual das skills

O repositório real ainda **não implementa** essas decisões de automação. Em particular:

- `implement/SKILL.md` prevê invocações manuais em conversas separadas e impede avanço automático; no MVP os papéis serão processos Pi independentes despachados pelo OpenClaw. A regra de **independência** permanece; o disparo muda.
- `plan/SKILL.md` atual usa `plano.md` com tasks no mesmo arquivo; índice por marco + arquivos separados são **decisão conceitual posterior**. A primeira task de teste pode usar fixture do formato atual; não migrar `plan` agora.
- `review_inputs.py` já prepara metadados/diffs filtrados e `snapshot`, mas não confirma sozinho que a avaliação independente está completa nem oferece ACL para todas as ferramentas do Pi.
- `update_registro.py` aceita estados/transições, mas substitui Observações com `--obs` e não faz CAS/append idempotente. A adaptação mínima será necessária antes de automatizar transições confiáveis.
- `references/revisor.md` instrui o agente a fazer ambas as fases; o Runner passará a impor o gate e dividir os prompts **mantendo a mesma sessão**, sem enfraquecer a avaliação independente.
- As referências atuais orientam o agente a atualizar o registro; na automação, apenas o **controlador autorizado pelo OpenClaw** fará essa atualização, após validar gates. Isso exige ajuste explícito, não apenas um prompt contraditório.
- A skill atual exige autorização humana específica para os dois commits; a autorização conceitual de execução do marco e Git Gateway virá **depois**. **Nenhum commit no MVP desta fase.**

## 13. Pontos ainda a detalhar/testar (não são decisões reabertas)

1. **Windows/processo:** duração concreta de timeouts, método seguro de `spawn` do Pi instalado sem argumentos livres em shell, identificação de árvore/processos sobreviventes, aquisição/liberação de lock e tratamento de PID reutilizado.
2. **OpenClaw:** funcionamento efetivo de `exec` assíncrono + `process` sob Gateway Windows e após reinício; verificar limites e ajustar sem alterar a decisão sobre Role Runner por papel, salvo evidência de inviabilidade.
3. **Resultado/formatos:** esquema final do `result.json`, `events.jsonl`, identidade de run e política de retenção; formato do sinal estruturado de decisões/achados sem inventar que os Markdown atuais já são parseáveis de forma completa.
4. **Validadores:** campos mínimos exatos da avaliação independente e do resultado final; como detectar mudanças de arquivos e preservar o snapshot. Detector de exposição só para ocorrências **observáveis**, sem promessa de isolamento completo.
5. **Persistência:** implementação do lock de registro, `expectedStatus`, append idempotente nas Observações, arquivo temporário e recuperação de intenção pendente; testes de falha entre gravações.
6. **Recuperação técnica:** condições objetivas para classificar tentativa de implementação como descartável, arquivar evidências e criar novo workspace sem perda de alterações preexistentes.
7. **Modelos/recursos:** perfis reais, limites de custo/tempo e política de notificações detalhada (todos os achados devem ser reportados). Não assumir economia de modelos antes de medir.

**Situação após M01:** a infraestrutura do **Slice 1** foi implementada e revisada, com evidências e limites vinculados no registro oficial. O planejamento do M02 foi aprovado em 2026-11-19 e está no [plano ativo](../plano.md); sua execução depende da confirmação do baseline e dos gates da task, sem avanço automático. O aceite completo do MVP permanece pendente; este encerramento documental não autoriza alterações nas skills, Git Gateway ou repositório importante.
