# Revisão M01-T04 — rodada 1
Estado: finalizada
Snapshot da entrega: 577224d61efa9621b52bee3d0b1744a253a851c4779e370fd9bceb05d9fc0805
Entrada: 70374de36f38f84c5ac5bfc282bc018bc665a916751315d75e04ff26446e6f14; revisão Git: 54d1f0f1fed3bf4d0fd6d7a3799fb4ab93cff0e0.
Configuração: `docs_devout/03-execucao/fontes-revisao.json`, SHA-256 `242f058446426c249a79dd99fff4689c23d85f5e257be8a1a86fda7be8d1694f`.
Entrada integral temporária, não versionada: `C:/Users/User/AppData/Local/Temp/tmp.ofuVdgOMXi/input.json`.

## Avaliação independente

Avaliação persistida antes de abrir relatos, Observações, guias adiados e diffs integrais das fontes. Entrada preparada com `review_inputs.py --sources` e reconferida com `--check-input` imediatamente antes desta gravação, sem divergência.

### Identificação das fontes (SHA-256 integral)

| Caminho | SHA-256 |
|---|---|
| docs_devout/plano.md | 1e7c1606a8cf9971e2319124a38e24dc3eaaf9d1333a0c4b55d6847206913e11 |
| AGENTS.md | a558ed7ade61c0c90613d265b14d0b06c5f9100de8b1acbae5d0b7c1dea5feab |
| docs_devout/02-design/contrato-orquestracao-mvp.md | 34845bd0154612091c44d969216e488679fcd6184958c124a73b7b14aebb63dd |
| docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md | a4855eacf2083f3eed1d563507f3560baeea9facab21a52cbe349d069f18903a |
| docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md | 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6 |
| docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md | 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8 |
| docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md | 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018 |
| docs_devout/how-to/diagnosticar-ambiente-windows.md | 85d0e049136eb8ba35cb073e0c043fe29cc9eaea5979f86bbfff6bff8972b562 |
| src/README.md | 525e274cbe269b2d643c3d65218a9ae929a34ffbac035ec6908a518bed895b6b |
| src/PI-LOCK.md | 527f93092dcec93306b9200ab800658a488ea1159adbe3a4141b83cc0579560d |
| src/ROLE-RUNNER.md | 52c724dce9c78f6c507aa01a6e0d628ce6ce207bb44ceefd76667bc6e71cba23 |
| prototipo/prova-integracao-openclaw-pi/probe-pi-rpc.mjs | 47e7c81ecaab144482c976fbaabf1a1e924fc4f2b78963b4298b0350a0776d84 |
| prototipo/prova-integracao-openclaw-pi/experimento-integracao-openclaw-pi.md | 43d38a9c7bfe82cc72848f40a3cab619a88e0609a09a7f3ae1bc6e332aa2ba21 |
| prototipo/prova-pi-eventos-rpc-v2/pi-rpc-eventos.mjs | d51acfced0bc0168540dfe9291629ab3dc859ad60270f4603228fce33b367461 |
| prototipo/prova-pi-eventos-rpc-v2/README.md | 1af6923df71cae73a9e96cd1e442ba92c928433ee66883b47cd1fd311d4a66d6 |
| prototipo/teste-cancelamento-pi/pi-rpc-abort.mjs | f074f1752ba7c869b0a20e917305fbe5c9065b2e791d256fab700b7488580abc |
| prototipo/teste-cancelamento-pi/README.md | e4ae6ddb7177a647302c33a77934ae00578571e16a4db5a930b2609f07ad3f98 |

### Gates e inspeção

