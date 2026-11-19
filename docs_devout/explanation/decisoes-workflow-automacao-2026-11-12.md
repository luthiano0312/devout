# Decisões de arquitetura — automação do workflow de desenvolvimento

**Data de consolidação:** 2026-11-12  
**Status:** decisões conceituais acordadas; **não implementadas** nas skills nem no orquestrador.  
**Objetivo deste documento:** servir de contrato de intenção para uma revisão de consistência posterior. Não é especificação executável, nem prova de que as skills existentes já cumprem estas regras.  
**Contexto geral da época:** [contexto inicial](archive/contexto-projeto-automacao-workflow.md). Para leitura atual, consultar o [contexto consolidado](contexto-projeto-automacao-workflow-atualizado.md) e a precedência no [índice documental](../README.md).  
**Repositório das skills:** <https://github.com/luthiano0312/my-skills> (`.agents/skills/`).

## 1. Objetivo e limites do projeto

Automatizar gradualmente o workflow de desenvolvimento baseado nas skills `grill-me`, `docs`, `plan` e `implement`, reduzindo intervenção humana rotineira e consumo de modelos sem perder rastreabilidade, aprovação de escopo, revisão independente e controle Git.

- **OpenClaw:** orquestrador de sessões, transições, autorizações operacionais, bloqueios e integração com ferramentas.
- **Pi Agent via RPC:** executor de implementação, revisão e correção em sessões independentes por papel.
- **Git Gateway:** operações Git autorizadas e verificadas, sem conceder ao Pi acesso remoto irrestrito.
- **Sistema inicial:** Windows 11 nativo. O isolamento do ambiente é limitado; permissões de ferramentas não são uma sandbox de segurança forte.
- **Crescimento incremental:** começar com a automação de **uma task completa** num repositório de teste; ampliar para um marco e depois para integrações com outras skills. Não confundir o workflow-alvo completo com o escopo do primeiro protótipo.

**Responsabilidade humana preservada:** aprovar marco e mudanças de escopo, decidir requisitos/arquitetura quando necessário, homologar o marco e autorizar especificamente a integração na `main`.

## 2. `plan`: granularidade das tasks (acordado)

### 2.1 Princípio

A `plan` gera **tasks pequenas por padrão**. Uma task deve ter uma entrega técnica ou funcional coerente, verificável e revisável, dimensionada para execução em uma conversa/sessão de agente sem exigir contexto excessivo.

- Não decompor até operações artificialmente mínimas, como “criar controller vazio”, “declarar função” ou “criar teste isolado”, salvo se forem resultados técnicos genuinamente verificáveis por si.
- Não reunir vários resultados independentes numa task só porque pertencem à mesma funcionalidade.
- **Tasks médias** são permitidas quando a divisão implicaria retrabalho, quebra de um comportamento coerente ou custo de coordenação/revisão superior ao benefício; a `plan` deve justificar essa exceção na proposta do marco.
- Uma task ainda pode atravessar backend, frontend, dados e testes quando isso for necessário para uma entrega coerente.
- Não definir no MVP limites rígidos por arquivos, linhas, tokens ou tempo; o custo real será medido depois.

### 2.2 Procedimento proposto para a `plan`

1. Decompor o recorte do marco em entregas candidatas.
2. Avaliar cada candidata sob **quatro aspectos**: (a) objetivos independentes; (b) contexto/subsistemas a compreender; (c) incertezas e decisões técnicas; (d) amplitude de testes e critérios de verificação.
3. Classificar qualitativamente como **pequena, média ou grande**, usando indícios concretos, não somente a quantidade de texto.
4. Manter pequenas; examinar divisão de médias e justificar as mantidas; dividir grandes antes da aprovação, preservando entregas verificáveis.
5. Revisar cobertura de requisitos, dependências, ciclos e ausência de microtasks artificiais.
6. Apresentar o conjunto ao usuário para aprovação.

A classificação é **instrumento de elaboração**, não novo campo obrigatório do arquivo de cada task. A justificativa para manter uma task média pode figurar na apresentação do plano, sem poluir o contrato da task.

### 2.3 Planejamento antes da execução

