# Revisão M01-T06 — rodada 1
Estado: finalizada
Snapshot da entrega: ddf083f4fd44a0a80f72b37c5f2d289ec7db0f656346cc14c5c46af638940cf7
Entrada: 53bfc2a5f663d699ada4038308e3e5f4cd64b840579e957de7a99cc0c90add7e; revisão Git: fb991a9c21170edfea1e50852e3e7d15565ab66d
Configuração: docs_devout/03-execucao/fontes-revisao.json; SHA-256 d7d9508e3bea3a6de89492b31680e1fbc3d8cb9ee7ebcfc1e613f5691fd74731

## Avaliação independente

Persistida antes de consultar Observações, relato, guias e demais conteúdos/diffs adiados. Entrada temporária fora do repositório: `%TEMP%/devout-M01-T06-review-input.json`. `--check-input` reexecutado com sucesso imediatamente antes desta persistência.

### Fontes identificadas (SHA-256 dos bytes integrais)

- `docs_devout/plano.md`: 0c98b5ff2378af1357e55880036777661538356009b47c990aff981b427218b4
- `AGENTS.md`: 2e88779d6c9c75bbb71960db7cdd4a437ac27c6c1aadcb8ee95d174e8eb0ac3d
- `docs_devout/02-design/contrato-orquestracao-mvp.md`: 34845bd0154612091c44d969216e488679fcd6184958c124a73b7b14aebb63dd
- `docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md`: a4855eacf2083f3eed1d563507f3560baeea9facab21a52cbe349d069f18903a
- `docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md`: 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6
- `docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md`: 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8
- `docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md`: 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018
- `docs_devout/how-to/diagnosticar-ambiente-windows.md`: 85d0e049136eb8ba35cb073e0c043fe29cc9eaea5979f86bbfff6bff8972b562
- `src/README.md`: 0c302ffe0a5f2194cbdb9545c63f143afe01609d7f46079189db1bbde959569b
- `src/PI-LOCK.md`: 527f93092dcec93306b9200ab800658a488ea1159adbe3a4141b83cc0579560d
- `src/ROLE-RUNNER.md`: bb4d3e94473c820b9cf2023a4ad2a69df5141eb487da468e82a469a4ccb1664c
- `src/OPENCLAW.md`: 909705dfa67b3a0d8e9e618e6b1a26914407289c1ac485756c1126e4f3fdd7b0
- `prototipo/prova-integracao-openclaw-pi/probe-pi-rpc.mjs`: 47e7c81ecaab144482c976fbaabf1a1e924fc4f2b78963b4298b0350a0776d84

### Gate, inventário e inspeção

- Task completa, com quatro campos; estado `aguardando revisão`; nenhuma revisão anterior identificada, portanto R1.
- Branch efetiva `main`, coerente com o checkout/baseline e histórico documental de desenvolvimento consultados; nenhuma troca de branch ou commit executado.
- M01-T04/M01-T05 concluídas também no registro versionado; commits funcionais `3331968cc85834cad17ca625f6a8305452518e0c` e `5e71f1a4869cf0d77ba4afb1a1494696a4a1b7ef`, commits de metadados `e552e8c` e `fb991a9`, todos ancestrais de HEAD. Entregas e relatos/revisões dessas dependências presentes em HEAD, sem consumir suas conclusões nesta fase.
- Examinados integralmente os quatro arquivos novos permitidos: `src/test/probe-openclaw.mjs`, `src/test/helpers/openclaw-evidence.mjs`, `src/test/openclaw-evidence.test.mjs`, `src/test/openclaw-procedure.txt`; contexto do Runner e helper `active-cancellation.mjs`. Diffs filtrados HEAD/staged/unstaged vazios; os novos arquivos foram lidos diretamente, sem staging.
- Inventário restante: mapa, configuração, plano, registro, relato T06, `src/OPENCLAW.md`, README e ROLE-RUNNER. Seus conteúdos/diffs adiados serão confrontados na fase 2.

### Checklist técnico e de escopo