- Estado autorizado: `aguardando revisão`; nenhuma revisão anterior identificada. Branch `feat/m01-t04`, coerente com execução por task; HEAD não é `main`.
- Baseline `c771c4b` presente no histórico; mapa/plano/registro rastreados. Dependências M01-T01 e M01-T03 concluídas: commits funcionais `011a984` e `647a850` e metadados `eacc456` e `54d1f0f` ancestrais de HEAD, com linhas concluídas e evidências presentes nos respectivos objetos Git (sem leitura antecipada dos relatos).
- Inspecionados diff permitido de `src/package.json` e arquivos novos `src/role-runner.mjs`, `src/test/role-runner.test.mjs`, `src/test/fixtures/runner-rpc.mjs`, `src/test/smoke-runner.mjs`; consultados contexto do Driver e implementação do lock para verificar contratos de lançamento, settlement e liberação.
- CLI fechada e configuração validada antes de lançar; workspace marcado, temporário, fora do Git e sem links/históricos; perfil isolado fixo, limites positivos e ausência de argumentos arbitrários de shell.
- `runId` UUID próprio; aquisição antes de lançamento único; eventos resumidos sem payload/modelo/prompt/diagnóstico bruto; estados `starting/running/stopping/terminated/uncertain`; resultado técnico separado por `taskApproved:false`.
- Resultado e estado publicados por temporário exclusivo, flush e rename no mesmo diretório, sem apagar destino prévio. Falhas de publicação não retornam sucesso. Lock é liberado pela prova do Driver vinculado, não por booleano fornecido pelo chamador.

### Checklist — Não alterar (item a item)

1. **Supervisor/API/Named Pipe/paralelismo/serviço:** não introduzidos; invocação temporária, um lançamento e encerramento explícito do CLI. O lock global preexistente é reutilizado sem raiz por execução.
2. **Registro/aprovação/nova sessão/autorização:** Runner não escreve `registro.md`, não opera Git, não aprova task nem reinicia sessão; testes conferem bytes do registro antes/depois. Settlement e texto esperado são somente evidência técnica.
3. **Segredos/históricos:** persistência por lista fechada; canários de prompt, modelo, erro e stderr não aparecem nos arquivos/eventos/stdout; nenhum histórico `.pi`/`.openclaw` é copiado. Permanece o limite aprovado: marcador e perfil não são sandbox nem comprovam ausência de segredos por si sós.

### Entregáveis e critério

- CLI, persistência por execução, integração Driver/lock e testes entregues. Documentação consta do inventário, mas seu conteúdo está reservado ao confronto obrigatório.
- Validação, gravação atômica com leitores concorrentes/falhas, sanitização, lock ocupado, incerteza e falhas RPC/EOF/crash/timeout/assistente/abort/texto incorreto cobertos por testes executados.
- Critério real observado nesta revisão: `npm.cmd --prefix src run test:runner` passou com Pi real; run `run-d0897787-a30c-44e7-be0d-5f5bcb84abaa`; Runner PID 11960 encerrado, árvore Pi ausente por inspeção CIM independente, estado `terminated`, resultado `succeeded`, `taskApproved:false`, lock readquirido e liberado, registro inalterado e stdout igual ao journal. Evidência sanitizada fora do Git: `C:/Users/User/AppData/Local/Temp/devout-runner-smoke-JfLDkr/smoke-summary.json`.

### Validação própria e achados

- `npm.cmd --prefix src test`: primeira execução **89/90**, falha preexistente em `src/test/pi-lifecycle.test.mjs:166` (`taskkillExitCode` 255 em vez de 0), sem alteração desse teste/Driver pela task.
- `node --test --test-name-pattern='resistant multigeneration' src/test/pi-lifecycle.test.mjs`: **1/1**; inspeção independente confirma árvore ausente e processo não relacionado preservado.
- Repetição integral de `npm.cmd --prefix src test`: **90/90**, sem skips, cancelamentos ou falhas.
- `npm.cmd --prefix src run test:runner`: **pass:true**, Windows nativo / Node v24.20.0.
- Logs próprios temporários em `C:/Users/User/AppData/Local/Temp/tmp.ofuVdgOMXi/`: `tests.log`, `retest.log`, `tests-repeat.log`, `smoke.log` (fora do Git).
- **Melhoria opcional O1:** investigar a intermitência do teste de fallback `taskkill` preexistente (`src/test/pi-lifecycle.test.mjs:150–172`). Não presumir estabilidade a partir da repetição verde; registrar a diferença entre código retornado pela ferramenta e prova efetiva de árvore ausente. Não foi reproduzida no reteste isolado nem na segunda suíte, e não há regressão atribuível à M01-T04 identificada.
- **Bloqueadores/importantes:** nenhum identificado na avaliação inicial.

