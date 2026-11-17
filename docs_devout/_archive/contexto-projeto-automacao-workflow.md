# Automação do workflow de desenvolvimento — contexto inicial

**Status:** definição conceitual; implementação ainda não iniciada.  
**Objetivo:** automatizar o workflow pessoal de engenharia de software existente, preservando as regras, os artefatos e o controle de qualidade das skills `grill-me`, `docs`, `plan` e `implement`, com menor custo de modelos e menor necessidade de intervenções rotineiras.

## 1. Visão geral

O projeto usará **OpenClaw como orquestrador** e **Pi Agent como agente de programação**, inicialmente controlado por **RPC**. A proposta se inspira no princípio do Devin Fusion: usar modelos relativamente baratos para executar trabalho delimitado e modelos mais capazes para atividades críticas, sobretudo revisão. Não pretende reproduzir toda a arquitetura interna do Devin.

As skills atuais continuam sendo a **fonte das regras de engenharia**, enquanto o orquestrador administra sessões, transições, retomadas, escolha de modelos e interrupções. As decisões, os planos, o progresso, os relatórios e as revisões continuam persistidos em arquivos e no Git, e não apenas no histórico das conversas.

O projeto começa pequeno: automatizar **uma task completa da skill `implement`** antes de abranger marcos inteiros e, depois, as demais skills.

## 2. Workflow existente e responsabilidades

Repositório das skills: <https://github.com/luthiano0312/my-skills> (`.agents/skills/`).

| Skill | Função atual | O que preservar |
| --- | --- | --- |
| `grill-me` | Entrevista o usuário, uma pergunta por vez, explora lacunas e consolida decisões. | O usuário toma as decisões de produto; entrevista interativa. |
| `docs` | Transforma decisões e necessidades em requisitos, design, ADRs e documentação padronizada. | Fontes de verdade claras, estrutura documental, referências/templates e gestão contínua. |
| `plan` | Lê documentação e código; propõe um **marco de cada vez**, com tasks e dependências, após aprovação. | `plano.md`, `registro.md`, IDs estáveis, `Fazer`, `Não alterar`, `Entregáveis`, `Critério de conclusão`, baseline Git e aprovações de escopo. |
| `implement` | Executa uma task por vez; implementa, revisa de modo independente, corrige e registra a conclusão. | Isolamento dos papéis, auditoria independente, evidências persistidas, scripts de controle, limites de correção e regras de escopo. |

O `registro.md` já possui estados definidos: `não iniciada`, `em andamento`, `aguardando revisão`, `em correção`, `pausada`, `concluída` e `substituída`. O avanço depende de condições verificáveis, não apenas de uma declaração do agente.

Na `implement`, **implementador, revisor e corretor usam conversas separadas**. O revisor primeiro avalia código e evidências filtradas, persiste a avaliação independente e **só depois** lê os relatos anteriores. Os scripts `review_inputs.py` e `update_registro.py` já ajudam a impor esse contrato. Uma task admite até **três correções completas e quatro revisões**; sem convergência, é pausada e encaminhada à `plan`. Achados `bloqueador` ou `importante` impedem a conclusão; `melhoria opcional` não impede.

## 3. Workflow automatizado pretendido

1. **Definição do marco:** usuário usa `grill-me`/`docs` conforme necessário; `plan` propõe recorte e tasks. O usuário aprova o `plano.md` e autoriza o início do marco. O baseline (plano, registro e mapa de caminhos) deve estar versionado.
2. **Branch de marco:** criar `marco-01` (exemplo), a partir da base aprovada. O trabalho não é integrado diretamente à `main`.
3. **Branch por task:** para cada task elegível, criar branch própria **a partir do estado atualizado de `marco-01`**.
4. **Implementação:** iniciar Pi Agent em sessão/processo isolado, com a skill `implement` no papel implementador; usar preferencialmente modelo mais barato. Executar verificações e persistir relatório.
5. **Revisão:** iniciar **nova sessão independente** do Pi no papel revisor, preferencialmente com modelo mais capaz. Preservar as duas fases da revisão e os filtros contra influência dos relatos anteriores.
6. **Correção e reauditoria:** se houver achados obrigatórios corrigíveis, notificar o usuário e iniciar automaticamente nova sessão de correção (preferencialmente modelo barato), seguida de outra revisão independente (modelo mais capaz). Respeitar limites existentes. Relatar **todo achado** ao usuário, mesmo quando a execução puder continuar; notificar não significa necessariamente pausar.
7. **Conclusão da task:** somente depois da aprovação técnica e das verificações Git, realizar os commits exigidos pela política da skill, integrar a branch da task em `marco-01` e sincronizar remotamente por operações controladas. A conclusão e o vínculo Git devem ser registrados corretamente.
8. **Próxima task:** repetir sequencialmente, sempre tomando a branch do marco já atualizada como base. **Se uma task tiver problema obrigatório não resolvido, parar o marco inteiro**, mesmo que as tasks seguintes sejam independentes.
9. **Homologação:** depois de todas as tasks do marco concluídas, o usuário testa e **aprova ou reprova o marco completo** na branch `marco-01`.
10. **Se aprovado:** integrar `marco-01` na `main` somente após autorização humana explícita.
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

