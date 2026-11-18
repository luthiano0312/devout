# Revisão M01-T05 — rodada 1
Estado: finalizada
Snapshot da entrega: f1a7851e9087686dab869c4b975d6ebf47a4c87c86b73271b97000ff939dee48
Entrada: 8bc7bf4235c9bc915c7d7b849b818400a8e9d103880fdd4610a05b9777ad64d1; revisão Git: e552e8c5044ba09e8305eb57cb52d03db0e4c12b
Configuração: `docs_devout/03-execucao/fontes-revisao.json`; SHA-256: 50cd7b833200359959934e85a2cbbfaaaec4679b83341804cbf3d98a97408cab.

## Avaliação independente

Avaliação persistida em 2026-11-18, antes de consultar relato, Observações, guias adiados, históricos e diffs narrativos. Entrada temporária fora do repositório: `C:\Users\User\AppData\Local\Temp\devout-M01-T05-review-input.json`. Revalidada com o preparador e `--check-input` imediatamente antes desta persistência: exit 0. Nenhuma exposição efetiva a conclusões anteriores identificada.

### Gate e identificação

- Task completa obtida pelo preparador; estado `aguardando revisão`, nenhuma revisão anterior (R1), nenhum commit funcional da T05. Branch `feat/m01-t05`, coerente com task e convenção de branches por task; sem troca de branch/index.
- Dependências obrigatórias T02 e T04 concluídas na versão commitada do registro. Commits funcionais `9c6e88c534e47f95c4c42c72c3797d40631710d1` e `3331968cc85834cad17ca625f6a8305452518e0c`, metadados `fbde012df9dfd069478172d431fd22503d913de3` e `e552e8c5044ba09e8305eb57cb52d03db0e4c12b`: presença/ancestralidade em HEAD verificadas, sem ler os relatos. Baseline `c771c4b39a34716f15728c1e0d5b2596e776bc41` identificado no histórico; mapa/plano/registro rastreados.
- Inventário inicial: mudanças não staged; nenhum diff staged. Entregáveis novos também examinados, sem alterar index. Mudanças documentais selecionadas ficam para a fase de confronto; sua atribuição final ainda será conferida.

### Código, entregáveis e critérios

Examinados integralmente `src/run-control.mjs`, `src/operational-json.mjs`, `src/role-runner.mjs`, `src/package.json`, `src/test/runner-cancel.test.mjs`, `src/test/fixtures/runner-cancel-rpc.mjs` e `src/test/smoke-runner-cancel.mjs`, além dos diffs filtrados HEAD/unstaged e do contexto de encerramento em `src/pi-driver.mjs` e `src/pi-lock.mjs`.

- Interface local: `cancel --artifacts-root <raiz> --run-id <UUID>`; seleção por diretório exclusivo/UUID e correspondência do registro de controle, não por PID. Rejeita caminhos inválidos, junctions de run e identidades divergentes. Não encaminha argumentos livres ao shell.
- Coordenação: guarda de diretório exclusiva, transações curtas sem aguardar ações assíncronas sob a guarda, escrita durável/rename atômico. Contenção limitada a 2 s, sem recuperar guarda abandonada às cegas. Uma solicitação concorrente vence; repetições preservam identidade e timestamp.
- Runner consulta controle antes de aquisição, lançamento, estado e prompt; monitora a execução a cada 100 ms. Cancelamento aciona o Driver possuído e impede novas fases. Solicitação durante bootstrap é consumida antes das operações seguintes. Falhas de controle impedem sucesso e provocam cleanup.
- O corte final usa a mesma guarda: pedido aceito antes do fechamento domina observação de sucesso; depois dele há `too_late` ou `blocked`. Resultado registra `interrupted`/falha, `taskApproved:false` e recibo de término; recibo de solicitação não afirma conclusão da task.
- Identidade/árvore e escalonamento permanecem a cargo do Driver/lease existentes. Repetição não mata PID histórico; término incerto mantém lease persistente bloqueante. Extração de `atomicWriteJson` preserva export anterior e comportamento de persistência.
- Entregáveis funcionais e testes atendidos. Documentação do mecanismo ainda pendente de exame na fase 2, por ser fonte integralmente adiada.

### Checklist de Não alterar e limites comuns