Conclusão preliminar: entrega funcional compatível com a M01-T04; aprovação ainda depende do confronto com documentação, relatos e todos os diffs adiados. Nenhum código alterado, nenhum commit realizado.

## Confronto com relatos

Fase 2 realizada após persistir a avaliação independente acima, preservada sem alterações.

- Lidos integralmente relatório M01-T04 (incluindo iterações e apêndice autorizado), Observações do registro e guias `src/README.md`, `src/PI-LOCK.md` e `src/ROLE-RUNNER.md`. Não há revisão anterior da T04 nem seção de correção oficial: **zero correções completas**.
- Conferidos todos os conteúdos de `deferred_sections`: demais tasks do plano, diagnóstico do mapa, trechos históricos do contrato e referência de integração, contextos/consequências dos ADRs, procedimento Windows e seis arquivos de protótipos. Protótipos apenas consultados, nunca executados ou modificados. Não transplantam para o Runner seus mecanismos antigos de shell/logs/matança por PID.
- Todos os caminhos do inventário e fontes/configuração examinados, incluindo arquivos novos. Diffs HEAD, staged e unstaged consultados com caminhos explícitos: seis arquivos rastreados alterados; staged vazio; HEAD e unstaged iguais. Os demais arquivos configurados não têm diff. Relatório e guia novos foram examinados pelo conteúdo, não tratados como ausentes por estarem untracked.
- Verificação estrutural em UTF-8 confirmou que a configuração só adiciona M01-T04 e preserva integralmente as seleções T01/T02/T03. Plano só troca os quatro rótulos da T04 por subtítulos, sem mudança de requisitos/IDs/dependências. Mapa publica a seleção e os adiamentos. A preparação é identificada no apêndice como autorização humana posterior, não atribuída à implementação original nem usada como aprovação.
- Alegações técnicas do relatório confirmadas pelos resultados próprios: 23 novos testes, integrações CLI com oito modos de Pi falso, resultado atômico, evidências sanitizadas, erro/interrupção/incerteza sem aprovação e smoke real. Resumo operacional antigo `devout-runner-smoke-gk6NCk/smoke-summary.json` conferido: dados coerentes com o relato. A aprovação usa também o novo smoke independente, não depende desse resumo antigo.
- Iterações intermediárias do implementador preservadas: disputa acidental entre teste e smoke recusada pelo lock, ajustes de serialização e sharing Windows. Não são rodadas de correção oficiais nem evidência de paralelismo autorizado. A intermitência observada pelo revisor foi diferente: retorno 255 do taskkill no teste preexistente de ciclo de vida; permanece explicitada como O1, sem ocultar a primeira suíte vermelha.
- Guias documentam esquema fechado, atestação de workspace, limites, perfil herdado, ausência de sandbox, publicação/falhas, códigos de saída e reconciliação conservadora; coerentes com a implementação. Cancelamento entre invocações, gates de papéis reais e OpenClaw ficam expressamente nas tasks/slices futuros. Nenhuma ampliação de escopo identificada.
- Revisões finalizadas das dependências M01-T01/M01-T03 consultadas nesta fase, coerentes com os commits/metadados conferidos inicialmente. Subsiste a dívida documental preexistente: `docs_devout/how-to/diagnosticar-ambiente-windows.md` ainda diz baseline/testes pendentes; já registrada nas revisões anteriores, sem bloquear esta entrega. Git, mapa e guias atuais permitem conferir o estado real; manutenção documental autorizada continua recomendada.
- Diagnóstico próprio: Windows nativo, Node v24.20.0, npm 11.19.0, OpenClaw 2026.11.3 (847611d), Pi 1.5.2, launcher descoberto em `C:\Users\User\.pi\agent\bin\pi.cmd`. Gateway não necessário. `node --check` dos quatro módulos novos e `git diff --check` passaram.
- Conferência posterior: trava global `free/canAcquire:true`; consulta CIM direcionada retornou `DisposableProcessesRemaining=0`. Sem exclusão de evidências ou reconciliação forçada.
- `--check-input` reconfirmado antes desta decisão: mesmos input_id, snapshot, HEAD, configuração/fontes e index. A revisão é narrativa excluída da entrega filtrada. Nenhuma mudança técnica após a avaliação inicial.

