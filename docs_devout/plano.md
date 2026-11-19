# Plano de implementação — Devout / M02: Slice 2, implementação e revisão

**Status:** APROVADO em 2026-11-19 — execução condicionada ao commit de baseline do plano, registro, mapa e seleção de fontes da primeira task; não autoriza commits automáticos.
**Elaboração e aprovação:** 2026-11-19.  
**Repositório:** `luthiano0312/devout`.  
**Marco:** `M02` — Slice 2 do contrato de orquestração MVP v1.0.  
**Plano oficial do marco:** `docs_devout/plano.md`.  
**Registro oficial existente:** `docs_devout/03-execucao/registro.md`.  
**Marco anterior:** `docs_devout/03-execucao/planos/marco-M01.md` — encerrado; M01-T01 a M01-T06 estão `concluída` no registro.

## Recorte e fontes

**Resultado pretendido:** o OpenClaw despacha sequencialmente dois Role Runners temporários, cada qual com uma sessão/processo Pi distinta, para implementar uma **task fictícia e aprovada**, validar a entrega, executar revisão técnica independente em **duas fases dentro do mesmo processo Pi revisor**, validar os arquivos da revisão e produzir um **parecer técnico positivo** ou bloqueio, sem confundi-lo com o gate oficial do fluxo completo. Nenhuma operação do **orquestrador em teste** conclui oficialmente a task fictícia, faz commit de seu código ou atualiza automaticamente seu registro. **Isso não proíbe os commits manuais das tasks de desenvolvimento do próprio Devout**, autorizados conforme a skill `implement` após as revisões.

**Fontes normativas curadas:**

- `AGENTS.md` — mapa real, limites de escopo e comandos.
- `docs_devout/01-requisitos/escopo.md` — visão e limites do MVP.
- `docs_devout/02-design/contrato-orquestracao-mvp.md` — **contrato v1.0**, especialmente seções 1–4, 6, 7, 10 e 11.
- `docs_devout/02-design/arquitetura-hld.md` e `docs_devout/02-design/adr/*.md` (ativos) — fronteiras e decisões existentes.
- `src/ROLE-RUNNER.md`, `src/README.md`, `src/OPENCLAW.md` — interfaces e limitações efetivamente implementadas no Slice 1.
- `.agents/skills/implement/SKILL.md`, `.agents/skills/implement/references/implementador.md`, `.agents/skills/implement/references/revisor.md`, `.agents/skills/implement/references/entradas-independentes.md` e `.agents/skills/implement/scripts/review_inputs.py` — contratos reais da execução manual, preparação das entradas e revisão independente.
- `docs_devout/03-execucao/registro.md` e `docs_devout/03-execucao/planos/marco-M01.md` — progresso e histórico.

O plano de M01 está arquivado e este plano M02 ocupa `docs_devout/plano.md` após a preparação do baseline. A execução continua bloqueada até confirmação do commit de baseline.

**Fronteira entre M02 e Slice 4:** o contrato exige `aguardando revisão` no registro oficial para o gate **definitivo** de entrada do revisor, mas atribui a atualização recuperável desse registro ao Slice 4. Logo, a demonstração do M02 será um **ensaio técnico controlado de handoff**, baseado na entrega validada e nas entradas filtradas da fixture; ela **não pode alegar que o gate oficial de estado foi satisfeito**, nem substituir o status por uma cópia operacional. O gate definitivo e o **aceite integral de T01** ficam pendentes do Slice 4. Se qualquer implementação precisar burlar a regra oficial ou escrever no registro para prosseguir, deve parar e pedir reconciliação do recorte, não ocultar a divergência.

**Condições de entrada externas:** Windows nativo com Node, Python, OpenClaw e Pi operacional; provedores previamente configurados; projetos/arquivos inteiramente fictícios em área descartável; Git local funcional. Nenhum teste pode exigir segredos, credenciais GitHub remotas, acesso à produção, alterações de configuração global do OpenClaw ou ambientes compartilhados. Os testes que dependem de Gateway/Pi reais serão opt-in e documentarão os requisitos locais, sem assumir sucesso antes de executá-los.