- **Todas as tasks previstas do marco são especificadas e aprovadas antes do início da execução automatizada.**
- O agente não pode acrescentar tasks ou ampliar escopo por conta própria.
- O plano pode ser revisado por problemas descobertos na execução ou feedback da homologação, mediante aprovação humana explícita, preservando IDs e evidências conforme as regras de replanejamento.
- A `plan` continua planejando **um marco por vez**; não antecipa marcos distantes sem necessidade.

## 3. `plan`: organização dos arquivos (acordado)

**Cada task, pequena ou média, terá seu próprio arquivo Markdown** e manterá obrigatoriamente os campos atuais:

- `Fazer`
- `Não alterar`
- `Entregáveis`
- `Critério de conclusão`

O **arquivo central é um índice** com identificações, resumos, links, ordem sugerida e dependências justificadas; não reproduz a especificação completa de cada task. `registro.md` continua como fonte de verdade dos estados, hashes e observações, não do escopo.

### Estrutura de referência aprovada conceitualmente

**Exemplo conceitual, não mapa do checkout atual.** No `devout`, o [plano M01 encerrado](../03-execucao/planos/marco-M01.md) preserva o planejamento histórico; consultar o [registro](../03-execucao/registro.md) para progresso e o [AGENTS.md](../../AGENTS.md) para o mapa atual. Não há plano ativo enquanto M02 aguarda planejamento. A migração para arquivos individuais por task não integra o Slice 1.

```text
docs/03-execucao/
├── plano.md                   # entrada / referência ao marco atual
├── registro.md                # histórico de progresso entre marcos
├── marcos/
│   └── M01/
│       ├── plano.md           # índice, recorte, ordem e dependências
│       └── tasks/
│           ├── M01-T01.md
│           ├── M01-T02.md
│           └── M01-T03.md
└── achados/                   # relatórios e revisões (layout a compatibilizar)
```

- Caminhos acima são o **layout sugerido para projetos novos**, não instrução para reorganizar arbitrariamente projetos com convenção existente.
- Os diretórios dos marcos permanecem estáveis para evitar quebrar links após encerramento. Links Markdown relativos são preferíveis para compatibilidade Obsidian/GitHub.
- IDs seguem globais, estáveis e não reutilizáveis depois da aprovação/uso (`M01-T01`, etc.).
- Ainda é necessário **definir precisamente** o contrato do `plano.md` raiz, do índice por marco e a localização dos `achados/` nos projetos existentes antes de escrever um migrador.

## 4. Validação do plano (acordado)

Adotar **validação estrutural determinística**, por script (nome provisório: `validate_plan.py`). Verificações esperadas:

- arquivos referenciados existentes e links internos válidos;
- IDs únicos e consistentes entre índice, arquivos individuais e registro;
- presença dos quatro campos obrigatórios e estrutura reconhecível;
- dependências apontando para tasks válidas, sem ciclos;
- ordem/índice e registro coerentes com o marco aprovado;
- existência e versionamento do baseline relevante antes da execução.

Executar, conforme a fase, (a) sobre proposta estruturada antes de aprovar, (b) sobre arquivos gravados depois da aprovação e (c) como gate do orquestrador antes de executar. O script **não substitui julgamento semântico** de requisitos, complexidade ou qualidade dos critérios.

**Evolução futura, não incluída no MVP:** um agente revisor de tasks, independente do agente que as escreveu, para conferir qualidade semântica, clareza, verificabilidade e coerência das tasks. Não introduzir agora esse papel nem automatizar suas decisões.

## 5. `implement`: tarefas e carregamento seletivo (acordado)

- O OpenClaw identifica a task pelo índice, confirma versão aprovada, valida dependências e fornece ao Pi o caminho da especificação atual.
- O Pi carrega **a task atual completa**, não todas as tasks anteriores nem todo o marco.
- Dependências são verificadas administrativamente pelo orquestrador usando o registro e evidências Git. O agente pode ler, sob demanda, contratos de código/documentação relevantes das dependências, não precisa receber os relatórios completos delas.
- Se o código real contradizer a documentação, o agente deve reportar e parar conforme freios de escopo; o gate administrativo não substitui a análise técnica.
- Uma especificação já aprovada/versionada não pode mudar silenciosamente durante a execução. Replanejamento exige aprovação e nova referência de versão.

