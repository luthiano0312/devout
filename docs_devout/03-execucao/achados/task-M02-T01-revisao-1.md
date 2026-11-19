# Revisão M02-T01 — rodada 1
Estado: finalizada
Snapshot da entrega: 26f290f9d65810f8ed06cd899c0fe4c2da56a509bc9a483d1fafbc5b70cf5530
Entrada: 3b970900cfe37d070e0acd71cf2dc55e5ea8022235ebd7616b8adb0c3d3cf2c1; revisão Git: b96fba3397be05ddbef878719556366ba691ccd4

## Identificação da entrada

Entrada filtrada preparada antes de plano integral, Observações, relatos e diffs adiados, em `C:\Users\User\AppData\Local\Temp\devout-M02-T01-review-input.json` (não versionar). Configuração: `docs_devout/03-execucao/fontes-revisao.json`, SHA-256 `8b2f4a5699bb3dc352f093d595742ec13b0c3005e0199f64f0b9c886e6f88b12`.

Hashes SHA-256 integrais das fontes recebidas:

| Fonte | SHA-256 |
| --- | --- |
| docs_devout/plano.md | c524fb2639aad2c17066856d774eb1d3183f8c90243c20dbdac5f59787ee6631 |
| docs_devout/02-design/contrato-orquestracao-mvp.md | d8656e9b2c521965f5778dd36d90912b4ae58d29bab9646f49da8e0700ef3e39 |
| docs_devout/02-design/arquitetura-hld.md | a6c47a06bf432b6a77a41960bccadef480ad330a0d5f953e485c78c64493d397 |
| docs_devout/01-requisitos/escopo.md | 50411d2be665e8bf704d08145caaa33fdfccfcc79bbf45abf69deb8a62c734c2 |
| AGENTS.md | b0775f72f1cd3a18731285b176219047e4be53f64189bab180046a12b25e0bce |
| src/package.json | c46153c746612511ef0d09ad6cbcb2e8dfd2ff4f967f5db07c8edba4a7f97ef2 |
| src/README.md | 10dc2edd3d03188e25c6f1fb99d57b63c2cb945317590076c1a4c3725ba22452 |
| src/ROLE-RUNNER.md | f2bfbe7773a61f22d269dcb5adb62e21c1073ce1af62abe30589c0376fc91b7a |
| src/PI-LOCK.md | 527f93092dcec93306b9200ab800658a488ea1159adbe3a4141b83cc0579560d |
| src/OPENCLAW.md | 909705dfa67b3a0d8e9e618e6b1a26914407289c1ac485756c1126e4f3fdd7b0 |

## Avaliação independente

### Gate e escopo examinado

- Estado filtrado: `aguardando revisão`, commit `-`, sem revisões anteriores; rodada 1. M02-T01 não declara dependências obrigatórias.
- Branch `feat/m02-t01`; baseline `9014b8b116bb6f2bfd3499d50aeef481bc44e7ec` presente e ancestral de HEAD. Plano, registro, mapa e seleção rastreados; plano/mapa/seleção sem alterações pendentes. Registro intermediário não precisa estar limpo nesta revisão.
- Examinados diffs filtrados HEAD/unstaged de `src/pi-driver.mjs` e `src/role-runner.mjs` (staged vazio), contexto do Driver/Runner/lease, todos os cinco novos entregáveis permitidos, fontes normativas selecionadas e procedimento de diagnóstico. `src/README.md`, `src/ROLE-RUNNER.md`, demais fontes adiadas e relatos ficam para o confronto.
- Os novos entregáveis são `src/engineering-workspace.mjs`, `src/ENGINEERING.md`, `src/test/engineering-profile.test.mjs`, `src/test/helpers/engineering-fixture.mjs` e `src/test/smoke-engineering.mjs`. Nenhum arquivo do inventário indica mudança de implementação fora da task.
- `--check-input` reexecutado com a mesma configuração/entrada antes desta gravação: exit 0, identidade/snapshot preservados. `git diff --check` nos caminhos modificados de `src/`: exit 0.

### Checklist — Fazer, Entregáveis e Critério de conclusão

