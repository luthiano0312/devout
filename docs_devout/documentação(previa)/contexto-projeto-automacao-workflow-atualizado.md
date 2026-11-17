# Automação do workflow de desenvolvimento — contexto consolidado

**Status:** definição conceitual consolidada em 2026-11-12; implementação ainda não iniciada.  
**Decisões aprovadas (detalhes e roteiro de auditoria):** [`decisoes-workflow-automacao-2026-11-12.md`](decisoes-workflow-automacao-2026-11-12.md).  
**Objetivo:** automatizar o workflow pessoal de engenharia de software existente, preservando as regras, os artefatos e o controle de qualidade das skills `grill-me`, `docs`, `plan` e `implement`, com menor custo de modelos e menor necessidade de intervenções rotineiras.

## 1. Visão geral

O projeto usará **OpenClaw como orquestrador** e **Pi Agent como agente de programação**, inicialmente controlado por **RPC**. A proposta se inspira no princípio do Devin Fusion: usar modelos relativamente baratos para executar trabalho delimitado e modelos mais capazes para atividades críticas, sobretudo revisão. Não pretende reproduzir toda a arquitetura interna do Devin.

As skills atuais continuam sendo a **fonte das regras de engenharia**, enquanto o orquestrador administra sessões, transições, retomadas, escolha de modelos e interrupções. As decisões, os planos, o progresso, os relatórios e as revisões continuam persistidos em arquivos e no Git, e não apenas no histórico das conversas.

O projeto começa pequeno: automatizar **uma task completa da skill `implement`** antes de abranger marcos inteiros e, depois, as demais skills.

## 2. Workflow existente e responsabilidades

Repositório das skills: <https://github.com/luthiano0312/my-skills> (`.agents/skills/`).

| Skill | Papel no desenho-alvo | O que preservar |
| --- | --- | --- |
| `grill-me` | Entrevista o usuário, uma pergunta por vez, explora lacunas e consolida decisões. | O usuário toma as decisões de produto; entrevista interativa. |
| `docs` | Transforma decisões e necessidades em requisitos, design, ADRs e documentação padronizada. | Fontes de verdade claras, estrutura documental, referências/templates e gestão contínua. |
| `plan` | Propõe um **marco de cada vez**, com tasks pequenas por padrão, especificações Markdown individuais e índice central, após aprovação. | IDs estáveis, quatro campos atuais, dependências, `registro.md`, baseline Git e aprovações de escopo. |
| `implement` | Executa uma task por vez; papéis Pi independentes produzem código e evidências; OpenClaw controla transições oficiais. | Isolamento dos papéis, auditoria em duas fases, evidências persistidas, scripts de controle, limites de correção e regras de escopo. |

O `registro.md` já possui estados definidos: `não iniciada`, `em andamento`, `aguardando revisão`, `em correção`, `pausada`, `concluída` e `substituída`. O avanço depende de condições verificáveis, não apenas de uma declaração do agente.

Na `implement`, **implementador, revisor e corretor usam sessões independentes**. O revisor primeiro avalia código e evidências filtradas, persiste a avaliação independente e **só depois** lê os relatos anteriores. Os scripts `review_inputs.py` e `update_registro.py` já apoiam parte do contrato atual, mas precisam de adaptação para o fluxo automatizado. O OpenClaw será o único responsável pelas transições oficiais de estado; o Pi produz evidências. Uma task admite até **três correções completas e quatro revisões**; sem convergência, é pausada e encaminhada à `plan`. Achados `bloqueador` ou `importante` impedem a conclusão; `melhoria opcional` não impede.

A `plan` foi redesenhada **conceitualmente**: tasks pequenas por padrão (médias justificadas), arquivo por task com os mesmos quatro campos, índice por marco, planejamento completo antes da execução, validação estrutural e carregamento seletivo de contexto. A revisão semântica independente de tasks por outro agente é ideia futura, não requisito do MVP.

## 3. Workflow automatizado pretendido

