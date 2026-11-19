# M02-T02 — Relatório da implementação inicial

**Estado:** implementação entregue para revisão independente; este relatório não é aprovação.
**Data:** 2026-11-19.
**Branch:** `feat/m02-t02`, criada após autorização humana nesta conversa.
**HEAD do Devout:** `1955baab66842d356f105372b2c470350396de6d` (não alterado).
**Baseline do plano M02:** `9014b8b116bb6f2bfd3499d50aeef481bc44e7ec`, confirmado ancestral de HEAD.
**Dependências obrigatórias da M02-T02:** nenhuma.

## Gates de entrada

- Plano ativo aprovado, task completa com os quatro campos, linha M02-T02 inicialmente
  `não iniciada`, mapa e seleção de fontes existentes rastreados/versionados.
- Checkout inicialmente limpo; plano, mapa, registro e configuração sem pendências.
- Execução interrompida inicialmente para confirmar branch, pois o checkout estava na
  `main`. O usuário autorizou criar/usar `feat/m02-t02`; não houve edição na `main`.
- Registro alterado apenas por `scripts/update_registro.py`: `em andamento` após os gates;
  `aguardando revisão` somente depois de persistir este relatório.
- A implementação não é avaliação independente. A configuração preservada tem seleção
  M02-T01, não M02-T02. Nenhuma seleção foi ampliada pelo agente avaliado.

## Arquivos da entrega

| Arquivo | Alteração |
| --- | --- |
| `src/task-input.mjs` | Novo gate de entrada somente de leitura, seleção de task, aprovação do controlador, snapshot e revalidação. |
| `src/TASK-INPUT.md` | Contrato da API, fixture/mapa, aprovação, resultado/códigos, segurança e testes. |
| `src/test/helpers/task-fixture.mjs` | Preparação confiável de Git fictício, plano único, mapa e registro. |
| `src/test/task-input.test.mjs` | 102 testes de entrada/recusa/integridade/concorrência. |
| `docs_devout/03-execucao/registro.md` | Metadados manuais desta task via script oficial; não alterado pelo validador. |
| `docs_devout/03-execucao/achados/task-M02-T02-relatorio.md` | Este relatório inicial. |

Não foram alterados os módulos existentes, `package.json`, plano, mapa, seleção de
fontes, skills, protótipos ou documentos históricos. O wildcard da suíte existente
já inclui o novo arquivo de testes, sem mudar scripts/dependências.

## Implementação

- `validateTaskInput(request, approval)` recebe solicitação fechada e autorização
  separada do controlador confiável. ID/prompt/modelo não conferem aprovação. O hash
  da task inteira fixa os requisitos aprovados; baseline, branch e workspace têm de
  corresponder à solicitação. A área permitida é explícita e não vem do prompt.
- Reutiliza `validateEngineeringWorkspace` e seu ambiente Git restrito. Admite somente
  Git fictício local descartável em temporário, com marcador/política de teste,
  HEAD/branch exatos, sem remotes, credenciais conhecidas, links/config/hooks indevidos
  e sem mudanças iniciais. Não chama Runner, Pi, shell ou comandos recebidos do modelo.
- Localiza plano/registro pelas duas entradas Markdown do mapa vigente (`AGENTS.md`,
  fallback `CLAUDE.md`; ambos devem concordar quando presentes), sem inventar caminhos.
  Plano aprovado e tabela de dependências mantêm o formato atual de um plano por marco.
- Seleciona somente uma task, com ID único e quatro campos não vazios, ignorando
  fences na interpretação estrutural. Registro exige seis colunas, estados conhecidos,
  IDs únicos, marco coerente, commits completos e timestamp válido com fuso.
- Gate inicial aceita `não iniciada` com `Commit = -`. Retomadas sem prova de execução
  anterior são recusadas. Dependências exigem conclusão versionada e evidência Git:
  commit funcional + versão posterior do registro, ou vínculo integrado verificável
  após reescrita. Narrativas não são devolvidas.