1. **Perfil fechado/separado:** Runner aceita somente `configured-isolated`/`configured-engineering`, mantém `role:test` e valida objeto `engineering` fechado. Driver usa linha literal `engineering`, ferramentas read/edit/write/bash, `--no-session` e flags explícitas para impedir descoberta automática de extensões/MCP/skills/templates/contexto. Prompt continua no stdin; não há comando/argv livre no launcher.
2. **Admissão Git fictícia:** valida caminho canônico sob temporário e fora do Devout/Git ancestral; marcador, baseline/branch, árvore/index limpos, ausência de remotes, configuração local permitida, hooks/metadados compartilhados, credenciais conhecidas, links e limites de tamanho. A validação precede aquisição/lançamento e é repetida após aquisição e no Driver. Ambiente remove overrides Git/SSH/tokens Git amplos, desativa configuração global/system e helpers/hooks. Política `node-test-only-v1` exige teste local e atestação do controlador, sem alegar prova semântica de JavaScript seguro.
3. **Controles preservados:** `artifactsRoot` mantém checagens de separação/canonicalização; execução usa lease/process-tree do M01 e término comprovado antes de liberar. Resultados continuam técnicos, com `taskApproved:false`, sem atualizar registro oficial.
4. **Aceitação/rejeição e compatibilidade:** testes cobrem perfil/política/caminhos/configuração rejeitados antes de adquirir/lançar, mutação após aquisição, lifecycle e recibos de ferramentas. Suíte inteira passa sem skips; smokes reais separados de engenharia e M01 passam.
5. **Alteração/teste reais:** smoke cria Git novo antes do Pi; Pi altera exclusivamente `value.mjs` de 1 para 2 e executa `node --test`. Recibo correlacionado sem erro, conteúdo/diff efetivos e reprodução independente do teste confirmados. HEAD/branch preservados, sem remotes, stage ou arquivos extras.
6. **Prova de encerramento:** smoke confirma Runner fechado, Job Object/identidades e consulta CIM sem processos restantes; término normal sem força; lease liberada e readquirida/liberada. Evidências operacionais fora do Git.
7. **Documentação:** `src/ENGINEERING.md` descreve interface, ferramentas, validação, atestações, comandos e limites. A ferramenta bash não é filtro de comandos; credenciais do provedor e arquivos acessíveis à conta Windows não são isolados. Verificação de todos os guias adiados ainda pendente da fase 2.

### Checklist — cada item de Não alterar

- **Não converter Runner em serviço residente:** preservada execução temporária de um papel/prompt, com encerramento existente; nenhum serviço/HTTP/IPC novo.
- **Não permitir comandos livres no launcher:** apenas linha literal selecionada por perfil; solicitação não aceita shell/command/tools/argv. Consultas Git internas usam execFileSync sem shell e argumentos fixos.
- **Não ampliar para repositórios reais/privados:** admissão restrita a temporário local marcado e baseline declarado; fixtures novas e fictícias. Marca/atestação não detecta todo conteúdo real: limite explicitado, não autorização para uso real.
- **Não conceder acesso remoto Git:** nenhum remote aceito e nenhuma operação remota introduzida; overrides/helpers desabilitados. Não se afirma bloqueio hostil de rede do Windows.
- **Não executar commits/push:** produção Driver/Runner só consulta Git; o único commit introduzido está no preparador confiável de fixture nova, antes do Pi, para produzir o baseline exigido. Nenhum commit da alteração do agente ou do Devout; HEAD preservado no smoke.
- **Não tratar diretório marcado como sandbox:** módulo, instruções e guia explicitam ausência de isolamento forte e de garantia contra acessos indiretos. Bash e testes arbitrários continuam dependentes da confiança/atestação fictícia.

### Validações próprias — Windows nativo, 2026-11-19

Ambiente: Node `v24.20.0`, npm `11.19.0`, Pi `1.5.2`, OpenClaw `2026.11.3 (847611d)`.

- `npm.cmd --prefix src test`: **180/180 passaram**, zero falhas/skips; aproximadamente 155 s. Inclui processos fictícios, árvores Windows, lock global, Runner/cancelamento e os novos testes de engenharia.
- `npm.cmd --prefix src run test:engineering`: **pass=true**, run `run-cc77d989-a352-45b8-8893-f6ed601476cf`; quatro ferramentas iniciadas/finalizadas, `harmlessTestStarted/Succeeded:true`, alteração somente `value.mjs`, teste independente passou, HEAD/branch/registro preservados, sem remotes, `independentlyGone:true`, `reacquiredAndReleased:true`. Evidências: `C:\Users\User\AppData\Local\Temp\devout engenharia espaço hhmBXh\smoke-summary.json` e diretório operacional correspondente.
- `npm.cmd --prefix src run test:runner`: **pass=true**, run `run-6c6dd777-eabd-49b4-9a51-fd09b54f217d`; M01 isolado sem regressão, registro intacto, processos ausentes e lease readquirida/liberada. Evidências: `C:\Users\User\AppData\Local\Temp\devout-runner-smoke-WsD0rc\smoke-summary.json`.
- `npm.cmd --prefix src run test:smoke`: **pass=true**, settlement e marcador válidos, stdin aberto até settlement, zero diagnóstico/DEP0190, cinco processos observados, término normal comprovado.
- Smokes executados sequencialmente, somente após conclusão da suíte e liberação comprovada anterior; nenhum retry automático.

### Achados e conclusão preliminar

**Zero bloqueadores, zero importantes, zero melhorias opcionais identificadas.** A implementação examinada atende ao recorte M02-T01, sem exigir gates de workflow das tasks posteriores. Aprovação ainda depende do confronto integral dos relatos/fontes/diffs adiados; esta revisão permanece incompleta nesta gravação.