## Ordem recomendada e dependências obrigatórias

A ordenação é uma sugestão de execução **sequencial**, não autorização de paralelismo. As dependências abaixo são apenas as que resultam do consumo real de artefatos.

| Task | Dependências obrigatórias | Justificativa |
|---|---|---|
| M02-T01 | — | Habilita ferramentas e repositório fictício dentro do ambiente controlado de testes. |
| M02-T02 | — | Validação de task e baseline pode ser testada com fixtures, independentemente do perfil Pi; é executada depois por conveniência. |
| M02-T03 | M02-T01, M02-T02 | Implementador usa ambiente habilitado e entrada previamente validada. |
| M02-T04 | M02-T01, M02-T02, M02-T03 | Revisor usa perfil executável, seleção de fontes e entrega/relatório da implementação. |
| M02-T05 | M02-T04 | A fase 2 só pode existir após fase 1 persistida e gate válido, no mesmo Pi. |
| M02-T06 | M02-T03, M02-T05 | Gate de coordenação consome resultados e provas dos dois papéis. |
| M02-T07 | M02-T06 | Demonstração real no Gateway depende dos validadores e protocolo de coordenação. |

## Tasks

### M02-T01 — Perfil de Pi para programação em repositório fictício

#### Fazer

- Adaptar a inicialização e validação do Pi Driver/Role Runner para um **perfil explícito e fechado de engenharia**, separado do perfil de teste `configured-isolated` do M01, que hoje desabilita ferramentas. Habilitar apenas as ferramentas de edição/inspeção/teste necessárias, mantendo `--no-session` e sem habilitar automaticamente MCPs, skills, extensões, arquivos de contexto externos ou mecanismos de comando arbitrário no launcher.
- Permitir um **repositório Git local preparado e marcado como descartável**, preservando os controles de caminho, identidade, `artifactsRoot`, lease global e lançamento seguro. Verificar baseline, ausência de remotes/credenciais e política de testes antes de entregar o ambiente ao Pi. A ausência de isolamento forte no Windows continua sendo um risco aceito apenas para dados fictícios.
- Exercitar um Pi real criando uma alteração pequena e executando uma verificação inofensiva dentro desse repositório de teste. Conservar o perfil de teste do M01 e sua compatibilidade.

#### Não alterar

- Não converter o Runner em serviço residente, permitir comandos livres no launcher ou ampliar acesso para repositórios reais/privados. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 2–5 e 9]`
- Não conceder acesso remoto Git, executar commits/push ou tratar diretório marcado como sandbox de segurança. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 1 e 9]`

#### Entregáveis

- Perfil de engenharia controlado, com validação do workspace Git fictício e documentação da superfície de ferramentas/limites.
- Testes de aceitação/rejeição do perfil e smoke real de edição/teste no Windows, sem regressão do perfil M01.

#### Critério de conclusão

- Um Pi real opera sobre o repositório fictício e produz alteração verificável; perfis ou caminhos não autorizados são recusados **antes** de lançar Pi; o ambiente M01 continua funcional; o Pi termina e a exclusividade é liberada com prova. A ausência de garantia contra acesso indireto do Windows é documentada, não omitida.

### M02-T02 — Pré-validação de task aprovada e baseline Git

#### Fazer

- Criar validador determinístico de **entrada de task** para uma fixture descartável no formato vigente: localizar `AGENTS.md`/mapa, `plano.md` e registro de seis colunas; selecionar **apenas uma task** com os quatro campos exigidos; conferir ID, estado inicial permitido, dependências, branch e baseline versionado.
- Validar integridade do workspace Git, área permitida para mudanças, ausência de commits indevidos/remotes, alterações concorrentes e correspondência entre task, snapshot inicial e solicitação. Separar informações públicas/necessárias ao Pi de credenciais, Observações e históricos não autorizados.
- Fornecer um resultado de pré-validação consumível pelo controlador, com motivo estruturado de recusa, sem gravar estado oficial ou criar processos Pi em caso inválido.

#### Não alterar