Uma pausa deve preservar branch, alterações, relatório, achados, registro e informações suficientes para retomar sem reiniciar desnecessariamente.

## 5. Estratégia de modelos e contexto

- **Implementador / corretor:** modelo barato por padrão.
- **Revisor / reauditor:** modelo mais inteligente por padrão.
- **Grill-me / plan:** inicialmente podem continuar em modelos mais capazes, pois envolvem ambiguidade e decisões difíceis.
- **Docs:** possível experimentação com geração barata e revisão inteligente, sem definição final.

A distribuição é uma **hipótese a validar**, não uma garantia de economia. Medir custo, tokens, latência, qualidade e número de rodadas. Cada papel deve carregar apenas as instruções, fontes e arquivos pertinentes, em sessão independente; o histórico conversacional de outro papel não deve ser transferido ao revisor. Os artefatos em disco/Git funcionam como contratos de handoff.

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

O usuário quer **sincronização com o GitHub durante o marco**, para acessar o trabalho de diferentes ambientes. Não deseja confiar ao agente credenciais Git amplas nem comandos arbitrários capazes de alterar a `main`.

Será criado um **Git Gateway**, com operações específicas e verificadas (a API concreta ainda será projetada), possivelmente para criar branch do marco, criar branch de task, registrar commits, publicar task, integrar task no marco e publicar o marco. O orquestrador pede operações; o Gateway valida estado, branch permitida, ancestrais, conteúdo, aprovações e atualizações concorrentes antes de executá-las. Sem `force push`, exclusão arbitrária ou push para `main` no conjunto de ferramentas do agente.

**Limitação reconhecida:** se Pi, OpenClaw e Gateway rodarem com a mesma conta e credenciais acessíveis no Windows, um wrapper de ferramentas **não constitui barreira de segurança forte**. Separar credenciais remotas do Pi, aplicar proteções/rulesets no GitHub e testar num repositório descartável. Isolamento forte (usuário de sistema separado, contêiner ou máquina dedicada) fica para uma etapa futura. O Gateway não deve executar scripts não confiáveis do projeto com privilégios de credenciais.

A autorização inicial do marco pretende cobrir a execução e operações Git rotineiras **limitadas às branches autorizadas**. Push/integração final na `main` exige aprovação específica. Ainda é necessário formalizar o alcance exato das autorizações intermediárias e reconciliá-lo com as regras atuais de commits da `implement`.

## 7. Ambiente e ferramentas escolhidas

| Componente | Decisão |
| --- | --- |
| Sistema operacional inicial | **Windows 11 nativo**; sem Docker/WSL2/servidor remoto no MVP. |
| Orquestrador | **OpenClaw**. |
| Executor de programação | **Pi Agent**, controlado por **RPC**. |
| Papéis e regras | Skills existentes em `my-skills`, sobretudo `implement`. |
| Controle de versão | Git local + GitHub remoto. |
| Operações Git privilegiadas | Futuro **Git Gateway** com funções limitadas. |
| Persistência do workflow | `plano.md`, `registro.md`, relatórios, revisões, branches/commits e metadados adicionais mínimos de orquestração. |
| Modelos | Barato para execução/correção; mais capaz para revisão; fornecedores/modelos ainda não escolhidos. |