1. **Não implementar workflow/Git/persistência oficial/checkpoints/produção:** respeitado nos entregáveis examinados. O probe apenas prepara workspace fictício, valida arquivos e observa processos; só o Runner existente cria Pi. Nenhum serviço/porta, transição de task ou operação Git é acrescentado.
2. **Não confundir sinais técnicos com aprovação:** respeitado. Todos os gates exigem `taskApproved:false`; resultado normal exige settlement, resposta correlacionada, marcador, término e lock liberado. Há caso mismatch explicitamente falho mesmo com Pi exit zero; cancelamento exige pedido/consumo antes do settlement e interrupção comprovada.
3. **Não expor portas/segredos/dados reais:** respeitado no código/roteiro inspecionado. Workspace marcado sob temporários, perfil isolado existente, prompts fictícios, comandos Node fixos, sem shell variável, configuração/erros brutos não publicados; trace usa projeção restrita e teste de canário. A documentação sanitizada ainda depende do confronto.
4. **Procedimento/script e acompanhamento:** roteiro exige `yieldMs:1000`, `pty:false`, `awaitResults:false`, handles distintos dos runIds, poll/log e validação em disco antes do próximo Pi; cancelamento passa pela interface local existente. Trace correlaciona comandos, handles, resultados e ordem de coleta.
5. **Exclusividade/cancelamento:** evidência exige duplicidade após Pi pronto e antes do pedido; duplicado sem aquisição de lock/Pi; próxima execução após término/coleta anterior. Probe consulta CIM nativo e lock padrão, falhando conservadoramente quando não comprova ausência.
6. **Evidências reais, comandos/limites/reinício:** não considerados comprovados nesta fase, pois guias/relato foram corretamente adiados. Não se declara aprovação com base apenas nos testes sintéticos.
7. Nenhuma modificação em Driver/Runner/lock ou protótipos aparece na entrega filtrada; sem antecipação dos testes completos de workflow T01/T02.

### Comandos e resultados próprios

- `npm.cmd --prefix src test`: **152/152 passaram**, zero falhas/cancelamentos/skips; duração aproximada 133 s. Saída completa temporária em `%TEMP%/devout-t06-tests.txt`.
- `node --version`: v24.20.0; `openclaw.cmd --version`: OpenClaw 2026.11.3 (847611d).
- Conferidas presença e ancestralidade Git das dependências e presença dos arquivos de baseline.
- Preparador com `--check-input`: exit 0, mesma entrada e snapshot.
- Não houve lançamento de Pi real nem reinício de Gateway nesta fase. Os testes automatizados usam processos fictícios.

### Achados e conclusão preliminar

Nenhum bloqueador/importante identificado no código e roteiro examinados. Conclusão **ainda condicionada** ao confronto obrigatório de todas as fontes e diffs adiados, às evidências reais sanitizadas e à consistência do relato. Esta avaliação não aprova nem conclui a task por si só.

## Confronto com relatos

### Fontes e pacote completo

Após persistir a avaliação inicial, examinados integralmente o relatório T06 (incluindo tentativas e apêndice), Observações, os quatro guias adiados, diagnóstico Windows e todos os intervalos de `deferred_sections`: outras tasks do plano, trechos históricos do contrato/prova, ADRs e os seis arquivos históricos de protótipos. Nenhuma revisão/correção anterior da própria T06 existe; **0 correções completas**. Tentativas técnicas preservadas no relatório não são rodadas de correção.

Examinados todos os caminhos do inventário e diffs HEAD/staged/unstaged das fontes/configuração/registro. Staged vazio; HEAD e unstaged contêm as mesmas alterações. Os arquivos novos (inclusive relato e OPENCLAW) foram lidos, não omitidos por ausência em `git diff`. Conferência estrutural em UTF-8 confirmou T01–T05 inalteradas na configuração; única seleção nova é T06. Comparação do plano confirmou apenas conversão dos quatro rótulos da T06 em subtítulos, sem mudança dos requisitos. Alterações no mapa/README/ROLE-RUNNER correspondem à preparação autorizada e aos links do procedimento; registro só altera T06. Driver, Runner, lock, skills, protótipos e requisitos permanecem sem alterações.

Complemento do manifesto recebido na entrada inicial (arquivos integralmente adiados, cujos hashes também constam no JSON temporário original):