1. **Definição do marco:** usuário usa `grill-me`/`docs` conforme necessário; `plan` propõe recorte e **todas as tasks previstas**. Cada task possui arquivo Markdown próprio e o índice do marco contém links, resumo, ordem e dependências. O usuário aprova o conjunto antes de autorizar a execução. O baseline (índice, arquivos de task, registro e mapa de caminhos) deve estar versionado e validado estruturalmente.
2. **Branch de marco:** criar `marco-01` (exemplo), a partir da base aprovada. O trabalho não é integrado diretamente à `main`.
3. **Branch por task:** para cada task elegível, criar branch própria **a partir do estado atualizado de `marco-01`**.
4. **Implementação:** OpenClaw verifica dependências, especificação aprovada e Git; inicia Pi Agent em sessão/processo isolado no papel implementador, preferencialmente com modelo mais barato, carregando seletivamente a task atual e fontes pertinentes. O Pi executa verificações e persiste relatório; OpenClaw valida e atualiza o registro.
5. **Revisão:** iniciar **nova sessão independente** do Pi no papel revisor, preferencialmente com modelo mais capaz. Na fase 1, `pi-file-permissions` e `review_inputs.py` evitam acesso acidental a relatos; a fase 2 só começa após confirmação da avaliação independente persistida. Negativa sem vazamento não invalida a revisão; exposição efetiva exige interrupção imediata e correção da causa.
6. **Correção e reauditoria:** se houver achados obrigatórios corrigíveis, notificar o usuário e iniciar automaticamente nova sessão de correção (preferencialmente modelo barato), seguida de outra revisão independente (modelo mais capaz). OpenClaw controla as transições do `registro.md` por verificações programáticas. Respeitar limites existentes. Relatar **todo achado** ao usuário, mesmo quando a execução puder continuar; notificar não significa necessariamente pausar.
7. **Conclusão da task:** somente depois da aprovação técnica, realizar por Gateway os **dois commits oficiais** (funcional e metadados), integrar a branch da task em `marco-01` **preservando commits, sem squash**, e sincronizar remotamente. Sem checkpoints remotos durante a implementação. A próxima task só é liberada após verificar commits, integração e publicação.
8. **Próxima task:** repetir sequencialmente, sempre tomando a branch do marco já atualizada como base. **Se uma task tiver problema obrigatório não resolvido, parar o marco inteiro**, mesmo que as tasks seguintes sejam independentes.
9. **Homologação:** depois de todas as tasks do marco concluídas, o usuário testa e **aprova ou reprova o marco completo** na branch `marco-01`.
10. **Se aprovado:** integrar `marco-01` na `main` **preservando todos os commits e sem squash**, somente após autorização humana explícita.
11. **Se reprovado:** preservar código, histórico e evidências; encaminhar feedback à `plan`, criar/ajustar tasks aprovadas e executar novo ciclo de correções no marco. Reprovação **não** apaga histórico nem reinicia arbitrariamente contadores/IDs das tasks anteriores. Mudanças de requisitos/design passam antes pela `docs`, quando necessário.

**Regra principal:** o usuário aprova o marco para autorizar a execução rotineira das tasks, mas decisões novas de produto, escopo e arquitetura continuam humanas. A IA revisa tecnicamente; o usuário homologa o produto.

## 4. Autonomia e interrupções

**Prosseguir automaticamente quando:** a próxima ação já está determinada pelas regras aprovadas (executar task elegível, revisar, corrigir achados obrigatórios dentro do limite, reauditar, concluir e integrar task aprovada nas condições autorizadas).

**Reportar sempre:** qualquer achado de revisão, incluindo melhorias opcionais. O reporte não deve interromper automaticamente uma correção autorizada. A forma e a granularidade das notificações ainda serão refinadas.

**Pausar o marco e solicitar decisão quando:**