Windows nativo facilita depuração e integração inicial, mas apresenta **isolamento fraco**. Não executar primeiro em repositórios importantes nem supor que comandos de terminal estejam restritos só por instruções de prompt.

## 8. Mudanças necessárias em relação às skills atuais

**Preservar:** contratos de artefatos, estados existentes, `review_inputs.py`, `update_registro.py`, freio de escopo, revisão independente em duas fases, três correções/quatro revisões, replanejamento e decisões humanas sobre requisitos.

**Adaptar, com mudanças mínimas e verificadas:**

1. Na `implement`, substituir a exigência de invocação manual a cada papel pela possibilidade de **despacho automático de novas sessões/processos RPC isolados**, sem compartilhar contexto entre papéis. A proibição atual de “usar subagentes” precisa ser reinterpretada em termos do isolamento exigido, não simplesmente removida.
2. Alterar a política de integração: task revisada deixa de seguir diretamente para `main`; seu destino passa a ser **a branch do marco**. Manter evidências, os dois commits da task (funcional e de metadados) ou deliberar uma mudança de contrato com migração/testes.
3. Definir o **alcance da autorização concedida ao iniciar o marco**, em substituição às solicitações manuais de autorização por task/commit. Preservar autorização humana para integração na `main` e ações sensíveis.
4. Definir resultados estruturados do executor e eventos operacionais para o orquestrador saber quando continuar, notificar, bloquear ou retomar, sem confiar apenas em mensagens livres.
5. Criar integração segura com o Git Gateway e verificações de branch/ref/concorrência. Não dar ao Pi acesso a uma credencial remota irrestrita.
6. Definir o tratamento da **reprovação na homologação**: feedback → `docs` (se mudar requisito/design) → `plan` → novas tasks/ajustes aprovados → execução, preservando histórico.
7. Persistir informações adicionais estritamente necessárias à retomada do orquestrador, evitando duplicar o `registro.md` como fonte de verdade.

**Não fazer agora:** reescrever as quatro skills, alterar estruturas de documentos sem necessidade, introduzir execução paralela ou criar um framework genérico de agentes.

## 9. Etapas sugeridas de implementação do projeto

1. **Prova de integração:** instalar/verificar OpenClaw e Pi no Windows, iniciar Pi por RPC, enviar tarefa simples, acompanhar resultado e encerrar processo. Sem commits nem repositórios reais.
2. **Isolamento entre papéis:** executar implementador e revisor em processos/sessões distintos; validar as restrições de contexto da revisão.
3. **Orquestração de uma task:** ler plano/registro, executar implementador → revisor → corretor → revisor, registrar resultados, pausar corretamente nos gates.
4. **Git Gateway mínimo:** criar/publicar branches autorizadas, realizar os commits esperados, integrar task na branch do marco e sincronizar remotamente. Testar restrições e falhas em repo descartável.
5. **Automação do marco:** repetir tasks sequencialmente, reportar achados, respeitar interrupções e oferecer homologação final.
6. **Expansão posterior:** reiniciar ciclo após reprovação, integrar melhor `plan`/`docs`/`grill-me`, avaliar políticas dinâmicas de modelos, custos e eventual isolamento mais forte.

## 10. Pendências a decidir/testar

- Modelos e provedores concretos; medição real de economia e qualidade.
- Contrato de saída estruturado do Pi por papel, notificações e protocolo de retomada.
- Orçamento por task/marco, tempos máximos, recuperação de falhas e política de retry técnico.
- Interface exata do Git Gateway; identidade/autenticação GitHub; proteção de branches e verificação de permissões no Windows.
- Forma de preservar o baseline do marco, os commits de metadados e os vínculos após integrações/squash.
- Política precisa para incorporação de feedback após homologação reprovada (mesmo marco versus novo recorte), com controle de IDs e histórico.
- Alcance da autorização inicial: operações locais/remotas permitidas, aprovação da publicação final e operações sensíveis.
- Verificação prática de que a integração OpenClaw → Pi RPC oferece o controle de sessão, eventos e cancelamento necessários.

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

**Referência principal:** <https://github.com/luthiano0312/my-skills>. Este documento registra **decisões e propostas de projeto**, não substitui as especificações detalhadas das skills e não autoriza alteração imediata em seus arquivos.