- `prototipo/prova-integracao-openclaw-pi/experimento-integracao-openclaw-pi.md`: 43d38a9c7bfe82cc72848f40a3cab619a88e0609a09a7f3ae1bc6e332aa2ba21
- `prototipo/prova-pi-eventos-rpc-v2/pi-rpc-eventos.mjs`: d51acfced0bc0168540dfe9291629ab3dc859ad60270f4603228fce33b367461
- `prototipo/prova-pi-eventos-rpc-v2/README.md`: 1af6923df71cae73a9e96cd1e442ba92c928433ee66883b47cd1fd311d4a66d6
- `prototipo/teste-cancelamento-pi/pi-rpc-abort.mjs`: f074f1752ba7c869b0a20e917305fbe5c9065b2e791d256fab700b7488580abc
- `prototipo/teste-cancelamento-pi/README.md`: e4ae6ddb7177a647302c33a77934ae00578571e16a4db5a930b2609f07ad3f98

### Verificações próprias das evidências reais

Não aceitei apenas a declaração do implementador ou o `pass` histórico. Um script temporário exclusivo desta revisão leu os quatro conjuntos originais `events/state/control/result` de `%TEMP%/devout-openclaw-probe-GId5dd/operacional/runs/`, reaplicou `checkRunEvidence`/`checkScenarioOrder` e comparou campo a campo com o resumo preservado. Todos passaram. Nova consulta CIM comprovou ausência dos **19 PIDs** distintos de Runners/processos observados; `inspectPiLock` confirmou `free`, `canAcquire:true`. Não houve aquisição/limpeza/reconciliação pelo revisor nesta etapa, nem lançamento de Pi real.

Consulta de leitura `sessions.get` da sessão exata `agent:main:devout-t06-probe-GId5dd` pelo Gateway ativo, com limit 200, foi canalizada em memória ao verificador temporário. Reaplicado `checkOpenClawTrace` aos **90 registros originais**, comparando a projeção com `gateway-trace.json`: mesmos quatro handles, parâmetros assíncronos, recibo, coletas terminais, contagens poll/log e **1 erro do controlador**. Transcript bruto não foi mostrado nem persistido/versionado. A primeira consulta pelo shell Bash recebeu um envelope de erro e foi recusada pelo verificador; a consulta PowerShell interativa equivalente à documentada, com escape JSON para `.cmd`, passou. Isso foi repetição de uma consulta de leitura, não replay de execução ou contorno de política.

| Caso | runId / handle original | Conferência própria |
| --- | --- | --- |
| Cancelamento | `run-dd1b5958-e7db-464f-a64d-a32cfcd6f0a9` / `tidal-falcon` | interrupted; texto 16:14:48.814Z, pedido 16:14:54.572Z, consumo 16:14:54.607Z, settlement abortado 16:14:54.656Z; término 16:14:54.867Z, coleta 16:14:55.088Z; sem força, lease liberada |
| Duplicidade | `run-5562fd0a-2ff6-41e8-b43e-e51863eca516` / `mild-haven` | failed/LOCK_BUSY, sem aquisição de lease, sem Pi/prompt; intervalo 16:14:50.360Z–16:14:51.693Z dentro da atividade anterior |
| Normal | `run-1826920a-daa6-41ec-af61-9042dd7c0b31` / `delta-atlas` | succeeded; marcador, settlement e término normal comprovados; invocação 16:15:13.284Z após coleta anterior; término 16:15:20.975Z, coleta 16:15:21.180Z |
| Divergência | `run-a5d439c1-0a71-4d88-be72-cafc0749e9f7` / `sharp-harbor` | failed/RESPONSE_MISMATCH apesar de Pi exit zero; invocação 16:15:27.711Z após coleta normal; término 16:15:34.721Z, coleta 16:15:35.070Z |

Todos os horários acima são UTC de **2026-11-18**. Identidades e ordem coincidem com o relato. As chamadas de check duplicate/cancel/normal/mismatch constam no runtime, em sequência; check cancel foi invocado antes do normal, e check normal antes do mismatch. Não se exigiu duplicidade antes do primeiro texto: o requisito é Pi anterior ativo, comprovado pelos instantes e pelo cancelamento posterior.

Verificadas também as tentativas preservadas, sem executá-las novamente:

- `5WqPAf`: cancelamento com 679 eventos continua **recusado** pelo gate por falta de evidência suficiente no diário; duplicado LOCK_BUSY passa como cenário de falha esperada.
- `hrlWDP`: execução timeout com 3927 eventos continua **recusada** como prova de cancelamento ativo.
- `4hgK9k` e `s0Ydvd`: não há diretório de runs. A queda antes de sessão/runs não comprova recuperação de processo ativo.