- Rejeita área externa, traversal, aliases/dispositivos Windows, globs, arquivos de
  credenciais/históricos e cobertura dos mapas/plano/registro/marcador, inclusive por
  ancestral ou variante de caixa. Verifica tipos de caminhos e pais existentes.
- Snapshot SHA-256 de arquivos rastreados/index/config, com igualdade byte a byte dos
  arquivos aos blobs do index; não depende só de stat/status. Rejeita indicadores
  conhecidos de operação Git em curso. Confere leituras selecionadas e repete snapshot
  e admissão ao final. Mudança concorrente é recusada sem desfazê-la.
- `inputId`/`snapshotId` vinculam entrada, requisitos, Git e área permitida.
  `revalidateTaskInput` repete o gate e recusa entrada antiga, inclusive quando uma nova
  autorização de baseline ou área seria válida por si só.
- Resultado estruturado separa `input` público, hashes/metadados para o controlador e
  leitura do estado oficial. Recusas retornam código sem stderr, caminhos ou conteúdo
  de exceções. Sempre `taskApproved:false`: admissão não é resultado técnico do papel,
  aprovação técnica, conclusão oficial ou autorização de commits.

## Testes e resultados próprios

Ambiente: Windows nativo (`process.platform = win32`), Node `v24.20.0`, npm `11.19.0`,
Git `2.55.0.windows.5`. Sem instalação de dependências e sem provedor/Gateway/Pi real.