- Houver contradição entre documentação, plano e implementação que exija alterar requisito ou decisão de arquitetura.
- For necessário ampliar o escopo, tocar áreas de `Não alterar` ou modificar entregáveis não autorizados.
- Uma task continuar com achado obrigatório após o limite de correções/revisões; encaminhar à `plan` para possível reespecificação.
- Faltarem acessos, credenciais, recursos externos ou decisões que não possam ser recuperados das fontes existentes.
- Houver divergência de estado, evidência, branch, commit, dependência ou mudança concorrente que impeça avançar com segurança.
- O orçamento de custo, tempo ou tentativas (ainda a definir) for excedido, ou ocorrer falha técnica persistente.
- For necessária operação destrutiva, acesso a segredos, deploy em produção ou ação fora da autorização concedida.

**Não delegar ao modelo:** aprovação de novos requisitos, mudança de escopo, homologação do marco e integração na `main`. A capacidade de interromper não deve depender somente do agente escrever uma frase: combinar sinalização estruturada, estado persistido e validações programáticas.

**Política simplificada do MVP:** falta de decisões, permissões ou recursos pausa o marco para intervenção. Já uma interrupção técnica ou inconsistência **local e anterior aos commits oficiais** leva ao **descarte seguro da tentativa isolada** e reinício limpo a partir do baseline aprovado, com no máximo **uma reinicialização automática adicional** por task. Falha repetida pausa o marco. Nunca descartar alterações preexistentes do usuário, trabalho de outra task ou commits/publicações/integrações já confirmados; após operação Git com efeito persistente, conferir estado e solicitar intervenção quando ambíguo. Pausas por decisão não são reinícios técnicos. A operação específica de reinício no registro ainda precisa ser projetada.

## 5. Estratégia de modelos e contexto

- **Implementador / corretor:** modelo barato por padrão.
- **Revisor / reauditor:** modelo mais inteligente por padrão.
- **Grill-me / plan:** inicialmente podem continuar em modelos mais capazes, pois envolvem ambiguidade e decisões difíceis.
- **Docs:** possível experimentação com geração barata e revisão inteligente, sem definição final.

A distribuição é uma **hipótese a validar**, não uma garantia de economia. Medir custo, tokens, latência, qualidade e número de rodadas. **Carregamento seletivo de contexto:** cada papel recebe a task atual completa, mas não todas as tasks do marco nem relatórios de dependências automaticamente. O OpenClaw valida estados e dependências; o Pi consulta contratos de código/documentação pertinentes sob demanda. Históricos conversacionais de outros papéis não são transferidos ao revisor; os artefatos em disco/Git funcionam como contratos de handoff.

## 6. Branches, sincronização remota e Git Gateway

Estrutura conceitual:

```text
main
└── marco-01
    ├── task-M01-T01  → revisar → integrar em marco-01
    ├── task-M01-T02  → revisar → integrar em marco-01
    └── ...

marco-01 → homologação humana → main (somente se aprovada)
```

O usuário quer **sincronização com o GitHub entre tasks concluídas do marco**, para acessar as entregas aprovadas em diferentes ambientes. No **MVP, a sincronização ocorre apenas após aprovação técnica e os dois commits oficiais**, não durante a implementação parcial. Não deseja confiar ao agente credenciais Git amplas nem comandos arbitrários capazes de alterar a `main`. Checkpoints intermediários (opção B) não são prioridade nem compromisso de evolução.

Será criado um **Git Gateway**, com operações específicas e verificadas (a API concreta ainda será projetada), para criar branches do marco/task, registrar os dois commits oficiais, publicar task, integrar task no marco por *fast-forward*, publicar o marco e integrar o marco na `main` após homologação/autorização. **Preservar todos os commits nas duas integrações; não usar squash.** O orquestrador solicita operações; o Gateway valida estado, branch permitida, ancestrais, conteúdo, aprovações e atualizações concorrentes antes de executá-las. Sem `force push`, exclusão arbitrária ou push não autorizado para `main` pelo agente.

**Limitação reconhecida:** se Pi, OpenClaw e Gateway rodarem com a mesma conta e credenciais acessíveis no Windows, um wrapper de ferramentas **não constitui barreira de segurança forte**. Separar credenciais remotas do Pi, aplicar proteções/rulesets no GitHub e testar num repositório descartável. Isolamento forte (usuário de sistema separado, contêiner ou máquina dedicada) fica para uma etapa futura. O Gateway não deve executar scripts não confiáveis do projeto com privilégios de credenciais.