- Não presumir que `taskId`, texto do prompt ou declaração do modelo equivalem a aprovação de task. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 4.1 e 7.1]`
- Não migrar `plan` para um arquivo por task nem alterar `registro.md` da fixture por este validador. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 11 e 12]`

#### Entregáveis

- Validador de entrada da task/fixture Git e contrato documentado de resultado estruturado.
- Testes com task válida e inválida, dependência pendente, baseline ou branch divergente, Git alterado, caminho externo e ausência de artefatos obrigatórios.

#### Critério de conclusão

- Uma fixture aprovada gera entrada identificável e verificável para execução; casos inválidos bloqueiam antes de iniciar Pi e não mudam registro, branch nem arquivos do usuário. O gate distingue status oficial da task e resultado técnico do processo.

### M02-T03 — Role Runner implementador e validação de entrega

#### Fazer

- Adicionar papel **implementador** ao Role Runner existente, mediante solicitação validada e perfil de engenharia da M02-T01; construir entrada de contexto somente da task selecionada e das referências necessárias, sem enviar o plano inteiro indiscriminadamente.
- Executar um processo Pi para modificar/testar o projeto fictício e persistir `task-<ID>-relatorio.md` estruturado segundo as referências atuais da `implement`, **sem instruir o Pi a atualizar o registro ou fazer commits**. Resolver explicitamente essa diferença em relação à skill manual, sem mudar o comportamento das invocações manuais existentes.
- Validar de forma determinística: processo terminado e lease liberada, relatório e seções presentes, código/artefatos identificados, comandos/testes registrados, baseline e diff Git coerentes, ausência de commit ou violação objetivamente detectável de `Não alterar`. Normalizar resultado do **papel**, não conclusão oficial da task. Registrar bloqueios e inconsistências sem declarar sucesso.

#### Não alterar

- Não permitir que o Pi modifique estados oficiais ou autorize commits e nem considerar relatório ou `agent_settled` isoladamente prova de aprovação. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 3, 6 e 7.1]`
- Não executar revisão técnica pelo próprio implementador nem antecipar correção/reauditoria. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 7 e 11]`

#### Entregáveis

- Execução do papel implementador reaproveitando o Runner/Driver do M01; relatório, resultado técnico e gate de saída.
- Testes com processo falso e um teste real de implementação de task pequena; cenários de relatório ausente, diff incoerente e alteração proibida verificável.

#### Critério de conclusão

- Pi implementador real altera/testa uma fixture e gera relatório revisável; falhas ou violações objetivas bloqueiam o handoff; não há commit nem alteração automática do registro; Pi termina e libera a lease antes de outro papel.

### M02-T04 — Revisor independente: preparação e gate da fase 1

#### Fazer

- Criar o despacho **revisor** em uma **nova sessão/processo Pi**, distinto do implementador, carregando apenas task, metadados, código e entradas filtradas preparadas por `review_inputs.py` com seleção de fontes válida na fixture. O despacho deve identificar que se trata de um **ensaio técnico sem transição oficial prévia**; não marcar como validado o gate de status `aguardando revisão`, que permanece pendente do Slice 4.
- Executar o primeiro prompt de revisão e persistir `task-<ID>-revisao-1.md` com `Estado: incompleta`, `Snapshot da entrega`, identidade da entrada, `Avaliação independente` preenchida, `Confronto com relatos` e `Decisão final` ainda pendentes.
- Implementar gate **antes do segundo prompt** que valide arquivo, rodada, snapshot, integridade e conteúdo estrutural da avaliação independente; impedir avanço quando faltar requisito, houver mudança da entrega ou exposição antecipada **observável**. Testar sem depender de julgamento automático da qualidade técnica dos achados.

#### Não alterar

- Não oferecer relatos/Observações da implementação como entrada inicial nem simular isolamento forte por extensão/permissão Windows. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 7.2 e 9]`
- Não enviar prompt 2 antes de o gate reconhecer avaliação persistida; não criar novo Pi para fazer a fase 2. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 4.3 e 7.2]`

#### Entregáveis