1. **Sem serviço residente, HTTP, IPC genérico ou segundo Pi para cancelar:** atendido. Comando curto só valida/grava controle local; o monitor pertence ao Runner temporário. Testes com processos distintos comprovam o recebimento.
2. **Não prosseguir/liberar lock com processo ou término incerto:** atendido. Fases serializadas com solicitação e validação; liberação exige recibo confiável do Driver, identidade, árvore ausente e liberação real da lease. Teste de incerteza conserva bloqueio e impede aquisição seguinte.
3. **Slice 1/segurança:** nenhum gate oficial de papéis/transição, commit automático, alteração do registro pelo Runner ou infraestrutura genérica introduzido. Testes reais limitados a workspaces temporários marcados, fictícios e sem segredos. Sem promessa de sandbox/isolamento forte. Código/testes novos em `src/`; evidências operacionais fora do Git. Verificação documental completa e preservação de escopo pendentes da fase 2.

### Validações próprias

Windows nativo; Node `v24.20.0`, npm `11.19.0`. Testes sequenciais, sem dois Pi do workflow simultâneos.

- `npm.cmd --prefix src test`: exit 0, **106/106 passaram, zero skips**, duração 125059 ms. Inclui oito controladores concorrentes, repetição, identidade inválida/junction, guarda abandonada, arbitragem pedido/fechamento, cancelamento antes de fases, bootstrap, último instante, pedido tardio, incerteza e processo alheio vivo. Integração Windows com processo RPC fictício exercitou abort e fallback forçado. Log próprio: `C:\Users\User\AppData\Local\Temp\devout-t05-review-tests.log`.
- `npm.cmd --prefix src run test:runner-cancel`: exit 0, **dois casos reais passaram**. Streaming por CLI (`run-bfdf0f68-c49e-40ad-8c78-eb4c94aedf1c`) e pedido em `stopping` por API local em processo controlador distinto (`run-bf06b029-8bc8-486e-b9f4-ea0e4d23ae59`). Ambos: pedido aceito, resultado `interrupted`, Runner exit 1, árvore `terminated`, `processesGone/canRelease:true`, lock liberado só após término; CIM independente não encontrou os PIDs e nova aquisição/liberação funcionou. Streaming confirmou abort aceito sem força; último instante confirmou marker/settlement mas não falso sucesso. Repetição final `too_late`; registro inalterado. Evidências: `C:\Users\User\AppData\Local\Temp\devout-runner-cancel-smoke-azUKs1\smoke-summary.json`; log `C:\Users\User\AppData\Local\Temp\devout-t05-review-real.log`.
- `git diff --check -- src/package.json src/role-runner.mjs`: exit 0.
- Não há build/lint definido em `src/package.json`. Logs/resultados próprios não dependem de relatos anteriores. Fallback resistente comprovado com fixture Windows, não com Pi real deliberadamente travado. API no caso real de último instante evita que o bootstrap de uma CLI nova perca legitimamente o corte; a CLI foi exercitada no streaming, repetições e caso determinístico de último instante.

### Manifesto SHA-256 das fontes integrais

Hashes incluem também os trechos adiados; a seleção inicial não dispensa o confronto posterior.

| Fonte | SHA-256 |
|---|---|
| `docs_devout/plano.md` | fc073adb7ccb622a5e2994021a93dced132d397e9de91ba623355aac0dbb1356 |
| `AGENTS.md` | 466d04893beeb780bfe726b985e64f4cd1c4d69cb550605669fb91b04bcf24e1 |
| `docs_devout/02-design/contrato-orquestracao-mvp.md` | 34845bd0154612091c44d969216e488679fcd6184958c124a73b7b14aebb63dd |
| `docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md` | a4855eacf2083f3eed1d563507f3560baeea9facab21a52cbe349d069f18903a |
| `docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md` | 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6 |
| `docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md` | 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8 |
| `docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md` | 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018 |
| `docs_devout/how-to/diagnosticar-ambiente-windows.md` | 85d0e049136eb8ba35cb073e0c043fe29cc9eaea5979f86bbfff6bff8972b562 |
| `src/README.md` | ea9399f83e4f0b3578bda8a5e4318c64859f9c86d1fa32361a9ec4da49031f9c |
| `src/PI-LOCK.md` | 527f93092dcec93306b9200ab800658a488ea1159adbe3a4141b83cc0579560d |
| `src/ROLE-RUNNER.md` | 14d3467698377300ab7c5852eda15b8c545dd43279e08a1bc32ec5d03ada74e7 |
| `prototipo/prova-integracao-openclaw-pi/probe-pi-rpc.mjs` | 47e7c81ecaab144482c976fbaabf1a1e924fc4f2b78963b4298b0350a0776d84 |
| `prototipo/prova-integracao-openclaw-pi/experimento-integracao-openclaw-pi.md` | 43d38a9c7bfe82cc72848f40a3cab619a88e0609a09a7f3ae1bc6e332aa2ba21 |
| `prototipo/prova-pi-eventos-rpc-v2/pi-rpc-eventos.mjs` | d51acfced0bc0168540dfe9291629ab3dc859ad60270f4603228fce33b367461 |
| `prototipo/prova-pi-eventos-rpc-v2/README.md` | 1af6923df71cae73a9e96cd1e442ba92c928433ee66883b47cd1fd311d4a66d6 |
| `prototipo/teste-cancelamento-pi/pi-rpc-abort.mjs` | f074f1752ba7c869b0a20e917305fbe5c9065b2e791d256fab700b7488580abc |
| `prototipo/teste-cancelamento-pi/README.md` | e4ae6ddb7177a647302c33a77934ae00578571e16a4db5a930b2609f07ad3f98 |

