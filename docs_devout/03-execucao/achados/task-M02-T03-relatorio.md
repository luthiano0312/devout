# M02-T03 — Relatório da implementação inicial

**Papel:** implementador. **Não é aprovação técnica nem revisão independente.**

## Contexto e gates de entrada

- Task consumida de `docs_devout/plano.md`: M02-T03, Role Runner implementador e validação de entrega; plano M02 aprovado em 2026-11-19.
- Checkout inicialmente limpo na `main`, HEAD `424ab041b9457fafd1edd854cc1a8984b0d14bdc`.
- Usuário autorizou explicitamente criar/usar `feat/m02-t03`, sem commits nesta etapa; implementação ocorreu nessa branch.
- Plano, mapa `AGENTS.md`, registro e configuração de fontes rastreados/commitados e sem mudanças pendentes no início. A M02-T03 estava `não iniciada`.
- Dependências confirmadas como concluídas no registro e no histórico: M02-T01 (`04ada41ac9727da535751f1c5a8be36d83bd66df` + `cf1d0701a9e268a327376925aa9ed94de70084e7`) e M02-T02 (`c0b6b6347ab1e785194dd07fd5c8b59bf447eea4` + `424ab041b9457fafd1edd854cc1a8984b0d14bdc`). Os pares são commit funcional + metadados, ancestrais do checkout.
- Registro desta task atualizado por `update_registro.py`, no workflow **manual de desenvolvimento do Devout**. Isso não é escrita do registro pelo orquestrador em teste: os registros fictício e Devout foram comparados antes/depois do smoke e permaneceram intactos durante a execução Pi.
- Ambiente conferido: Windows nativo, Node v24.20.0, npm 11.19.0, Pi 1.5.2 (`C:\Users\User\.pi\agent\bin\pi.cmd`), OpenClaw 2026.11.3. Não foi necessário Gateway nesta task.

## Arquivos alterados/criados

| Arquivo | Alteração |
| --- | --- |
| `src/role-runner.mjs` | Papel `implementador`, aprovação separada, revalidação pré-spawn sob lease, contexto selecionado, persistência e resultado de papel após gate de entrega; CLI `--approval`. Papel `test` preservado. |
| `src/implementation-delivery.mjs` | Contexto do implementador, inventário de bytes/metadados Git, relatório estruturado, conferência de escopo/diff/teste/processo e identidade da entrega. |
| `src/test/helpers/implementation-fixture.mjs` | Preparação confiável de task fictícia aprovada com código, teste e caminho de relatório autorizado; escritor de relatório sintético para testes. |
| `src/test/fixtures/implementation-rpc.mjs` | Subprocesso RPC falso, com alteração/teste/relatório reais na fixture. |
| `src/test/implementation-runner.test.mjs` | 43 testes novos de admissão, entrega, violações, concorrência e integração CLI/Driver/lease/processo falso. |
| `src/test/smoke-implementer.mjs` | Smoke opt-in com implementador Pi real; teste independente, registro/HEAD/refs/branch intactos, CIM e readquisição da lease. |
| `src/package.json` | Comando opt-in `test:implementer`, sem dependências adicionais. |
| `src/IMPLEMENTER.md` | Contrato de entrada, autoridade, relatório, diferenças frente à skill manual, persistência, gate, recusas e limites. |
| `src/README.md`, `src/ROLE-RUNNER.md`, `src/ENGINEERING.md` | Links, comando novo e distinção entre perfil/papel de teste e implementador controlado. |
| `docs_devout/03-execucao/registro.md` | Estados/evidências manuais desta task via script oficial. |
| Este relatório | Evidências da implementação inicial, antes da revisão. |

Sem alterações em `.agents/`, `prototipo/`, contrato, HLD, ADRs, plano ou seleção de fontes. Sem nova dependência, serviço, WSL/Docker, shell variável, transição oficial automatizada ou commit.

## O que foi feito

### Entrada e execução

- O Runner aceita `role: "implementador"` somente com `configured-engineering`, parâmetros estritos existentes e `taskInputId` da pré-validação M02-T02. `prompt`/`expectedText` arbitrários não são aceitos nesse papel.
- A aprovação humana é uma opção **separada** de `runRole`, não um campo da configuração Pi. A CLI exige `--approval` com arquivo preparado pelo controlador; não autentica uma identidade humana nem aceita saída do modelo como aprovação.
- O gate M02-T02 é repetido antes de persistir/iniciar e novamente após adquirir a lease. Divergência de hash/refs/estado/baseline bloqueia sem spawn. O prompt selecionado é limitado antes de lançar Pi.
- O prompt transmite somente a entrada pública da task, área permitida e referências locais necessárias de código/teste, mais instruções do perfil. Não transmite mapa, plano inteiro, registro/Observações ou narrativas de outras tasks.
- A diferença em relação à skill manual é explícita: não atualizar registro, mudar branch, escrever Git, fazer commits, revisar ou corrigir. A skill manual e suas invocações não foram alteradas.
- Um único Pi usa o Driver, os controles de cancelamento, os estados de processo e a lease global existentes. Não há retry automático nem segunda sessão.