| Comando/verificação | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 src/test/task-input.test.mjs` (primeira execução) | 90/90 passaram, zero skips, antes da ampliação de cobertura. |
| `npm.cmd --prefix src test` (execução final, inclui os testes novos) | **282/282 passaram**, zero falhas/cancelados/skips, aproximadamente 330 s. São 180 testes existentes e 102 novos. |
| `git diff --check` | Sem erros de whitespace nos arquivos rastreados alterados. |
| `git -c core.autocrlf=false diff --no-index --check -- /dev/null <arquivo-novo>` para os quatro arquivos novos em `src/` | Sem erros de whitespace; status 1 indica diferença de arquivo novo no modo no-index. |
| Branch, HEAD e status final conferidos | `feat/m02-t02`; HEAD preservado; apenas os arquivos desta entrega pendentes. |

Cobertura nova inclui task válida/ausente/duplicada, quatro campos ausentes/vazios,
plano não aprovado, exemplos fenced, registro incompatível/duplicado e datas inválidas;
solicitação divergente e falsa aprovação por ID/prompt; estados iniciais recusados;
dependência pendente/sem ancestralidade e vínculo integrado válido/inválido; Git staged,
unstaged, ignorado/não rastreado (admissão reutilizada), HEAD/branch divergentes, commit
indevido, remotes, credenciais, flags do index e operações Git em curso; mapas/artefatos
ausentes, fallback/ambiguidade, caminhos externos e junction; área de mudanças protegida;
entrada antiga e ausência de vazamento de Observações/históricos.

Nos testes estáveis, hash recursivo de bytes do workspace **incluindo `.git`**, mais
HEAD/branch antes/depois, comprova ausência de escrita do validador. As fixtures e commits
são preparados pelo harness antes das chamadas; não são commits de Devout ou do workflow.
Três testes injetam deterministicamente mudanças durante leituras e no fechamento da
admissão: retornam `CONCURRENT_CHANGE`, preservam a mudança concorrente e o registro,
sem rollback. A chamada válida produz IDs verificáveis/estáveis, que a revalidação aceita;
apenas a task selecionada aparece em `input`, sem os marcadores de narrativas privadas.

## Entregáveis e critério de conclusão

- **Validador e contrato estruturado:** implementados nos arquivos listados.
- **Casos positivos e negativos exigidos:** executados no Windows em Git descartável;
  inclusão automática na suíte existente, sem antecipar Role Runners dos próximos IDs.
- **Entrada identificável e verificável:** IDs SHA-256 e revalidação cobertos por testes.
- **Recusa antes de Pi, sem mutação de arquivos/registro/branch:** API não inicia Pi;
  comparações byte a byte e testes de concorrência passaram.
- **Estado oficial versus resultado técnico:** somente leitura de `official`, admissão
  `accepted` separada e `taskApproved:false`; nenhuma transição automática.

Estas são declarações da implementação a confrontar pelo revisor, não aprovação herdada.

## Limites e pendências

- **Revisão independente pendente, em conversa nova.** Antes dela, o usuário deve
  autorizar preparação e versionamento do recorte específico M02-T02 em
  `docs_devout/03-execucao/fontes-revisao.json`. Não usar seleção M02-T01, plano inteiro,
  relatório ou diff irrestrito como fallback de entrada inicial.
- Nenhum commit do Devout realizado, nenhuma task seguinte iniciada. Os dois commits
  oficiais dependem de revisão aprovada e autorização humana específica.
- Não é sandbox nem prova semântica de aprovação humana, ausência universal de segredos,
  segurança de JavaScript ou interpretação automática de proibições em texto livre.
  O controlador deve manter aprovação/área permitida fora do alcance do modelo.
- Snapshots são verificações pontuais, não isolamento atômico contra escritor hostil.
  Revalidar após a lease e antes do futuro lançamento continua obrigatório; este módulo
  não implementa esse lançamento nem a coordenação das próximas tasks.
- Fixture deliberadamente estreita: rótulos de mapa/Markdown documentados, bytes do
  checkout iguais aos blobs, sem conversão de EOL/filtros; somente gate inicial.
  Histórico de dependência limitado a 64 mudanças do registro; falta de prova bloqueia.
- Smokes reais não foram executados: M02-T02 não altera Driver/Runner/processos nem
  requer Pi; a suíte de regressão completa usa os processos fictícios existentes.

## Correção após revisão 1

**Referência:** [task-M02-T02-revisao-1.md](task-M02-T02-revisao-1.md),
`Estado: finalizada`, Decisão final: alterações necessárias, **R1-I01 (importante)**.
**Rodada:** primeira correção completa; reauditoria R2 pendente em conversa nova.
Esta seção relata a correção, não aprova a task nem substitui a revisão independente.

### Gates e preservação

- Task M02-T02 conferida nos quatro campos do plano aprovado, sem dependências
  obrigatórias. Registro recebido em `em correção`, R1 finalizada e relatório inicial
  presentes; nenhuma correção anterior, sem abertura de quarta rodada ou reset.
- Branch mantida em `feat/m02-t02`; HEAD preservado em
  `455c2b4e45cc40351a46b76bb06c51ae3a7218bd`. Baseline M02
  `9014b8b116bb6f2bfd3499d50aeef481bc44e7ec` confirmado ancestral; plano, mapa,
  registro e seleção rastreados/versionados, sem pendências em plano/mapa/seleção.
- Preservados os arquivos da entrega inicial, a revisão R1 e as observações anteriores.
  A indicação preexistente de alteração em `docs_devout/03-execucao/planos/marco-M01.md`
  não foi editada, normalizada ou revertida. Nenhuma alteração em outras tasks,
  skills, protótipos, requisitos, arquitetura ou módulos de runtime existentes.

### Achado tratado e arquivos modificados

**R1-I01 — refs/commit lateral invisíveis à aprovação e ao snapshot:**

| Arquivo | Correção |
| --- | --- |
| `src/task-input.mjs` | `approval.refsHash` obrigatório; captura SHA-256 semântica de todas as refs enumeradas e HEAD, vinculada ao snapshot e aos IDs; comparação com aprovação confiável, repetição no snapshot final e última conferência após a admissão final. |
| `src/test/helpers/task-fixture.mjs` | Preparação confiável captura `refsHash` do Git revisado e o atualiza somente quando o harness aprova explicitamente um novo baseline. |
| `src/test/task-input.test.mjs` | 15 regressões novas; helper de integridade também confere revalidações, sem escrita em quaisquer bytes da fixture. |
| `src/TASK-INPUT.md` | Contrato do novo campo obrigatório, função de preparação `taskGitRefsHash`, política exata de refs permitidas, fórmula semântica, novo código e cobertura. |
| `docs_devout/03-execucao/achados/task-M02-T02-relatorio.md` | Esta seção, preservando o relato inicial. |
| `docs_devout/03-execucao/registro.md` | Devolução manual para `aguardando revisão` via atualizador oficial, somente após persistir este relato. |

A política permite refs preexistentes **somente** dentro do conjunto explicitamente
revisado, fixado por `approval.refsHash`; não aceita novas refs capturadas em uma segunda
chamada como se fossem previamente aprovadas. Inclui nome/objeto/destino simbólico de
todas as refs enumeradas, o destino simbólico direto de HEAD e seu commit resolvido.
A representação não depende de refs soltas versus compactadas. Tags anotadas fixam o
objeto da tag, não apenas o commit apontado. O hash confiável não é recalculado pelo
validador para acomodar divergências.

Divergência inicial resulta em `GIT_REFS_MISMATCH`; alteração durante a inspeção é
`CONCURRENT_CHANGE`. Mesmo após reaprovação explícita das refs pelo controlador,
a entrada anterior é recusada com `SNAPSHOT_MISMATCH`. O validador permanece somente
de leitura e não cria Pi, commits, rollback ou transições do registro da fixture.

### Testes/comandos executados e resultados

Ambiente Windows nativo, Node `v24.20.0`, npm `11.19.0`, Git `2.55.0.windows.5`.

| Comando/verificação | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 --test-name-pattern='refs\|HEAD stable\|side commit\|symbolic\|annotated\|reapproved' src/test/task-input.test.mjs` | **15/15 aprovados**, zero falhas/cancelados/skips, duração 63043,6992 ms. |
| `npm.cmd --prefix src test` | **297/297 aprovados**, zero falhas/cancelados/skips, duração 385521,9302 ms; inclui os 117 testes do validador e as 180 regressões existentes. |
| Reprodução executável da Decisão final R1, via `node --input-type=module` em fixture temporária | Entrada inicial aceita; após `commit-tree` e `update-ref refs/heads/unapproved`, revalidação recusada: `accepted:false`, `reason.code:GIT_REFS_MISMATCH`, `input:null`, HEAD inalterado e status vazio. Fixture removida ao final. |
| `git diff --check` | Sem erros; apenas aviso preexistente LF/CRLF do plano M01 arquivado. |
| `git -c core.autocrlf=false diff --no-index --check -- /dev/null <arquivo>` para os quatro arquivos de código/testes/contrato em `src/` | Sem erros de whitespace. |
| `git status --short`, `git rev-parse HEAD`, branch e versões | Mesmo HEAD/branch, nenhum commit Devout ou arquivo fora do recorte alterado nesta correção. |