### Achados e conclusão preliminar

**Zero bloqueadores, zero importantes e nenhuma melhoria opcional identificada nesta fase.** Comportamento e testes satisfazem o recorte técnico da M01-T05; aprovação ainda depende do confronto obrigatório com relato, guias, fontes/diffs adiados e pacote narrativo. Esta avaliação independente não será reescrita após esse confronto.

## Confronto com relatos

Examinados após a persistência inicial: relatório T05 integral (inclusive apêndice), Observações, `README.md`, `PI-LOCK.md`, `ROLE-RUNNER.md`, plano, trechos adiados do contrato, registro histórico de integração, ADRs e os seis arquivos de protótipos selecionados. Conteúdos/diffs HEAD/staged/unstaged de todos os caminhos adiados/inventário foram conferidos; fontes históricas sem mudanças também tiveram ausência de diff confirmada. Nenhuma alteração no index.

- A documentação descreve corretamente mailbox, UUID, guarda, corte final, prazos, recibos, bootstrap e limites de confiança. Plano muda somente os quatro rótulos para subtítulos; configuração acrescenta T05 sem alterar estruturalmente T01–T04 (comparação própria com HEAD). Mapa acompanha a seleção. Alterações são atribuíveis à implementação/preparação descritas no relatório; sem conteúdo alheio identificado. Protótipos, skills, Driver e trava global foram preservados.
- Relatório não tem seções de correção; não há revisão T05 anterior. **Zero correções completas**, esta é R1. A primeira tentativa de smoke que perdeu o corte de `stopping` está explicitamente relatada; usar API local já carregada para o caso estreito é compatível com o contrato e não é, em si, um achado.
- A suíte 106/106 e o caso real de último instante foram reproduzidos. Regressão adicional própria `npm.cmd --prefix src run test:runner`: exit 0, `succeeded`, marcador/settlement válidos, árvore encerrada sem força, CIM e reaquisição positivos, registro inalterado. Evidência: `C:\Users\User\AppData\Local\Temp\devout-runner-smoke-oYJPGl\smoke-summary.json`; log `C:\Users\User\AppData\Local\Temp\devout-t05-review-normal.log`.
- Diagnóstico: OpenClaw `2026.11.3 (847611d)`, Pi `1.5.2`, launcher descoberto em `C:\Users\User\.pi\agent\bin\pi.cmd`; Node/npm conforme fase 1. Gateway não exigido pela T05. `git diff --check` integral: exit 0.

### Divergência descoberta no confronto das evidências reais

O resumo do smoke T05 informa `pass:true`, mas isso **não comprova cancelamento real durante geração**. Ao confrontar o `smoke-summary.json` com `events.jsonl` e `control.json`, foi identificado falso positivo tanto na execução própria quanto na evidência final do implementador:

| Evento da execução própria de streaming | Instante UTC / sequência |
|---|---|
| `response_started` | 12:37:32.616 / seq 6 |
| `agent_settled` | 12:37:32.718 / seq 7 |
| `prompt_observed`, `aborted:false`, seguido de `RESPONSE_MISMATCH` | 12:37:32.721–.723 / seq 8–9 |
| `stopping` | 12:37:32.730 / seq 10 |
| `control.requestedAt` | **12:37:33.120**, após settlement e início do encerramento |
| `cancel_observed` | 12:37:33.183 / seq 11 |

Evidência própria: `C:\Users\User\AppData\Local\Temp\devout-runner-cancel-smoke-azUKs1\operacional\runs\run-bfdf0f68-c49e-40ad-8c78-eb4c94aedf1c\{events.jsonl,control.json,result.json}`. A evidência do implementador em `devout-runner-cancel-smoke-gFUaqj`, run `run-d8592fba-593c-4c17-834e-88f56e7eb805`, repete a ordem: settlement às 12:17:08.749, mismatch às .753, stopping às .757, pedido persistido às .858 (`control.requestedAt`) e consumo às .900. Seu resumo também tem `aborted:false`, `assistantError:false` e `pass:true`.