**Duas autorizações foram acordadas:** (1) aprovação do marco para execução e operações rotineiras restritas às branches autorizadas, sem aprovação por commit; (2) autorização humana explícita após homologação para integração na `main`. O Gateway deve conferir essas autorizações, não aceitar uma declaração do modelo como permissão. O contrato técnico exato das operações e as proteções reais no GitHub ainda precisam ser especificados/testados.

## 7. Ambiente e ferramentas escolhidas

| Componente | Decisão |
| --- | --- |
| Sistema operacional inicial | **Windows 11 nativo**; sem Docker/WSL2/servidor remoto no MVP. |
| Orquestrador | **OpenClaw**. |
| Executor de programação | **Pi Agent**, controlado por **RPC**. |
| Papéis e regras | Skills existentes em `my-skills`, sobretudo `implement`. |
| Controle de versão | Git local + GitHub remoto. |
| Operações Git privilegiadas | Futuro **Git Gateway** com funções limitadas. |
| Persistência do workflow | Índices de plano, arquivo por task, `registro.md` oficial, relatórios/revisões, branches/commits e **estado operacional separado e mínimo** do OpenClaw. |
| Modelos | Barato para execução/correção; mais capaz para revisão; fornecedores/modelos ainda não escolhidos. |

Windows nativo facilita depuração e integração inicial, mas apresenta **isolamento fraco**. Não executar primeiro em repositórios importantes nem supor que comandos de terminal estejam restritos só por instruções de prompt.

## 8. Mudanças necessárias em relação às skills atuais

**Preservar:** quatro campos de cada task, IDs estáveis, estados existentes, `review_inputs.py`, `update_registro.py` (adaptando operações necessárias), freio de escopo, revisão independente em duas fases, três correções/quatro revisões, replanejamento e decisões humanas sobre requisitos.

**Adaptar, com mudanças mínimas e verificadas:**

1. Na `implement`, permitir **despacho automático de sessões/processos RPC isolados** por papel. A proibição atual de “usar subagentes” precisa ser reinterpretada em termos do isolamento exigido. A `plan` passa a usar arquivo individual por task e índice de marco; a `implement` carrega a task atual seletivamente.
2. O destino de cada task aprovada passa a ser **a branch do marco**, com dois commits oficiais preservados. O marco entra na `main` após homologação, também **sem squash**. O MVP não publica trabalho parcial nem cria commits WIP.
3. Implementar os **dois níveis de autorização já acordados**: autorização do marco para operações rotineiras limitadas; autorização final humana para `main` e ações sensíveis. Ainda falta contrato técnico de verificação.
4. Definir resultados estruturados do Pi (`completed`, `changes_required`, `blocked`, `failed`, `interrupted`, sujeitos à especificação final), mas **somente OpenClaw atualiza o `registro.md`** depois de conferir evidências. Separar estado operacional do orquestrador do registro oficial.
5. Criar integração segura com Git Gateway e verificações de branch/ref/concorrência. Não dar ao Pi credencial remota irrestrita. Proteger relatos da revisão fase 1 com `pi-file-permissions` mais `review_inputs.py`, liberando fase 2 só após persistência da avaliação independente.
6. Definir o tratamento da **reprovação na homologação**: feedback → `docs` (se mudar requisito/design) → `plan` → novas tasks/ajustes aprovados → execução, preservando histórico.
7. Persistir informações operacionais mínimas sem duplicar o `registro.md`. No MVP, falhas técnicas locais/inconsistências descartáveis reiniciam uma única vez a task a partir do baseline, sem recuperação detalhada do progresso parcial; jamais reiniciar cegamente depois de commits/integração.

**Não fazer agora:** reescrever as quatro skills integralmente, introduzir execução paralela, revisores semânticos de tasks, checkpoints remotos intermediários ou framework genérico de agentes. **A mudança estruturada dos planos e tasks está aprovada conceitualmente**, mas ainda depende de especificação de migração, validadores e testes antes da implementação.