### Gate objetivo da entrega

- Só roda depois de `lease.finish()`: exige término confirmado, liberação, trabalho normal sem erro/força/cancelamento e exit code zero.
- Captura bytes dos arquivos e de toda a árvore `.git` antes do lançamento. Após o término, confere refs/HEAD, index/config/hooks/reflogs/objetos e arquivos, inclusive não rastreados/ignorados. Detecta commit seguido de reset pelos metadados restantes, sem fazer rollback.
- Compara a lista de mudanças reais com a lista autorizada humana e com o diff Git (sem ext-diff/textconv/renames). Proteções da M02-T02 impedem autorizar mapa/plano/registro/marcador. Nomes inseguros/privados e links/hardlinks bloqueiam.
- Exige relatório novo autorizado, com título da implementação inicial e seções de arquivos, trabalho, comandos/testes, entregáveis, critério, pendências e evidências estruturadas. JSON do relatório deve identificar baseline/input e todos os arquivos mudados além do próprio relatório.
- Exige ao menos uma alteração de código/artefato além do relatório; teste `node --test` declarado aprovado e recibo de início/fim correlacionado sem erro. Relato/`agent_settled`/resposta textual isolados não passam.
- Releitura final invalida mudanças detectadas durante a inspeção. Identifica entrega por hashes do relatório, diff e arquivos, incluindo novos/excluídos.
- `delivery.json` e `result.json` distinguem gate, resultado técnico e `roleOutcome`. `completed` é conclusão estrutural **do papel**, sempre `taskApproved:false`, nunca task oficial `concluída` ou aprovação técnica.

## Comandos e testes

Comandos executados da raiz; via PowerShell para resolver `npm.cmd` no PATH Windows do host.

| Comando/checagem | Resultado |
| --- | --- |
| `node --check src/implementation-delivery.mjs` e `node --check src/role-runner.mjs` | Sintaxe corrigida durante a implementação; código final carregado/testado pela suíte. |
| `node --test --test-concurrency=1 src/test/implementation-runner.test.mjs` (primeira execução completa, antes dos 2 testes finais) | 40/41; fixture RPC falsa omitia `aborted:false`, logo o Driver corretamente não comprovou trabalho completo. Corrigido o fixture, sem enfraquecer o gate/Driver. |
| `node --test --test-name-pattern='literal fake RPC' src/test/implementation-runner.test.mjs` | 1/1 após corrigir o fixture; CLI/Driver/lease reais com subprocesso falso. |
| `node --test --test-name-pattern='raw byte\|mutation during' src/test/implementation-runner.test.mjs` | 2/2: normalização de checkout incoerente com diff e mutação durante leitura do relatório são recusadas. |
| `npm.cmd --prefix src test` (primeira tentativa) | Novos 43 testes passaram, mas a regressão preexistente `Windows: invalid-resistant is a failure, but bounded cleanup proves tree exit` reportou `PROCESS_DESCENDANT_AMBIGUOUS`; o processo da suíte não encerrou e o comando excedeu 1000 s. Não é um resultado global aprovado. |
| Conferência de processos CIM + `inspectPiLock()` após o timeout | Nenhum processo Node de teste restante; somente os processos alheios/harness já existentes. Lease `free`, `canAcquire:true`. Nenhuma remoção manual de lock nem kill de PID antigo. |
| `node --test --test-concurrency=1 src/test/pi-lifecycle.test.mjs` | Reexecução isolada: **15/15**, sem falhas/skips; `invalid-resistant` confirmou encerramento nessa execução. Nenhuma mudança no código/testes de lifecycle. |
| `npm.cmd --prefix src test` (reexecução completa final) | **340/340**, 0 falhas/cancelamentos/skips, aproximadamente 738,7 s; inclui os **43** novos testes e os 297 existentes. |
| `npm.cmd --prefix src run test:implementer` | **Passou duas vezes**, sequenciais. Última execução após os ajustes finais do Runner/gate e a suíte final; detalhes abaixo. |
| `git diff --check` | Sem erros. |