As regressões cobrem criação, movimentação e remoção de branches/tags com HEAD estável,
commit lateral, refs aprovadas versus não aprovadas, aprovação ausente/inválida/divergente,
reaprovação que não revive inputId antigo, compactação de refs sem alteração semântica,
objeto de tag anotada e destinos simbólicos com o mesmo commit resolvido. Dois escritores
injetados após as capturas de refs inicial/final comprovam recusa sem rollback, preservação
do registro/HEAD/branch e ausência de outras escritas pelo validador.

### Handoff e limites

- **Uma correção completa; próxima etapa: reauditoria R2 independente em conversa nova**,
  começando pelo preparador e pela seleção M02-T02 existente, antes deste relato/diffs
  adiados. Não foi exercido o papel de Revisor nesta conversa.
- Nenhum commit autorizado/executado, nenhuma conclusão oficial ou próxima task iniciada.
  Os dois commits continuam condicionados à revisão aprovada e autorização humana.
- Permanecem os limites pontuais do snapshot: sem trava atômica/sandbox contra escritores
  hostis, sem hash de reflogs/objetos inalcançáveis/metadados transitórios. Isso não permite
  ignorar refs divergentes já presentes na inspeção. O controlador deve guardar a aprovação
  fora do modelo e revalidar após a lease e antes do futuro handoff.
- Sem smoke Pi/provedor/Gateway real: esta correção é de inspeção Git somente de leitura;
  a suíte completa exercitou as regressões Windows existentes com processos fictícios.