## Confronto com relatos

Fase 2 executada somente após persistir a avaliação independente acima, que foi preservada sem reescrita.

- Lidos integralmente o relatório inicial M02-T01 e as Observações do registro. Não há revisão anterior nem seção de correção: **zero correções completas**, rodada 1 coerente. Histórico de pausa/reconciliação preservado; retomada e branch correspondem aos metadados e commits conferidos.
- Conferidos todos os caminhos do inventário, incluindo documentos novos, e todos os conteúdos de `deferred_sections`: restante do plano, seções 12–13 do contrato, `src/README.md`, `src/ROLE-RUNNER.md`, `src/PI-LOCK.md` e `src/OPENCLAW.md`. Conferida a seleção M02-T01 da configuração vigente. Os guias históricos distinguem primitivas sem lease, perfil M01 e demonstração Gateway dos novos recursos de engenharia; não exigem antecipar M02-T02–T07.
- Consultados diffs integrais HEAD, staged e unstaged dos caminhos adiados/configuração/fontes/registro/relatório. Staged vazio; alterações adiadas limitam-se à linha M02-T01 do registro, referências/interface nos dois guias e comando em package.json. Plano, contrato, HLD, escopo, mapa, configuração e guias PI-LOCK/OPENCLAW não têm alterações pendentes. O relatório novo foi lido diretamente, pois não aparece em git diff. Nenhuma mudança alheia ou violação de escopo identificada.
- O relato de 180 testes finais e smokes aprovados é compatível com as reproduções próprias. Falhas iniciais de fixture foram registradas como falhas, com correções explicadas, não como sucesso; não envolveram Pi nem foram usadas como evidência de aceite.
- Consultados os resumos históricos das duas execuções de engenharia (`xIw8EI`, `LUTCDm`) e do M01 Runner (`NkljfR`), além de result/eventos/diff da execução final de engenharia. Identidades/runIds, quatro chamadas de ferramentas, settlement, árvore encerrada, HEAD/branch preservados e alteração exclusiva de value.mjs correspondem ao relatório. Esses artefatos históricos complementam, mas não substituem, a reprodução própria registrada na avaliação inicial.
- Constatada uma pequena desatualização documental no guia adiado README: ele ainda fala em duas linhas literais apesar do terceiro perfil. Isso acrescenta apenas a melhoria opcional O01 abaixo; não muda o resultado técnico preliminar.
- Antes do parecer final, `review_inputs.py` com a mesma configuração e `--check-input` voltou a sair com 0; input_id/snapshot/fontes da avaliação permanecem atuais. Consulta própria final de `inspectPiLock()`: `status:free`, `canAcquire:true`.

## Decisão final

**APROVAÇÃO TÉCNICA da M02-T01.** Zero bloqueadores, zero importantes; **uma melhoria opcional**, sem correção obrigatória. Rodada 1 finalizada; **zero correções completas**.

### O01 — melhoria opcional: atualizar contagem dos perfis literais no guia

- **Local/evidência:** `src/README.md:225–226`, seção “Lançamento .cmd e segurança”, ainda descreve “duas linhas literais fechadas” e enumera somente `default` e `isolated`; `src/pi-driver.mjs:27–30` agora contém também `engineering`.
- **Impacto:** detalhe documental desatualizado. A interface de engineering já está correta no início do README e em ENGINEERING.md; não há falha do launcher nem instrução insegura decorrente dessa contagem.
- **Recomendação opcional:** substituir a contagem/lista por três perfis (`default`, `isolated`, `engineering`) em oportunidade autorizada. O código e a documentação não foram corrigidos pelo revisor.

### Resultado e encaminhamento

Os entregáveis e o critério de conclusão da M02-T01 foram verificados, com checklist explícito de Não alterar. Suíte **180/180**, smoke real de engenharia e smokes reais M01 Runner/Driver passaram na revisão. Pi/Runner terminaram, lease ficou livre e foi readquirida/liberada; nenhuma alteração produzida pelo Pi foi commitada e os smokes preservaram o registro oficial.

A aceitação continua limitada a dados fictícios e host confiável: bash/testes não são filtrados semanticamente, o marcador não prova ausência universal de segredos e não existe isolamento forte no Windows. Nenhuma aprovação do workflow automatizado completo ou do T01 integral do MVP é declarada.

O pedido do usuário autorizou revisão, **não os dois commits**. Manter M02-T01 em `aguardando revisão`, acrescentando ao registro o vínculo desta revisão e “revisão aprovada; aguardando autorização dos commits”. Sem commit, correção de código, avanço para M02-T02, merge ou push. Uma autorização futura dos dois commits exige reconferir atualidade da entrega e do pacote narrativo antes de executá-los.