Os testes novos cobrem aprovação ausente/desatualizada, relatório não autorizado/traversal, prompt injetado, perfil incorreto, revalidação sob lease, relatório ausente/incompleto/incoerente, teste sem recibo/falho declarado, entrega só de relatório, alteração/exclusão proibida, diretório extra, staging, commits/refs/commit seguido de reset, hook, credenciais fictícias, hardlink/junction, processo/lease incertos, força/RPC falho, diff bruto incoerente, mutação concorrente e subprocesso RPC real falso. Os commits usados em cenários negativos são ações **injetadas pelos testes em Git descartável**, não pelo Runner/Pi real nem no Devout.

### Evidências locais fora do repositório

- Primeira suíte específica: `C:\Users\User\AppData\Local\Temp\devout-m02-t03-tests.txt`.
- Primeira bateria interrompida: `C:\Users\User\AppData\Local\Temp\devout-m02-t03-full-tests.txt`.
- Repetição lifecycle: `C:\Users\User\AppData\Local\Temp\devout-m02-t03-lifecycle-repeat.txt`.
- Bateria final 340/340: `C:\Users\User\AppData\Local\Temp\devout-m02-t03-full-tests-repeat.txt`.
- Saída do último smoke: `C:\Users\User\AppData\Local\Temp\devout-m02-t03-smoke-final.txt`.

Não foram versionados logs operacionais, credenciais ou históricos Pi/OpenClaw.

## Smoke real final

**Data de início:** 2026-11-19T17:07:50.293Z. **Resultado:** `pass:true`.

- Evidências: `C:\Users\User\AppData\Local\Temp\devout engenharia espaço rlbkED`.
- Run: `run-5d2d0678-6581-413a-b6e4-95c1bebb02f0`.
- Entrada: `831f8b6fd0ffcfb89312e1c77369da775675a092cb06e1bc82226b4a3e59fc44`.
- Snapshot: `f70394eaff45dc1982959c3b303bd057f42c66cadc3b04c621b2ab1277666b8f`.
- Baseline da fixture: `97c7d55bf1949ebf60a868fd124fb7b1ada25af3`, branch `fixture`.
- Entrega: `f9aea86050d6b7665b523c903f33eff9c761e357156fe2aff19b40540e717c9c`.
- Runner PID 11016, exit 0; Pi controlado terminou normalmente, `processesGone:true`, `workCompleted:true`, sem força. CIM independente não encontrou os PIDs observados após término. Lease liberada, readquirida e liberada novamente.
- `value.mjs` passou de 1 para 2; `node --test` executado pelo Pi e repetido independentemente pelo controlador com sucesso.
- Relatório revisável: `workspace/docs/achados/task-M02-T02-relatorio.md`, SHA-256 `94aad5b1b28091d14e1949eff53f8692ff8a4ef4854e3ac65c207a71feaa5133`.
- Mudaram somente esse relatório e `value.mjs`; HEAD/refs/branch/registro da fixture e registro Devout ficaram intactos durante o ensaio, sem staging/commit.
- `technicalOutcome:succeeded`, `roleOutcome:completed`, `taskApproved:false`.
- A fixture usa o ID **fictício M02-T02**, não reabre nem executa a task oficial M02-T02 do Devout. Baseline/registro/código dessa fixture são dados sintéticos.
- `smoke-summary.json`, `fictional-diff.txt`, relatório e `operacional/runs/<runId>/` permanecem nesse temporário; não incluídos no Git.

## Entregáveis e critério de conclusão — conferência da implementação

- [x] Papel implementador reaproveita Runner/Driver, perfil de engenharia e entrada previamente validada.
- [x] Pi real modifica/testa fixture e persiste relatório estruturado revisável.
- [x] Contexto selecionado, sem envio indiscriminado do plano/registro.
- [x] Gate determinístico após término/liberação, coerência de relatório/artefatos/testes/Git e escopo verificável.
- [x] Testes falsos e reais, com relatório ausente, diff incoerente e alteração proibida, sem autovalidação técnica do código.
- [x] Sem instruções de atualização de estados/commits ao Pi, sem revisão/correção/reauditoria ou avanço automático.
- [x] Preservadas skill manual, `.agents/`, protótipos, contrato e arquitetura existentes.

Esta conferência é declaração do implementador, não parecer do revisor.

## Pendências e limites