Confronto confirma a conclusão preliminar. Nenhum bloqueador ou importante identificado; documentação, limitações e preparação independente compatíveis com a entrega.

## Decisão final

**APROVAÇÃO TÉCNICA da M01-T04 — R1.**

- **Bloqueadores: 0. Importantes: 0. Correções completas: 0.** Não abrir correção.
- **Melhoria opcional O1:** investigar intermitência do teste preexistente `src/test/pi-lifecycle.test.mjs:150–172` (primeira suíte: taskkill 255 versus 0; reteste isolado e segunda suíte passaram). Preservar distinção entre retorno de taskkill e comprovação efetiva do término. Sem regressão da T04 identificada; não exige alterar o Driver/teste nesta task. Dívida documental anterior do diagnóstico continua registrada no confronto, sem novo gate.
- Fazer, cada item de Não alterar, Entregáveis e Critério de conclusão atendidos. CLI temporária, esquema/documentação, persistência segura, integração com Driver/lock e logs sanitizados entregues. **Suíte final 90/90** e **smoke real pass:true**; Runner/Pi encerrados, exclusividade liberada/readquirida e registro inalterado pelo produto. A primeira suíte 89/90 e o reteste 1/1 permanecem registrados, não substituídos pelo resultado verde.
- Aprovação limitada ao snapshot/fontes do cabeçalho e ao Windows local confiável com workspace fictício; não comprova isolamento forte, workflow automatizado ou cancelamento entre invocações. Texto/settlement/exit code continuam evidências técnicas, não autorização de task.
- Manter `aguardando revisão` e acrescentar às Observações pelo script oficial: **“revisão aprovada; aguardando autorização dos commits”**, vínculo desta R1 e resultados próprios, preservando notas e timestamp da última transição.
- Pedido recebido autoriza somente revisão. **Nenhum staging, commit, merge, push, troca de branch ou alteração de código realizado.** Aguardar autorização explícita para os dois commits (funcional e metadados). Task ainda não oficialmente concluída; não avançar à M01-T05.

### Autorização posterior dos commits

Após informar aprovação e aguardar autorização dos dois commits, o usuário respondeu **“autorizo”**. Autorização restrita ao commit funcional da entrega revisada (incluindo preparação documental, relatório e revisão) e ao commit exclusivo de metadados; não inclui merge, push, troca de branch nem execução da próxima task.

Antes do staging, `--check-input` reconfirmou a entrada/snapshot originais, HEAD e hashes das fontes. Relatório, revisão e registro relidos, branch e inventário conferidos; nenhuma mudança técnica ou de requisitos desde a aprovação. Esta anotação documental posterior preserva a avaliação independente. O registro fica fora do commit funcional.

Após staging explícito dos 12 arquivos, a entrada passou a `1d1bafa134acd0813974da2402195e34cb01b86946d22f0d8d5b2e8f6ed4b278`, snapshot `40a466a8d36f85766dd383ca196e6394a7d2c7c4230fc44e64ddb8fb5122d56f`. Mudança reconciliada: adições antes untracked passaram ao index e hunks rastreados passaram de unstaged a staged; HEAD e hashes integrais da configuração/fontes inalterados. Lista exata dos arquivos e cada blob staged conferidos contra o conteúdo auditado (normalização LF/CRLF); diffs rastreados idênticos aos revisados. Nenhuma alteração técnica/de requisitos.

`git diff --cached --check` apontou somente os dois espaços finais das linhas 3–5 do relatório novo: quebras de linha Markdown intencionais, preservadas. Nenhum outro problema de whitespace identificado. Essa checagem staged inclui arquivos novos que não apareciam no diff rastreado inicial.