## 6. `implement`: revisão independente e leitura antecipada (acordado)

**Problema observado:** agentes revisores às vezes liam relatos/achados antes de terminar a avaliação independente, continuavam a revisão e depois a declaravam incompleta, causando repetição em novas conversas.

**Solução selecionada para o MVP:** controle de ferramentas, **sem ambiente de revisão duplicado**, usando a extensão `pi-file-permissions` em conjunto com `review_inputs.py`.

- Durante a **fase 1**, o revisor pode consultar código, testes, documentação necessária e task; não pode ler relatos do implementador, achados anteriores nem Observações narrativas do registro.
- A política de leitura deve ser administrada pelo orquestrador; o Pi não pode alterá-la livremente.
- O `review_inputs.py` continua responsável por fornecer entradas/diffs filtrados.
- A liberação de relatos para a **fase 2** acontece **somente após verificar que a avaliação independente foi persistida**.
- **Tentativa bloqueada sem vazamento de conteúdo:** não contamina a revisão; registrar a negativa e continuar por caminho permitido.
- **Exposição efetiva antecipada:** interromper imediatamente, registrar a operação causadora, invalidar a tentativa independente e reiniciar em sessão nova com a causa mitigada; não consumir automaticamente uma das quatro rodadas de auditoria.
- Negativas repetidas e impossibilidade de mitigar a causa levam a pausa, não a loop infinito.

**Limitação explícita:** restrições por extensão não garantem bloquear todo caminho indireto (terminal, Git, scripts, MCPs, outras extensões) no Windows nativo. Verificar na prática o comportamento no Pi RPC e não chamar isso de sandbox. Uma leitura negada **não** é prova de que todas as demais rotas de leitura estão bloqueadas.

## 7. `implement`: orquestração dos papéis e estados (acordado)

- Implementador, revisor e corretor continuam em **sessões Pi independentes por papel**, despachadas pelo OpenClaw, não por invocação manual do usuário a cada troca.
- O Pi executa código, testes, relatórios e revisões, mas **não atualiza diretamente o `registro.md`** no modelo automatizado.
- **Somente o OpenClaw** determina e efetua transições oficiais, por scripts validados, após conferir evidências e gates.
- O `registro.md` segue como **fonte de verdade do progresso**; OpenClaw guarda **estado operacional mínimo separado** (sessão, tentativa, operação em andamento etc.) para coordenação, sem duplicar a verdade do registro.
- A resposta do Pi deve conter **resultado estruturado**, como `completed`, `changes_required`, `blocked`, `failed`, `interrupted`; essa resposta é *indício*, **não autorização**. O orquestrador valida arquivos, revisão, registro e Git antes de avançar.
- Os estados atuais permanecem como referência: `não iniciada`, `em andamento`, `aguardando revisão`, `em correção`, `pausada`, `concluída`, `substituída`.
- Preservar até **3 correções completas / 4 revisões**, sendo obrigatórios os achados bloqueadores/importantes. Todos os achados, inclusive opcionais, devem ser reportados ao usuário; reportar não implica pausar automaticamente.
- A task só libera a próxima após confirmação de commits, integração na branch do marco e publicação remota exigida pelo workflow. Nenhuma task obrigatória pendente autoriza avançar o marco.

**Mudança necessária ainda não implementada:** as instruções atuais da `implement` delegam mudanças de status aos agentes. O novo contrato requer retirar esse poder do Pi e atribuí-lo exclusivamente ao orquestrador, inclusive protegendo o arquivo contra escrita por ferramentas não autorizadas.

## 8. Autorização e política Git (acordado)

**Duas autorizações distintas:**

1. **Aprovação do marco:** permite executar as tasks aprovadas e operações Git rotineiras **limitadas às branches autorizadas**, sem aprovar cada commit individualmente.
2. **Homologação + autorização final explícita:** permite integrar o marco à `main`.

O modelo de branches:

```text
main
└── marco-01
    ├── task-M01-T01 -> integrar sem squash em marco-01
    ├── task-M01-T02 -> integrar sem squash em marco-01
    └── ...

marco-01 -> homologação e autorização humana -> main (sem squash)
```