1. **Revisão independente pendente em conversa nova.** A configuração atual preserva M02-T01/T02, mas ainda não contém seleção M02-T03. Preparar um recorte M02-T03 com autorização específica, atualizar mapa/configuração conforme o workflow antes da revisão; não reutilizar seleção T02 nem abrir fontes integrais como fallback. Esta implementação não ampliou o escopo para preparar esse recorte.
2. A falha intermitente de lifecycle da primeira bateria deve permanecer visível ao revisor; a bateria final passou, mas isso não demonstra que o evento inicial é impossível. Não se alterou essa área fora da task.
3. Verificações pontuais de bytes/metadados não são sandbox nem monitor de todas as ações transitórias. Mutação totalmente revertida sem vestígio pode não ser detectável. Ferramentas podem acessar dados da mesma conta; usar somente dados fictícios, sem segredos/credenciais Git amplas.
4. Lista humana de caminhos não infere proibições semânticas arbitrárias de `Não alterar`. Qualidade de código/testes e suficiência técnica do relatório pertencem à revisão independente; recibos/relato não a substituem.
5. Não há transição oficial automática, aprovação técnica de task, gate definitivo de entrada do revisor/T01 integral, coordenação de dois papéis, correção ou Git Gateway. Permanecem fora da M02-T03.
6. Nenhum commit, merge, push, avanço para M02-T04 ou conclusão oficial autorizado/realizado nesta conversa. Aguardar revisão e autorização explícita dos dois commits do workflow manual.

## Correção após revisão 1

**Papel:** corretor, em conversa nova. Referência: `task-M02-T03-revisao-1.md`, `Estado: finalizada`, Decisão final I1 (importante). Esta é a **correção 1**, não aprovação técnica. O relatório inicial e a revisão foram preservados.

### Entrada e escopo

- M02-T03 recebida em `em correção`, branch `feat/m02-t03`, HEAD `424ab041b9457fafd1edd854cc1a8984b0d14bdc`. Task completa, restrições comuns e dependências conferidas. Baseline M02 `9014b8b116bb6f2bfd3499d50aeef481bc44e7ec`, plano/mapa/registro/fontes rastreados e commits funcionais/metadados das dependências confirmados como ancestrais.
- Preservadas todas as alterações preexistentes da implementação e da preparação da seleção M02-T03. A pendência histórica de recorte no relatório inicial está superada pela seleção preparada na R1; não alterada nesta correção.
- Ambiente: Windows nativo, Node v24.20.0, npm 11.19.0, Pi 1.5.2 e OpenClaw 2026.11.3. Nenhum Gateway necessário.

### I1 tratado — evidência final de testes

| Arquivo modificado nesta correção | Tratamento |
| --- | --- |
| `src/role-runner.mjs` | Para o implementador, correlaciona IDs de início/fim e ordem de início; contabiliza execuções completas/pendentes e resultado da tentativa mais recente. Novo início invalida o passe anterior; fim atrasado de tentativa antiga não substitui a mais recente. IDs ausentes/reutilizados ou términos duplicados tornam a evidência não confiável. O papel `test` mantém o comportamento anterior. |
| `src/implementation-delivery.mjs` | Gate exige `testEvidence` confiável, pelo menos uma execução, todas concluídas, nenhuma pendente e resultado final `passed`, coerente com o relatório. O booleano acumulado antigo não basta. |
| `src/test/implementation-runner.test.mjs` | 13 regressões novas: passe→falha real, falha real→correção→passe, teste posterior pendente, pendência antiga, fins fora de ordem, término alheio/ferramenta errada, sucesso não explícito, IDs ausentes/repetidos, término duplicado e gate direto com booleano antigo/evidência inválida. Subprocessos da fixture removem somente `NODE_TEST_CONTEXT` do ambiente de teste para realmente executar os testes filhos. |
| `src/IMPLEMENTER.md` | Item 6 do gate documenta ordenação, pendências, correlação e recuperação por novo passe; resumo sem payloads/IDs em `observed.engineering.testEvidence`. |
| Este relatório e `docs_devout/03-execucao/registro.md` | Acréscimo de evidências e handoff pelo script oficial, sem apagar o histórico. |

O ciclo normal falha→correção→passe continua permitido. A validação permanece objetiva, sem segunda revisão técnica automática, atualização de estados pelo Pi, commits ou avanço de papéis.

### Comandos e resultados