- Preparador de entrada inicial do revisor, execução da fase 1 e verificador estrutural/snapshot do artefato incompleto.
- Testes de bloqueio por avaliação ausente, campos vazios, snapshot divergente, seleção de fonte inválida e exposição antecipada observável.

#### Critério de conclusão

- A revisão inicial real gera avaliação persistida e passa pelo gate quando válida; tentativas sem avaliação válida **não disparam prompt 2**. Entrada inicial não contém narrativas adiadas, conforme seleção; possível leitura indireta não detectada permanece risco explícito.

### M02-T05 — Revisor: confronto na mesma sessão e decisão técnica

#### Fazer

- Após o gate da M02-T04, enviar o **segundo prompt RPC ao mesmo processo/sessão Pi** da fase 1, liberando relato, revisões anteriores pertinentes e trechos/arquivos adiados; exigir confronto efetivo, testes pertinentes e decisão final documentada.
- Validar `Estado: finalizada`, preservação da avaliação independente, rodada, snapshot, confronto, achados classificados (`bloqueador`, `importante`, `melhoria opcional`) e decisão final. Distinguir parecer técnico do revisor, resultado normalizado do papel e futura transição oficial.
- Produzir saída `completed`, `changes_required`, `blocked` ou `failed` conforme o contrato e as evidências; relatório com achados obrigatórios **não** pode resultar em aprovação técnica. Não iniciar corretor neste marco.

#### Não alterar

- Não criar terceira sessão Pi para confrontar, editar retroativamente a avaliação independente ou fechar revisão incompleta como aprovada. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 4.3 e 7.2]`
- Não corrigir código, executar commit ou alterar estado do `registro.md` em nome da revisão. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 1, 6 e 7]`

#### Entregáveis

- Fase 2 funcional no mesmo Runner/Pi, revisão finalizada e gate de resultado/achados.
- Testes de aprovação sem obrigatório, `changes_required` por achado importante, somente melhoria opcional, fase 2 inválida e alteração da avaliação independente.

#### Critério de conclusão

- Uma revisão real preserva a avaliação inicial, conclui confronto no **mesmo Pi** e fornece decisão técnica verificável; resultado com achado obrigatório não vira aprovação e não inicia correção automaticamente. Pi e filhos terminam com confirmação ao final.

### M02-T06 — Coordenação sequencial e gates de aprovação técnica

#### Fazer

- Disponibilizar ao OpenClaw comandos/validadores determinísticos de **entrada, handoff e saída** que acompanhem o Runner implementador e o Runner revisor usando os mecanismos existentes do Slice 1; validar identidades `taskId`, `runId`, sessão/processo, lease, artefatos e integridade/snapshot no ponto de cada transição.
- Gerar evidência operacional **separada do registro** com o **parecer técnico do revisor e o resultado da demonstração**, incluindo indicador explícito `officialStatusGateSatisfied: false` (ou equivalente) enquanto faltar a transição oficial. Não representar esse parecer como aprovação integral do T01. Não duplicar status oficial do registro como nova fonte de verdade. Um controlador que perde handle, resultado ou confirmação do processo deve bloquear, não repetir despachos automaticamente.
- Definir protocolo simples de sequência para o OpenClaw (sem daemon/supervisor Node residente). Cobrir casos inválidos, `failed`, `interrupted`, processo `uncertain`, revisão com obrigatório e alteração concorrente entre os papéis.

#### Não alterar

- Não transicionar `registro.md`, introduzir protocolo recuperável de intenção/CAS ou reiniciar automaticamente a implementação: pertencem ao Slice 4. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 8.2, 9 e 11]`
- Não despachar corretor, alterar `main`, usar Git Gateway ou inferir aprovação de `exitCode=0`/texto de modelo. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 1, 6 e 11]`

#### Entregáveis

- Gates e interface de coordenação de dois papéis com evidência da decisão técnica e documentação dos estados/erros.
- Testes determinísticos de handoff normal e recusas, preservando exclusividade, relatórios, snapshot e falta de avanço em caso incerto.

#### Critério de conclusão