O hash atual do registro difere do snapshot de preparação por causa das atualizações manuais documentadas da skill. Não modifiquei `probe.json` nem executei o comando `check/trace` do probe sobre esse snapshot como se pudesse passar o gate de registro atual. Reapliquei somente os validadores de evidência aos arquivos históricos e consulta nativa atual, explicitando essa separação. O hash histórico preservado é `3e86598fca36bd8a774aeafb41ea3e7e17718ebd1cdadb388767509129e47bfa`; a inspeção do código e do diff do registro confirma que o executável não o atualiza.

Resultados próprios sanitizados fora do Git:

- `%TEMP%/devout-t06-review-disk.json`: SHA-256 `9eabdbb8e44422376bac11fe840d7d1e580c40d793292ce7d9769dedec376697`; inclui manifesto dos 16 arquivos de evidência. Hash do manifesto JSON canônico (chaves ordenadas, separadores compactos): `5b5db988e1d272253dfe6ff765bb496e2ae0a6f103f2512a7e06492d449b404e`.
- `%TEMP%/devout-t06-review-trace.json`: SHA-256 `963ff5c95ceac197a1afd86d081ae2b096ab9d2190a36a0a2be87581cfae7707`; projeção própria das chamadas originais, sem transcript bruto.
- `%TEMP%/devout-t06-review-check.mjs`: SHA-256 `24bc89931f1da9fad73b20734c6fc5e18fc1d6b4f072ecd25b9847eeaf180b93`; script de leitura/validação desta revisão, não entregável novo do produto.

### Limites e divergências

A documentação informa corretamente os limites de duração, 512 eventos resumidos, dependência da configuração local, latência de cancelamento e perda de handles após restart. Não houve crash/restart deliberado com Pi ativo; a ressalva é compatível com o requisito condicionado à segurança. O SyntaxError posterior aos checks não foi ocultado nem promovido a sucesso de workflow; não invalida as quatro execuções delimitadas comprovadas por retorno original, arquivos e observação nativa.

Não foi realizada nova demonstração com consumo de provedor pelo revisor: a validação própria combinou suíte completa, replay determinístico dos arquivos originais, consulta ao runtime real preservado e inspeção nativa atual. Isso não certifica repetibilidade irrestrita do controlador por prompt, produção, papéis prolongados ou recuperação durável, que não fazem parte do aceite desta task.

`git diff --check` passou. O preparador com a configuração original e `--check-input` passou novamente imediatamente antes do parecer, sem mudança de entrada/snapshot. A seção Avaliação independente permanece intacta; o confronto não revelou motivo para alterar a conclusão técnica preliminar.

## Decisão final

**APROVADA TECNICAMENTE — 0 bloqueadores, 0 importantes, 0 melhorias opcionais registradas.** Primeira revisão; **0 correções completas**.

- Entregáveis presentes: roteiro/script, documentação local repetível com comandos/entradas/limites, extrato sanitizado e artefatos verificáveis dos quatro casos reais.
- Critério de conclusão atendido: OpenClaw → Runner → Driver → Pi real, runId rastreável, settlement e persistência; duplicidade sem segundo Pi; cancelamento ativo e término/liberação/coleta anteriores ao próximo Pi; falha divergente sem falso sucesso.
- Cada item de Não alterar foi respeitado também no pacote documental final: sem workflow de papéis, persistência oficial pelo executável, Git Gateway, integração remota/checkpoint/marco/produção; sem equiparar sinais técnicos a aprovação; sem portas adicionais, credenciais ou dados reais nas evidências versionáveis.
- Suíte própria **152/152**, sem skips/falhas; verificações próprias de artefatos/runtime/nativo acima passaram. Evidências históricas insuficientes continuam explicitamente não aprovadas.

Manter M01-T06 **aguardando revisão**, acrescentando aprovação às Observações e preservando notas existentes: **revisão aprovada; aguardando autorização dos commits**. O pedido do usuário autorizou revisão, não os dois commits. Nenhum commit, troca de branch, alteração do código da task ou avanço de task/marco realizado. A task só será concluída após autorização explícita e confirmação dos commits funcional e de metadados.