Logs abaixo ficam em `C:\Users\User\AppData\Local\Temp\`, fora do repositório.

| Comando/checagem | Resultado |
| --- | --- |
| `node --check` para Runner, gate e teste modificado | Passou, inclusive na conferência final. |
| `node --test --test-concurrency=1 src/test/implementation-runner.test.mjs src/test/engineering-profile.test.mjs` (tentativa inicial) | Limite externo de 300 s interrompeu o comando; log parcial `devout-m02-t03-correction1-targeted.txt`, sem resultado global. Consulta CIM posterior não encontrou subprocessos de teste restantes. |
| `npm.cmd --prefix src test` (primeira bateria) | **351/353**, duas falhas nas novas fixtures de passe/falha real; não é aprovação. O filho herdava `NODE_TEST_CONTEXT` e retornava sem executar a suíte independente. Ajustado somente o helper local do teste para remover essa variável. Log `devout-m02-t03-correction1-full.txt`, duração 829948 ms. |
| `node --test --test-name-pattern='pass then real failure\|real failure then corrected pass' src/test/implementation-runner.test.mjs` (diagnóstico intermediário) | Reproduziu as duas falhas do helper e confirmou que os recibos ainda não correspondiam a execuções reais; antecedeu o ajuste de ambiente. |
| `node --test --test-name-pattern='implementation test evidence\|stale success boolean' src/test/implementation-runner.test.mjs` (após ajuste) | **13/13**, sem falhas/cancelamentos/skips; log `devout-m02-t03-correction1-regressions.txt`, duração 100719 ms. Passe→falha real bloqueou com `IMPLEMENTATION_TEST_UNCONFIRMED`; falha real→novo passe foi aceita; pendências bloquearam. |
| `npm.cmd --prefix src test` (bateria final) | **350/353**, zero cancelamentos/skips, duração 899498 ms. **Todos os 56 testes do implementador passaram**, assim como o perfil de engenharia. Três falhas legadas descritas abaixo; não declarar suíte global verde. Log `devout-m02-t03-correction1-full-final.txt`. |
| `git diff --check` e conferência de whitespace dos novos arquivos alterados | Sem erros de whitespace; avisos normais de normalização LF/CRLF nos arquivos novos. |
| `npm.cmd --prefix src run test:implementer` | **Não executado nesta correção:** a bateria final deixou a lease global bloqueada. Não usar o smoke histórico como se fosse validação desta correção. |

### Impedimento de validação real e evidências preservadas

A bateria final falhou no teste legado `direct CLI / fake Pi / native lock: mismatch` (`src/test/role-runner.test.mjs:276`): o Runner terminou em `uncertain`, com `RUNNER_FAILED`, `LOCK_PROCESS_UNCERTAIN` e `TERMINATION_FAILED`, sem recibo de término/liberação. O teste usa papel `test`, não o novo gate do implementador. As duas falhas seguintes (`independent cancel CLI -> active Runner -> identified fake Pi: stream/force`, `src/test/runner-cancel.test.mjs:301`) ocorreram na pré-condição `inspectPiLock().canAcquire`, agora falsa. Não houve mudança nesses testes nem no código de lease/lifecycle; não se afirma causa raiz resolvida.

- Run bloqueado: `run-a8c6be2c-65ed-4d8b-ac66-6e6dbcb7d99d`, Runner PID 12900.
- Fixture/artefatos preservados: `C:\Users\User\AppData\Local\Temp\devout runner espaço lRf1R7\operacional\runs\run-a8c6be2c-65ed-4d8b-ac66-6e6dbcb7d99d\`, incluindo `result.json`, `events.jsonl`, `state.json` e `control.json`.
- Inspeção preservada: `C:\Users\User\AppData\Local\Temp\devout-m02-t03-correction1-lock.json`: `status=blocked`, `canAcquire=false`, `canReconcile=false`, `reason=PROCESS_TREE_UNCERTAIN`, proprietário ausente, fase `uncertain`, sem identidade de processo persistida.
- CIM não encontrou subprocessos Node/cmd dos testes após a bateria, mas isso **não** é prova completa de árvore vazia. Não removi/editei a lease, não troquei sua raiz, não matei PIDs antigos nem forcei reconciliação.
- Conforme `src/PI-LOCK.md`, seção Reconciliação explícita, é necessária intervenção do operador: reinicialização real do Windows (não suspensão/hibernação), nova inspeção na mesma raiz e reconciliação explícita somente com `canReconcile=true` e token conferido. Depois, repetir suíte/smoke sequencialmente. Nenhum reboot automático autorizado ou executado.

### Handoff

I1 tratado no código e nas regressões, com **uma correção completa** e validação global/real ainda limitada pelo bloqueio acima. Devolver para **revisão independente R2 em conversa nova**, usando a seleção M02-T03 e registrando esse impedimento, sem aprovação herdada. A reauditoria e quaisquer novas execuções com lease devem respeitar a recuperação segura do ambiente. Sem commits, integração, push, conclusão oficial ou avanço para M02-T04.