## 9. Etapas sugeridas de implementação do projeto

1. **Prova de integração:** instalar/verificar OpenClaw e Pi no Windows, iniciar Pi por RPC, enviar tarefa simples, acompanhar resultado e encerrar processo. Sem commits nem repositórios reais.
2. **Isolamento entre papéis:** executar implementador e revisor em processos/sessões distintos; validar as restrições de contexto da revisão.
3. **Orquestração de uma task:** ler índice/task/registro, executar implementador → revisor → corretor → revisor, usar OpenClaw como único atualizador de estados e pausar corretamente nos gates.
4. **Git Gateway mínimo:** criar/publicar branches autorizadas, realizar os dois commits oficiais após aprovação técnica, integrar task no marco por fast-forward e sincronizar remotamente. Testar restrições e falhas em repositório descartável.
5. **Automação do marco:** repetir tasks sequencialmente, reportar achados, respeitar interrupções e oferecer homologação final.
6. **Expansão posterior:** ciclo completo de homologação/reprovação, maior integração com `plan`/`docs`/`grill-me`, revisão semântica independente de tasks (se útil), modelos/custos e eventual isolamento mais forte. Checkpoints remotos só serão reconsiderados se houver necessidade demonstrada.

## 10. Pendências a decidir/testar

- Auditoria de consistência entre **estas decisões** e a versão real das skills/scripts; não assumir que já foram implementadas.
- Contrato exato entre `plano.md` raiz, índice por marco, arquivos de task, `registro.md`, `AGENTS.md`/`CLAUDE.md` e projetos com layouts existentes.
- Implementação do validador estrutural (links, IDs, campos, dependências, ciclos, baseline) e testes de migração/compatibilidade.
- Restrição concreta da leitura de relatos via `pi-file-permissions` no Pi RPC; testar caminhos indiretos via terminal, Git e scripts no Windows.
- Recuperação de exposição efetiva; distinção entre revisão incompleta, contaminada, finalizada e aprovada sem commits.
- Contrato efetivo das transições operadas pelo OpenClaw, especialmente reinício de tentativa anterior aos commits; ajustes ao `update_registro.py` para evitar apagar observações.
- Formatos do estado operacional e resultados estruturados por papel, verificações de evidências e limite de reinício técnico.
- Interface exata do Git Gateway, proteção de credenciais, regras no GitHub, fast-forward, dois commits e comprovação da publicação remota.
- Modelos/provedores concretos, orçamento por task/marco, métricas de tokens/custo/qualidade e notificações.
- Contrato detalhado do ciclo de feedback após homologação reprovada, sem reabrir tasks concluídas.
- Testes reais de OpenClaw → Pi RPC: isolamento de sessões, eventos, cancelamento e persistência.

**Adiado deliberadamente:** checkpoints remotos de trabalho parcial; recuperação sofisticada da execução parcial; revisão semântica de tasks por agente separado; execução paralela; isolamento forte do Windows.

## 11. Princípios do projeto

1. **Reutilizar o workflow comprovado**, sem reinventá-lo.
2. **Automatizar execução, não decisões de produto.**
3. **Manter revisão independente** e evidências verificáveis.
4. **Não avançar com task obrigatória pendente.**
5. **Reportar todos os achados**, diferenciando notificação de interrupção.
6. **Proteger a `main` por permissões e autorizações reais**, não apenas prompts.
7. **Começar com Windows nativo e uma task**, ampliando após validar o comportamento.
8. **Medir custo e qualidade**, em vez de assumir que dois modelos economizarão recursos.

---

**Referências:** <https://github.com/luthiano0312/my-skills> e [`decisoes-workflow-automacao-2026-11-12.md`](decisoes-workflow-automacao-2026-11-12.md). Este documento distingue decisões conceituais de implementação técnica: **não substitui as especificações das skills, não comprova que elas já atendam ao desenho e não autoriza alterações no repositório.**