- **Dois commits oficiais por task** após aprovação técnica: (1) funcional com código e evidências revisadas; (2) metadados do `registro.md` com o hash do funcional.
- A branch de cada task nasce da cabeça atualizada da branch do marco; execução de tasks **sequencial**.
- Preservar **todos os commits individuais** ao integrar a task no marco e o marco na `main`, **sem squash** em ambos os níveis. Preferir *fast-forward* e rejeitar avanço inseguro/divergente em vez de forçar histórico.
- Git Gateway valida identidades de task/marco, autorização, refs/ancestralidade, commits, ausência de concorrência e evidências antes de executar operações Git privilegiadas. Não conceder credenciais GitHub remotas irrestritas ao Pi.
- Publicar branch da task e atualizar a branch do marco remotamente **somente após aprovação técnica e commits oficiais**.
- **Opção A escolhida para o MVP e foco do projeto:** sem checkpoints/commits provisórios remotos durante a implementação. Trabalho parcial existe localmente. A opção B (checkpoints remotos) **não é compromisso de evolução**; só reavaliar se uma necessidade real surgir após o MVP.
- Preservar commits na `main` remove a necessidade normal de recuperar hashes perdidos por squash, mas regras históricas de integração, confirmação de ancestry e rastreabilidade ainda precisam ser reconciliadas com o novo fluxo.

## 9. Falhas, pausa e reinício simplificado do MVP (acordado)

- **Falta de decisão, permissão, dependência, recurso externo ou ampliação de escopo:** pausar e solicitar decisão do usuário; não reiniciar inutilmente.
- **Interrupção técnica ou inconsistência local antes dos commits oficiais:** descartar a tentativa e reiniciar a task **do baseline aprovado**, em vez de construir um mecanismo sofisticado de recuperação parcial.
- **Reinício deve ser seguro:** só descartar o ambiente de trabalho dedicado à tentativa; não apagar arquivos/alterações preexistentes do usuário, branches compartilhadas, commits confirmados ou trabalho de outras tasks.
- **Limite inicialmente adotado:** uma reinicialização automática adicional por task; se falhar novamente, pausar o marco e reportar. Este limite é independente das 3 rodadas de correção do ciclo de revisão.
- **Falha após commit, publicação ou integração:** não reiniciar cegamente, não desfazer automaticamente. Verificar o Git/estado remoto; ambiguidades exigem intervenção humana.
- Pode ser utilizado um diretório/worktree exclusivo por tentativa, a definir na implementação. A decisão aprovada é o *isolamento da área descartável*, não uma ferramenta específica.
- O atual `update_registro.py` não fornece uma transição segura de reinício entre todos os estados; será preciso projetar uma operação controlada sem apagar histórico nem reabrir task concluída.

**Observação de consistência:** reinício limpo de tentativas ainda não commitadas é diferente de recuperação de tarefas já versionadas e de replanejamento por não convergência. Não confundir os contadores, as autorizações ou os objetos passíveis de descarte.

## 10. Homologação e feedback (objetivo do workflow completo)

- O usuário testa o **marco completo** em `marco-01` após a conclusão das tasks e verificações de integração.
- Se aprovado, só então autoriza integração preservando commits na `main`.
- Se reprovado, o feedback deve ser triado: (a) bug contra requisito vigente; (b) mudança de comportamento/decisão; (c) nova funcionalidade.
- Problemas geram **novas tasks rastreáveis e aprovadas**, ou replanejamento explícito quando necessário; não reabrir silenciosamente tasks concluídas nem apagar evidências.
- Mudanças de requisito/design passam por `docs` quando pertinente e por `plan` antes de nova execução.
- Novas tasks de homologação podem pertencer ao mesmo marco, com rastreabilidade do motivo, preservação do histórico e nova homologação.

**Detalhamento do contrato de feedback e automação dessa fase:** posterior ao MVP inicial de uma task. O comportamento acima é diretriz aprovada, não implementação definida em todos os detalhes.

## 11. Itens explicitamente fora do MVP / não decididos