O Driver já estava cancelando por falha de marcador quando o pedido externo foi recebido. Assim, `abortAccepted:true` pode ser apenas abort de uma sessão já ociosa e não prova interrupção de resposta em curso. O Runner está correto ao fazer um pedido tardio ainda aceito prevalecer no resultado; o defeito está em aprovar essa execução como teste de cancelamento durante geração. O caso real estreito de encerramento continua válido, e a suíte com fixture continua comprovando cancelamento ativo/forçado, mas não preenche a evidência real faltante.

**Mudança de conclusão em relação à fase 1:** a avaliação inicial registrou fielmente o exit 0 e os dois `pass` do smoke; a inspeção cronológica posterior revelou que o primeiro não representa o cenário pretendido. A avaliação independente acima foi preservada, sem reescrita. A conclusão final passa a exigir correção da validação/evidências.

Atualidade reconfirmada antes deste parecer com o mesmo preparador e `--check-input`: exit 0; `input_id`, HEAD, hashes e snapshot idênticos aos da avaliação inicial. A revisão nova é narrativa excluída do snapshot. Não houve mudança de código/fontes durante a revisão.

## Decisão final

**Resultado: não aprovada — encaminhar para correção.**

Contagem: **0 bloqueadores, 1 importante, 0 melhorias opcionais; 0 correções completas.** Nenhum defeito funcional adicional foi identificado na interface de cancelamento, arbitragem ou liberação conservadora da lease. As duas proibições da task permanecem atendidas; a pendência é comprovar corretamente um cenário obrigatório de validação.

### T05-R1-I01 — Importante: smoke real aceita conclusão anterior ao pedido como cancelamento durante geração

- **Local:** `src/test/smoke-runner-cancel.mjs:55–65, 71–86, 97–98`, especialmente as asserções do caso `response_started`. Relato correspondente: `docs_devout/03-execucao/achados/task-M01-T05-relatorio.md`, resultados/evidências de streaming e conferência do critério.
- **Evidência reproduzida:** comando `npm.cmd --prefix src run test:runner-cancel` retorna exit 0/`pass:true` mesmo quando o pedido foi persistido às **12:37:33.120Z**, depois de `agent_settled` às **12:37:32.718Z** e de `RESPONSE_MISMATCH`/`stopping`. Ordem exata e caminhos estão na tabela do confronto; a evidência final do implementador apresenta o mesmo falso positivo. `aborted:false` e ausência de erro/abort do assistente são coerentes com conclusão normal anterior, não cancelamento efetivo da geração.
- **Causa:** o teste dispara a CLI ao primeiro delta, mas não verifica se o pedido/consumo realmente ocorreu antes do settlement. Aceita `abortAccepted && !forced` como confirmação suficiente; esse abort pode ser causado pelo mismatch e aceito quando não há atividade. A igualdade de eventos stdout/disco não valida sua ordem semântica.
- **Requisito violado:** Fazer da T05 exige testar cancelamento **durante resposta em curso**, inclusive em Pi real quando viável; contrato §5.2 e T07 não aceitam confirmação isolada de abort como evidência de cancelamento efetivo. O ambiente real estava disponível, mas o cenário relatado ainda não foi demonstrado. Isso impede aceitar a validação como completa.
- **Correção recomendada:** tornar o smoke sensível a conclusão natural anterior à solicitação/consumo: conferir ordem do pedido/`cancel_observed` versus settlement e distinguir prova de interrupção ativa de simples abort aceito. Quando a geração já tiver terminado, retornar falha/inconclusivo, **nunca `pass:true`**. Acrescentar regressão determinística que reproduza conclusão rápida + pedido atrasado e exija a rejeição do falso positivo. Ajustar somente o harness/solicitação controlada necessários para obter uma tentativa real efetivamente ativa (pode usar controlador independente já carregado), preservando CLI independente nos cenários que a exercitam; não inserir espera artificial no Runner nem enfraquecer o corte. Preservar evidências anteriores e acrescentar ao relatório a distinção/retificação e a nova prova sanitizada. Reexecutar suíte e smoke real, mantendo confirmação de término, processo alheio e exclusividade.

**Encaminhamento:** registro passa de `aguardando revisão` para `em correção`, por `update_registro.py`, preservando Observações existentes e vinculando esta revisão. Próxima conversa: papel corretor, tratando I01; depois nova revisão independente R2. Não abrir quarta correção/reiniciar contagens nem avançar para T06. Nenhum código foi corrigido, nenhum commit foi autorizado ou realizado pelo revisor. Transição para `em correção` confirmada em `2026-11-18T12:42:40+00:00`; Observações anteriores preservadas.
