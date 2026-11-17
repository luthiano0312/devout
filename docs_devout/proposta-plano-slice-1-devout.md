# Proposta de plano — devout / M01: infraestrutura do Slice 1 (OpenClaw + Pi Agent)

**Status:** PROPOSTA PARA APROVAÇÃO — não é `plano.md` oficial e não autoriza execução, mudanças no repositório nem commits.
**Data:** 2026-11-17.
**Repositório existente:** `luthiano0312/devout` (`main` verificada em 2026-11-17).
**Marco proposto:** `M01` — Slice 1, infraestrutura de execução do orquestrador.
**Local de execução:** o repositório `devout`, preservando os diretórios de protótipos como evidência histórica.
**Recorte:** disponibilizar uma cadeia verificável **OpenClaw → Role Runner temporário → Pi Driver → Pi Agent RPC**, operando no **Windows nativo**, com transporte JSONL, controle do ciclo de vida dos processos, exclusividade, cancelamento e evidências locais. O Slice 1 **não** implementa o ciclo de revisão/correção de uma task do usuário.

## Fontes e condições de partida

Fontes de verdade disponibilizadas para este planejamento:

- `contrato-orquestracao-mvp.md`, especialmente seções 2–5, 6, 9–11 e 13 — contrato aprovado, limites, critérios de teste e sequência dos slices.
- `01-registro-integracao-openclaw-pi-e-decisoes.md`, especialmente seções 3–7 — prova real do protocolo, problema de `stdin`/`shell:true`, eventos, cancelamento e risco de isolamento E14.
- `contexto-projeto-automacao-workflow-atualizado.md`, especialmente seções 7–9 e 11 — visão geral e limites do MVP.
- [`my-skills/.agents/skills/plan/SKILL.md`](https://github.com/luthiano0312/my-skills/blob/main/.agents/skills/plan/SKILL.md) — formato de quatro campos, IDs, dependências, gates de aprovação e preparação do baseline; versão lida na branch `main` em 2026-11-17.
- [`my-skills/.agents/skills/implement/SKILL.md`](https://github.com/luthiano0312/my-skills/blob/main/.agents/skills/implement/SKILL.md) — contrato atual de consumo de planos e revisão/commit; versão consultada em `main` em 2026-11-17.
- Documentação do Pi RPC: <https://docs.pi.dev/latest/rpc>. Verificar a documentação **da versão instalada** antes de usar uma operação. Não tomar a documentação `latest` como comprovação de comportamento local.

**Verificação do repositório:** `devout` foi localizado no GitHub com a branch `main` e protótipos indexados, entre eles `prova-integracao-openclaw-pi/probe-pi-rpc.mjs`, `prova-pi-eventos-rpc-v2/`, `teste-cancelamento-pi/` e registros de testes de persistência. A consulta direta a arquivos pela integração não permitiu confirmar o conteúdo atual desses caminhos nem a presença de `AGENTS.md`, `CLAUDE.md` e dos documentos de contrato. Portanto, o executor deve fazer **inventário no clone local** antes de escolher arquivos para reaproveitamento, confirmar o SHA de base e verificar arquivos não rastreados/alterações locais. O usuário informa que o repositório contém os documentos de contexto e protótipos; não assumir que os nomes/caminhos no Git coincidem exatamente com os anexos desta conversa.

A `plan` atual usa um único `plano.md`; a migração conceitual para arquivos individuais por task **não** será antecipada neste marco. O identificador `M01` deve ser confirmado como livre no checkout antes da aprovação.

**Organização proposta no repositório (sem modificar os protótipos existentes):**

```text
devout/
├── <documentos de contexto existentes>
├── <pastas de protótipos existentes>       # preservadas, somente consulta
├── orquestrador/                           # [proposta] código novo do MVP
│   ├── src/                                # Driver, Runner e exclusividade
│   └── test/                               # mocks/fixtures e testes locais
└── docs/03-execucao/                       # [proposta] se não houver convenção
    ├── plano.md                           # marco vigente, após aprovação
    ├── registro.md                        # registro oficial, após aprovação
    └── achados/                            # relatórios do workflow manual
```

Os nomes de módulos e subpastas internas são sugestões de organização, não exigência de arquitetura. Adaptar às convenções efetivamente encontradas. O `orquestrador/` deve ser código executável; os protótipos históricos devem continuar identificáveis e não devem ser sobrescritos para fazê-los “virar” produção.

**Pré-condições externas antes da Task M01-T01:**

1. Trabalhar no clone do **repositório `devout` existente**, com branch/base confirmada e alterações locais preservadas. Usar workspace **fictício/descartável** para qualquer Pi que execute comandos ou escreva arquivos; repositório de desenvolvimento e workspace alvo de testes não são a mesma coisa. Não executar Pi experimental com segredos ou credenciais Git amplas disponíveis.
2. Inventariar os protótipos já versionados e confrontá-los com o registro de integração: identificar quais casos E09–E14 possuem scripts reutilizáveis, quais estão apenas documentados e quais contêm código problemático (`shell:true`, citações de paths locais, serviços HTTP sem autenticação). Reutilizar o que for verificável; não considerar um `PASS` histórico como teste atual do novo Driver.
3. Verificar o ambiente Windows real (`node`, `npm.cmd`, `openclaw.cmd`, `pi.cmd`) e a configuração RPC. Os caminhos absolutos `C:\temp\pi-rpc-prova\` dos experimentos são históricos; não presumir que existam no host escolhido. Não reexecutar a prova completa de integração sem uma hipótese nova.
4. Conferir `AGENTS.md`/`CLAUDE.md`, documentação e convenções **no clone do `devout`**. Se não houver mapa de caminhos, propor `docs/03-execucao/plano.md`, `docs/03-execucao/registro.md`, `docs/03-execucao/achados/` segundo a skill. Verificar que `contrato-orquestracao-mvp.md` e os registros anexados estão versionados no repositório **antes de citá-los como fonte local**; caso faltem, preparar inclusão preservando arquivos existentes.
5. Após **aprovação humana deste conteúdo**, salvar o plano oficial, criar/reconciliar o registro de seis colunas e atualizar o mapa de caminhos realmente usado. Fazer **commit de baseline explicitamente autorizado** do plano, registro, mapa e fontes aprovadas que precisarem ser adicionadas. Sem o baseline confirmado no Git, não declarar M01-T01 apta. Não versionar segredos, logs brutos, dados de inferência ou pastas completas `.pi`/`.openclaw`.

O uso da skill `implement` atual para construir este **projeto de orquestrador** continua sujeito às suas aprovações e papéis manuais. Isso **não** autoriza o orquestrador experimental a fazer commits automáticos em repositórios-alvo. O contrato do MVP proíbe os *commits oficiais automatizados de tasks* nesta fase; não proíbe versionar o **código do próprio projeto** pelo processo humano já aprovado.

## Ordem sugerida e dependências obrigatórias

A ordem das tasks abaixo é a sequência recomendada. As dependências são consumos concretos de artefatos, não mera preferência de cronologia.

| Task | Depende obrigatoriamente de | Justificativa |
|---|---|---|
| M01-T01 | — | Introduz o transporte RPC reutilizável. |
| M01-T02 | M01-T01 | Gerencia cancelamento e término dos processos abertos pelo Driver. |
| M01-T03 | M01-T02 | O lock só pode ser liberado após confirmação de encerramento e identidade dos processos. |
| M01-T04 | M01-T01, M01-T03 | O Role Runner consome RPC e adquire exclusividade antes de abrir Pi. |
| M01-T05 | M01-T02, M01-T04 | Cancela uma execução assíncrona real do Runner e confirma encerramento. |
| M01-T06 | M01-T04, M01-T05 | Integra a interface assíncrona existente, incluindo acompanhamento e cancelamento. |

**Bloqueios externos possíveis:** Pi/OpenClaw ausentes no host, `exec`/`process` indisponíveis na versão instalada, acesso ao provedor para um prompt real, workspace não descartável ou impossibilidade de provar a identidade da árvore de processos. Registrar o bloqueio e interromper a task afetada; não contornar alterando arquitetura, políticas de Windows ou credenciais sem autorização.

## Tasks

### M01-T01 — Pi Driver: transporte e observação RPC

**Fazer**

- Criar o módulo Node.js que inicia `pi.cmd --mode rpc` no Windows com `stdin`/`stdout` persistentes, sem concatenar argumentos variáveis de shell. Verificar o método de lançamento de `.cmd` no Windows; tratar o aviso `DEP0190` observado na prova como condição a corrigir, não como solução aceita.
- Implementar transporte **JSONL** (uma mensagem por linha) com recepção incremental, correlação por `id`/`requestId`, distinção entre resposta a comando e evento espontâneo e separação de `stderr` diagnóstico. Suportar ao menos `get_state` e `prompt` como operações do driver.
- Tratar linhas fragmentadas, múltiplas mensagens no mesmo bloco, eventos intercalados, tamanho de buffer limitado, resposta RPC de erro, JSON inválido, EOF antecipado e timeout de comando.
- Expor eventos e indicação de fim de execução; **não** tratar `prompt` aceito, `agent_end` ou `exitCode=0` como execução finalizada. Aguardar e registrar `agent_settled`; o julgamento de entrega de uma task ficará para outro slice.
- Criar teste automatizado com processo RPC falso e *smoke test* em Pi real. Usar comandos/entrada de teste inofensivos.

**Não alterar**

- Não criar serviço HTTP, daemon Node permanente, Named Pipe nem framework genérico de agentes. `[Fonte: contrato-orquestracao-mvp.md#Seções 2–4]`
- Não implementar lógica de papéis, ciclo de revisão, `registro.md`, Git Gateway ou commits automáticos. `[Fonte: contrato-orquestracao-mvp.md#Seções 1, 3 e 11]`
- Não executar comandos de shell com argumentos arbitrários controlados por modelo nem guardar logs brutos que possam conter credenciais. `[Fonte: 01-registro-integracao-openclaw-pi-e-decisoes.md#Seções 4 e 8]`

**Entregáveis**

- Módulo reutilizável Pi Driver, com interface mínima documentada para iniciar, enviar comandos, observar eventos e ler resultado/erro RPC.
- Testes automatizados do parser/transporte e roteiro reproduzível do teste com Pi real, com evidências sanitizadas.

**Critério de conclusão**

- No Windows, uma execução real retorna `get_state` correlacionado e um `prompt` simples chega a `agent_settled` com evidência observável, sem fechamento prematuro do `stdin`; um processo falso demonstra corretamente resposta intercalada, JSON fragmentado, erro/EOF/timeout e ausência de falso sucesso. Um processo iniciado no teste não pode ficar abandonado sem diagnóstico; encerramento robusto será completado na T02. Os experimentos existentes no `devout` devem ser consultados, sem necessidade de copiá-los ou editá-los.

### M01-T02 — Pi Driver: término, cancelamento e timeout de processo

**Fazer**

- Acrescentar ao Driver ciclo de vida explícito do processo (início, execução, encerramento solicitado, encerramento comprovado, estado incerto), com saída normal somente após fim do trabalho e verificação de término do Pi e subprocessos relevantes.
- Implementar `abort` da atividade em andamento, prazo limitado para término normal, escalonamento de timeout e *fallback* `taskkill /T /F` **somente após identificar seguramente o processo/árvore alvo**.
- Definir prazos iniciais configuráveis e documentados (detalhe de implementação a validar), sem pressupor que `abort success`, `SIGTERM`, `taskkill` ou saída `0` impliquem término funcional ou ausência de processo remanescente.
- Registrar identidade suficiente para evitar agir sobre PID reutilizado ou processo alheio; se a identidade ou término permanecer ambíguo, reportar `uncertain` e impedir liberação para nova execução.
- Cobrir término normal, cancelamento, processo travado, falha/EOF e fallback, com processos falsos e testes reais controlados no Windows.

**Não alterar**

- Nunca matar processo usando somente PID antigo ou executar `taskkill` contra alvo não verificado. `[Fonte: contrato-orquestracao-mvp.md#Seção 5.2]`
- Não implementar reinício automático de task, recuperação de Git ou avanço do workflow por `exitCode=0`. `[Fonte: contrato-orquestracao-mvp.md#Seções 6 e 9]`

**Entregáveis**

- Interface de encerramento/cancelamento do Driver e diagnóstico de término ou incerteza, reutilizável pelo Runner.
- Testes de término normal, `abort`, timeout e `taskkill` em ambiente descartável, com evidências de inspeção de processos.

**Critério de conclusão**

- Teste real em Windows demonstra `abort` seguido de encerramento verificado; um processo descartável deliberadamente resistente aciona fallback seguro e tem sua árvore relevante confirmada como terminada. Processo/identidade ambíguos bloqueiam avanço, e chamadas repetidas de encerramento não atingem processos alheios. Cobertura parcial do cenário **T07** do contrato, sem afirmar que o controle assíncrono do Runner já está pronto.

### M01-T03 — Exclusividade de Pi e recuperação conservadora de lock

**Fazer**

- Construir trava global mínima entre invocações independentes de Role Runner, com aquisição **atomicamente exclusiva** antes de lançar um Pi, registro de proprietário e identidade da execução/processo, e liberação somente após encerramento verificado.
- Impedir que duas invocações simultâneas iniciem dois Pi, inclusive ao disputar a aquisição inicial. Tratar lock pré-existente, proprietário morto, PID reutilizado e estado de processo incerto sem apagar silenciosamente locks abandonados.
- Fornecer verificação/reconciliação explícita para bloqueios; não transformar a reconciliação em retomada/reinício automático de tasks.
- Testar concorrência com múltiplos processos Node reais (Pi falso pode ser usado), além de falha que deixa lock e execução anterior incertos.

**Não alterar**

- Não iniciar dois Pi do workflow simultaneamente, mesmo se as sessões forem independentes. `[Fonte: 01-registro-integracao-openclaw-pi-e-decisoes.md#Seção 2]`
- Não tomar arquivo de lock ou PID isolado como prova suficiente de processo vivo/morto e não remover lock incerto às cegas. `[Fonte: contrato-orquestracao-mvp.md#Seção 5.3]`

**Entregáveis**

- Módulo de aquisição/liberação exclusiva com metadados de propriedade e procedimento documentado para reconciliação.
- Testes concorrentes e testes de lock incerto/abandonado.

**Critério de conclusão**

- Duas tentativas concorrentes produzem **no máximo uma** aquisição autorizada e nenhum segundo Pi; encerrar o processo anterior, com confirmação, permite a próxima. Lock incerto impede nova sessão até reconciliação comprovada. Cobertura do cenário **T08** do contrato.

### M01-T04 — Role Runner temporário e persistência por execução

**Fazer**

- Implementar a interface de execução temporária `node role-runner.mjs run --config "<caminho-local>"`, tomando o exemplo do contrato como **ilustrativo**, não como esquema final. Validar sintaxe e campos permitidos da solicitação, workspace descartável, papel de teste autorizado, perfil de modelo e parâmetros que controlam o Driver; caminhos e prompts são entradas locais controladas, nunca fragmentos de comando de shell.
- Gerar `runId` único, distinto de `taskId`, `sessionId` Pi e ID do processo `exec`. Adquirir o lock antes de abrir o Pi, emitir eventos resumidos para acompanhamento e persistir `runs/<runId>/events.jsonl` e `runs/<runId>/result.json` por gravação segura/atômica quando aplicável.
- Persistir estado mínimo do **processo/execução** (`starting`, `running`, `stopping`, `terminated`, `uncertain`) e resultado técnico observável, separando fim de transporte de aprovação de entrega. Registrar erros, timeouts, cancelamentos e evidências; não produzir um resultado `completed` de **task** sem os gates que existirão apenas no Slice 2.
- Encerrar o Runner ao final de seu papel de teste; liberar lock somente após confirmar término do Pi. Testar chamada direta com Pi falso e com Pi real.

**Não alterar**

- Não criar supervisor residente, API HTTP permanente, Named Pipe, execução paralela ou serviço operacional. `[Fonte: contrato-orquestracao-mvp.md#Seções 2 e 3]`
- Não atualizar oficialmente `registro.md`, aprovar task, abrir outra sessão por conta própria nem tratar evidência do Pi como autorização. `[Fonte: contrato-orquestracao-mvp.md#Seções 3 e 6]`
- Não guardar segredos ou históricos completos `.pi`/`.openclaw` nas evidências. `[Fonte: contrato-orquestracao-mvp.md#Seção 8.1]`

**Entregáveis**

- Executável CLI Role Runner, interface/documentação do arquivo de solicitação e dos resultados, diretórios de execução e integração com Driver/lock.
- Testes de validação de solicitação, resultado atômico, logs sanitizados, erro de Pi e execução real inofensiva.

**Critério de conclusão**

- Uma chamada CLI real cria um `runId`, executa um Pi, escreve eventos e resultado verificáveis, confirma término de ambos os processos e libera exclusividade. Uma solicitação inválida ou um crash/EOF não produz sucesso e não altera `registro.md`. O Runner deixa de existir ao fim da invocação.

### M01-T05 — Solicitação de cancelamento de Role Runner assíncrono

**Fazer**

- Permitir que o controlador peça o cancelamento de um Runner **enquanto sua execução estiver em curso**, sem serviço residente ou porta de rede. Escolher e documentar um mecanismo local mínimo compatível com o contrato (por exemplo, sinalização controlada em arquivo operacional), verificando identidade do `runId` e evitando alterações concorrentes.
- Ao receber cancelamento, impedir novas fases/prompts, acionar `abort` do Driver, concluir o escalonamento de término e persistir resultado de `interrupted`/falha técnica sem confundi-lo com conclusão da task.
- Fazer a solicitação repetida ser segura, não matar execução errada e deixar estado incerto bloqueante. Testar cancelamento durante uma resposta em curso e imediatamente antes do encerramento, inclusive em Pi real quando viável.

**Não alterar**

- Não criar serviço residente, HTTP local, IPC genérico ou segundo processo Pi para executar o cancelamento. `[Fonte: contrato-orquestracao-mvp.md#Seções 2 e 5.2]`
- Não prosseguir ou liberar lock enquanto processo antigo ou seu encerramento permanecer incerto. `[Fonte: contrato-orquestracao-mvp.md#Seções 5.2–5.3]`

**Entregáveis**

- Interface controlada para pedir cancelamento de `runId` ativo e tratamento no Runner, com eventos/resultado.
- Testes de cancelamento efetivo, repetição, corrida e identificação correta do alvo.

**Critério de conclusão**

- Um Runner ativo recebe cancelamento de outra invocação de controle, encerra o Pi identificado e registra interrupção sem falso `completed`; uma solicitação tardia/repetida não encerra processo alheio, e execução incerta bloqueia novos lançamentos. Complementa o cenário **T07**.

### M01-T06 — Disparo e acompanhamento por OpenClaw no Windows

**Fazer**

- Criar e validar procedimento mínimo para OpenClaw invocar **o Role Runner** via `exec` assíncrono com `yieldMs`, acompanhar a execução por `process.poll`/`process.log` ou mecanismos **efetivamente existentes na versão local**, e conferir arquivos de `runId`/resultado antes de declarar que a execução técnica terminou.
- Demonstrar no host de teste a cadeia real OpenClaw → Runner → Driver → Pi com prompt inofensivo, rastreando início, eventos, `agent_settled`, término e persistência. Demonstrar também solicitação de cancelamento e duplicidade de disparo sem criar outro Pi.
- Registrar comandos/configuração mínimos para repetir o teste, limitações de execução prolongada e o comportamento observado após erro/reinício do OpenClaw Gateway **quando testável sem risco**. Se o Gateway reiniciar e deixar estado incerto, não presumir retomada durável.

**Não alterar**

- Não transformar a demonstração em orquestração de revisão/correção, persistência oficial de task, Git Gateway, integração remota, checkpoints, execução de marco ou produção. `[Fonte: contrato-orquestracao-mvp.md#Seções 1 e 11]`
- Não tratar retorno de `exec`, `prompt accepted`, `exitCode=0` ou mensagem do Pi como comprovação de aprovação de task. `[Fonte: contrato-orquestracao-mvp.md#Seções 2, 4 e 6]`
- Não expor portas de teste, credenciais ou dados reais. `[Fonte: 01-registro-integracao-openclaw-pi-e-decisoes.md#Seções 4 e 6]`

**Entregáveis**

- Procedimento/script de disparo e acompanhamento com OpenClaw na instalação real, documentação dos comandos, entradas, evidências e limitações.
- Evidências sanitizadas da cadeia real, da exclusividade, do cancelamento e de falhas tratadas sem falso sucesso.

**Critério de conclusão**

- Uma invocação iniciada pelo OpenClaw executa e acompanha o Runner real até o resultado persistido, com mesmo `runId` rastreável e `agent_settled` observado quando aplicável. Repetir o disparo enquanto há um Pi ativo **não** gera segundo Pi. Cancelamento não deixa sessão seguinte começar antes de encerrar/verificar a anterior. A integração atende ao Slice 1 **sem** implementar os testes completos T01/T02 de workflow de papéis, que pertencem aos slices seguintes.

## Resultado esperado ao final do marco

A partir dos entregáveis e dos critérios acima, o Slice 1 terá: um Pi Driver RPC confiável em testes controlados; ciclo de vida Windows com cancelamento e encerramento verificáveis; exclusividade global conservadora; um Role Runner temporário com solicitação validada e evidências por `runId`; e um fluxo real de disparo e acompanhamento por OpenClaw. **Nenhuma task de negócio será considerada aprovada, nenhum registro oficial será atualizado pelo MVP e nenhum commit remoto de task será automatizado.**

## O que não está incluído / passagem para o próximo slice

A implementação de **implementador → revisor em duas fases**, gates de documentos e `registro.md`, aprovação técnica, corretor/reauditor, reinício técnico de task a partir do baseline, Git Gateway e automação de marcos fica fora do Slice 1. O próximo Slice 2 consumirá o Runner/Driver estáveis para o fluxo de implementação e revisão. Os casos T01/T02 do contrato exigem papéis reais e não são critérios de aceite **deste** marco; o T07/T08 de processo/exclusividade já será parcialmente ou totalmente exercitado conforme indicado nas tasks.

## Validação necessária antes de virar plano oficial

- Confirmar no clone de `devout` que `M01` e `M01-T01`…`M01-T06` estão livres e conferir SHA de base, estado do working tree e caminhos reais de todos os documentos. Não sobrescrever nada existente.
- Inventariar os protótipos que servirão de referência; explicitar quando algo existir só em documentos históricos e não em scripts versionados.
- Resolver a raiz de documentação e o mapa `AGENTS.md`/`CLAUDE.md` no repositório. Se fontes do contrato ainda existirem apenas nos anexos do projeto ChatGPT, versioná-las somente com autorização.
- Aprovar a proposta de organização (`orquestrador/`, `docs/03-execucao/`) ou adaptá-la ao layout já existente.
- Aprovar o conteúdo das tasks, dependências e limites. **Somente então** criar `plano.md` oficial e `registro.md` com as seis colunas, conforme a skill `plan`, e solicitar o commit de baseline.
- Não afirmar que testes foram executados ou que o marco foi implementado; este arquivo é apenas proposta de especificação.

**Nota sobre commits:** o Slice 1 não deve implementar **commits automatizados pelo orquestrador** em repositórios alvo. Isso não proíbe commits normais do código do próprio `devout` mediante o workflow manual e as autorizações aplicáveis.