- Revisão semântica das tasks por um agente separado da `plan` (futuro).
- Checkpoints remotos intermediários (opção B; só reconsiderar se necessário).
- Recuperação sofisticada de progresso parcial ou replay transacional do workflow.
- Execução de tasks em paralelo.
- Isolamento forte por máquina/contêiner/usuário de sistema.
- Escolha exata de provedores/modelos, orçamento de tokens/custo/tempo e política operacional de notificações.
- Interface/API definitiva do Git Gateway, proteção efetiva de credenciais e configuração concreta do GitHub.
- Formato/schemas finais do estado operacional e dos resultados por papel.
- Compatibilidade/migração de projetos existentes que ainda usam `plano.md` monolítico.

## 12. Questões que a revisão de consistência deve verificar (não são decisões novas)

Use este documento como **intenção aprovada** e confronte-o com as instruções e código atuais das skills e com o contexto geral do projeto. Itens para auditoria, sem supor de antemão que estejam resolvidos:

1. A `plan` atual prefere entregas fim a fim e um `plano.md` monolítico; como compatibilizar a nova granularidade e os arquivos por task sem criar microtasks ou romper IDs/registro?
2. Como o `AGENTS.md`/`CLAUDE.md`, `plano.md` raiz, índice por marco, arquivo da task e `registro.md` apontarão para os mesmos caminhos sem fontes de verdade concorrentes?
3. Como adaptar `implement` para **não** ler todas as tasks do marco nem carregar automaticamente especificações completas de dependências?
4. Como garantir que o Pi **não altere** o registro se os scripts de atualização atuais são invocados pelos papéis? O que o OpenClaw deve validar antes de cada transição?
5. O script `update_registro.py` permite reinício limpo de estados intermediários? Como preservar o motivo, evidências e contagem de tentativas sem transições perigosas ou perda de observações?
6. O filtro de `review_inputs.py` e as permissões do Pi protegem relatos mesmo com `bash`, pesquisas amplas, Git, scripts auxiliares ou outros conectores? Uma negativa sem exposição é distinguível de vazamento real?
7. Como persistir avaliação independente antes de liberar a fase 2 e como retomar revisão incompleta sem consumir rodadas indevidas?
8. Como tratar revisão **aprovada mas sem commits** após interrupção, sem lançar nova rodada só por falta de autorização/confirmacão?
9. Como conciliar dois commits por task, campo `Commit`, integração fast-forward, autoria das alterações do registro e integridade do baseline sem squash?
10. Quais ações são seguras de repetir após falha, especialmente na fronteira entre “alterações locais descartáveis” e “primeiro commit já criado”?
11. Há divergência entre a política anterior de preservar alterações numa pausa e a nova política de descarte da **tentativa técnica isolada**? Distinguir pausa de negócio, tentativa técnica e estado final.
12. O validador estrutural consegue detectar paths quebrados, IDs duplicados, dependências cíclicas e inconsistência entre índice, tasks, registro e Git antes do primeiro despacho?
13. A autorização de marco cobre exatamente quais operações? O Git Gateway faz verificações próprias ou depende apenas de uma declaração do modelo?
14. O fluxo de homologação e adição de novas tasks ao mesmo marco preserva histórico e não reabre tasks concluídas?

### Resultado esperado da próxima conversa

Produzir um relatório de consistência **sem alterar arquivos inicialmente**, com:

- **inconsistência confirmada** (trechos/arquivos envolvidos e reprodução quando possível);
- **risco ou lacuna** (não apresentado como bug comprovado);
- **decisão já tomada** que resolve o assunto;
- **decisão ainda necessária**, quando houver;
- proposta mínima de mudança, impacto em scripts/skills, critérios de teste e prioridade.

Priorizar contradições que possam causar perda de dados, violar aprovação humana, comprometer independência do revisor ou integrar código não aprovado. Não redesenhar todo o projeto quando bastar uma mudança localizada.

**Importante:** o documento atual não comprova que os problemas listados existam na versão mais recente do GitHub. A próxima conversa deve consultar os arquivos reais de `.agents/skills/plan/` e `.agents/skills/implement/`, scripts e testes antes de afirmar inconsistências.