- Uma cadeia simulada de implementador + revisor só chega ao parecer técnico positivo quando **ambos os papéis** e seus gates técnicos passaram, com sessões distintas e fase 1/2 no revisor; falha/achado obrigatório interrompem, sem novas sessões ou mutações oficiais. O resultado aprovado não é sinônimo de task `concluída`.

### M02-T07 — Demonstração real OpenClaw + dois Pi no Windows

#### Fazer

- Criar roteiro reproduzível e verificadores de um cenário real, totalmente fictício, via **Gateway OpenClaw**, que despache implementador e revisor sequenciais com `exec` assíncrono, acompanhe `process`/resultados por IDs corretos e registre prova de que o segundo Pi só iniciou após término do primeiro.
- Executar a revisão em duas fases, conferindo identidade da **mesma sessão Pi revisora** nos dois prompts e do processo Pi implementador distinto. Comparar relatório, avaliação inicial, confronto, decisão, snapshots e resultado técnico. Testar recusa do prompt 2 sem avaliação válida em cenário focal. Registrar limites reais sem afirmar recuperação após reinício de Gateway ou isolamento forte.
- Demonstrar ausência de commits na fixture e ausência de alteração oficial do registro pelo orquestrador; publicar extrato sanitizado da prova e comandos de reprodução, sem guardar transcripts/credenciais.

#### Não alterar

- Não substituir Gateway real por modo local embutido, invocar Pi em paralelo ou relaxar permissões globais do OpenClaw para obter o teste. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 2, 4 e 5]`
- Não proclamar o **T01 integral do MVP** ou o MVP todo aceito: o registro `aguardando revisão`/transições oficiais pertencem à implementação posterior do Slice 4. `[Fonte: docs_devout/02-design/contrato-orquestracao-mvp.md#Seções 6, 10 e 11]`

#### Entregáveis

- Procedimento de teste opt-in, verificador/evidências de sessão/cronologia e demonstração real do fluxo de dois papéis até aprovação técnica.
- Testes e relato de falhas do gate de fase 1, de handoff e de aprovação; resultados sanitizados e limitações.

#### Critério de conclusão

- No Windows com Gateway/Pi reais, o OpenClaw acompanha implementador e revisor independentes, verifica término/exclusividade, conclui fase 1 e fase 2 no mesmo Pi revisor e registra **parecer técnico positivo de ensaio** em task fictícia **sem commit nem mudança oficial do registro**, indicando explicitamente que o gate de status oficial ainda não foi executado. O caso negativo de gate não dispara prompt 2. A cobertura é **parcial de T01** (fluxo real sem transição oficial), **T05** (gate da revisão) e partes de **T06** (gates inválidos); os casos T01 integral e T02 serão validados nos slices apropriados.

## Resultado esperado ao final do M02

Estarão disponíveis no código de `src/` um perfil de Pi capaz de realizar programação em repositório fictício, validação determinística da task/baseline, Role Runner para implementador, Role Runner para revisão em duas fases com gate de persistência e snapshot, validação da decisão técnica e comandos de acompanhamento pelo OpenClaw. Uma prova real no Windows demonstrará a sequência de **dois Pi distintos**, preservando lock/processos, avaliações e relatórios, sem realizar commits de task nem mutar `registro.md` automaticamente. A revisão poderá devolver `changes_required`, mas **não** executará correção ou reauditoria neste marco.

**Adiamentos justificados:** Slice 3 — corretor, reauditoria, limites R1–R4 e cenário T02; Slice 4 — transições oficiais recuperáveis do registro, idempotência/CAS, reinício técnico seguro e testes T09–T11; Git Gateway/commits automáticos — etapa futura. A restrição de acesso por arquivo continua mitigação sem isolamento forte. Para demonstrar o **T01 integral** do contrato depois, será necessário fazer o registro alcançar `aguardando revisão` mediante o controlador autorizado, além das provas deste marco.

**Limite expressamente aprovado para M02:** como o contrato distribui o fluxo real no Slice 2 e a atualização segura do registro no Slice 4, este marco terá **aprovação técnica operacional, mas não T01 integral**. A execução não pode alterar silenciosamente a ordem dos slices nem improvisar mudanças de estado no código.
