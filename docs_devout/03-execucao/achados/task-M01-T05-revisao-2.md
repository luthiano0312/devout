# Revisão M01-T05 — rodada 2
Estado: finalizada
Snapshot da entrega: 66709b0600cb7f53468d83dd4517dee1a94abfe8c3d11278045d6dd50dde6cec
Entrada: 0b311799712e42dfaee9d848af77f64cb89f96bf2bd4f394e801236a6adf89a7; revisão Git: e552e8c5044ba09e8305eb57cb52d03db0e4c12b
Configuração: docs_devout/03-execucao/fontes-revisao.json; SHA-256: 50cd7b833200359959934e85a2cbbfaaaec4679b83341804cbf3d98a97408cab

## Avaliação independente

Persistida em 2026-11-18, antes da leitura do relatório, da revisão 1, das Observações e dos conteúdos/diffs adiados. Entrada temporária fora do Git: `C:\Users\User\AppData\Local\Temp\devout-M01-T05-review-zm193stf\input.json`. Revalidada com o mesmo preparador e `--check-input` imediatamente antes desta gravação, sem mudança de identidade. Nenhum código da task alterado pelo revisor.

### Pré-condições e cobertura

- Task completa recebida pelo preparador; estado `aguardando revisão`; revisão 1 identificada como finalizada, portanto esta é R2. A contagem de correções será confrontada na fase 2.
- Branch `feat/m01-t05`, coerente com a convenção de branches por task. Baseline rastreado; dependências M01-T02 e M01-T04 concluídas com seus commits funcionais (`9c6e88c534e47f95c4c42c72c3797d40631710d1`, `3331968cc85834cad17ca625f6a8305452518e0c`) e de metadados (`fbde012`, `e552e8c`) presentes e ancestrais de HEAD. Linhas de conclusão versionadas conferidas sem Observações.
- Inspecionados diffs filtrados HEAD/staged/unstaged, todos os seis arquivos novos permitidos, `src/role-runner.mjs`, `src/run-control.mjs`, `src/operational-json.mjs`, testes/fixture/helper/smoke e contexto de `PiLease.launch/finish` e `PiDriver.cancel/shutdown/terminate`.
- Fontes iniciais selecionadas lidas (task, restrições comuns, contrato e decisões vigentes); documentação narrativa e configuração integral reservadas ao confronto.

### Checklist da task

1. **Fazer — interface local durante execução:** `cancel --artifacts-root ... --run-id ...` e `requestCancellation` selecionam diretório de UUID v4 validado e mailbox com identidade correspondente; rejeitam travessia, links e conteúdo inválido. Não se envia sinal a PID fornecido pelo controlador. `control.guard` serializa operações curtas, sem manter guarda durante espera assíncrona do Driver. O guard abandonado falha fechado, sem remoção automática.
2. **Fazer — interromper fases e encerrar:** cada fase consulta o mailbox; watcher de 100 ms observa cancelamento durante espera de resposta; pedido persistido durante bootstrap é revisto antes de `get_state`/prompt. Cancelamento aciona Driver, termina o Pi identificado e persiste `interrupted` com `taskApproved:false`. Falhas de controle não resultam em sucesso.
3. **Fazer — repetição, alvo e corrida:** publicação concorrente produz um único `requested` e demais `already_requested`; fechamento transacional arbitra pedido versus término. Pedido aceito antes do fechamento domina o resultado inclusive após settlement natural; depois do corte é `too_late` ou `blocked`. Repetição de run antigo não toca o novo nem processo testemunha. Incerteza conserva lease bloqueante.
4. **Não alterar — sem serviço/HTTP/IPC genérico/segundo Pi:** atendido. Mailbox específico por run e invocações Node curtas; watcher só existe durante o Runner; nenhum lançamento Pi no comando de cancelamento, servidor ou porta nova.
5. **Não alterar — não prosseguir/liberar diante de incerteza:** atendido. Fases bloqueadas por cancelamento/erro; release depende da política de término e identidade do lease existente. Teste com Driver incerto confirma `uncertain`, `released:false` e impedimento de nova aquisição.
6. **Entregável — interface, tratamento, eventos/resultado:** código e evidências presentes; documentação adiada ainda deverá ser conferida na fase 2.
7. **Entregável — testes efetivo/repetição/corrida/alvo:** presentes, reexecutados, abrangendo controlador externo, alvo resistente, processo testemunha, pedidos em bootstrap/fases/shutdown, corte terminal e guard abandonado.
8. **Critério de conclusão:** demonstrado nesta execução, inclusive com Pi real, sem falso `completed` ou aprovação oficial. O caso real tardio registra `interrupted` mesmo com resposta natural já concluída; não é usado como prova de aborto durante resposta ativa.
9. **Limites gerais:** nenhum workflow de papéis/gates oficiais, Git Gateway, automação de commits/transições ou alteração de protótipos foi introduzido nos entregáveis filtrados. Mudanças documentais ainda serão confrontadas.

### Validação própria

- `npm.cmd --prefix src test`: **114/114 passaram**, zero skips/falhas; Windows nativo, duração 137758 ms. Inclui cancelamento por CLI externa em streaming e fallback forçado, confirmação de árvore e readmissão somente após término.
- `npm.cmd --prefix src run test:runner-cancel`: **passou**, Windows `win32`, Node `v24.20.0`; duas execuções Pi sequenciais em workspace fictício descartável. Evidências próprias: `C:\Users\User\AppData\Local\Temp\devout-runner-cancel-smoke-mDMtU5\smoke-summary.json` e arquivos dos respectivos runs, fora do repositório.
- Caso ativo `run-7ce0e6b1-a794-435e-baa0-4d418c61b07d`: resposta iniciada 13:00:47.533Z, pedido 13:00:47.544Z, consumo 13:00:47.588Z, settlement 13:00:47.613Z (seq 6 < 7 < 10). `aborted:true`, `assistantError:true`, `abortAccepted:true`, `workCompleted:false`, `forced:false`; `interrupted`, `terminated`, lock liberado após prova de ausência dos processos.
- Caso tardio `run-a2e88dfb-eceb-4869-9736-0ae3add6463d`: pedido no evento `stopping`, resposta natural observada, resultado `interrupted`, término confirmado; não afirma aborto efetivo após settlement. Nos dois casos, Runner fechado, processo alheio vivo, repetição `too_late`, ausência de PIDs conferida por CIM e nova aquisição/liberação do lock demonstrada. Registro oficial inalterado pelo smoke.
- O helper de evidência ativa exige ordem request/consumo antes de settlement e flags de interrupção efetiva; regressões rejeitam pedido/consumo tardio, empate de milissegundos, falha prévia, só recibo de abort e ausência de settlement.

### Achados e conclusão preliminar

Nenhum bloqueador ou importante identificado na avaliação independente. Aprovação preliminar condicionada ao confronto completo das narrativas, guias, configuração e diffs adiados; não autoriza commits.

### Manifesto SHA-256 das fontes recebidas

```text
docs_devout/plano.md fc073adb7ccb622a5e2994021a93dced132d397e9de91ba623355aac0dbb1356
AGENTS.md 466d04893beeb780bfe726b985e64f4cd1c4d69cb550605669fb91b04bcf24e1
docs_devout/02-design/contrato-orquestracao-mvp.md 34845bd0154612091c44d969216e488679fcd6184958c124a73b7b14aebb63dd
docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md a4855eacf2083f3eed1d563507f3560baeea9facab21a52cbe349d069f18903a
docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6
docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8
docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018
docs_devout/how-to/diagnosticar-ambiente-windows.md 85d0e049136eb8ba35cb073e0c043fe29cc9eaea5979f86bbfff6bff8972b562
src/README.md ea9399f83e4f0b3578bda8a5e4318c64859f9c86d1fa32361a9ec4da49031f9c
src/PI-LOCK.md 527f93092dcec93306b9200ab800658a488ea1159adbe3a4141b83cc0579560d
src/ROLE-RUNNER.md b3d030912d8385eb10a3eb6a1bd0c775aeb198a595dc95a6f34bdff4a2cfb5a4
prototipo/prova-integracao-openclaw-pi/probe-pi-rpc.mjs 47e7c81ecaab144482c976fbaabf1a1e924fc4f2b78963b4298b0350a0776d84
prototipo/prova-integracao-openclaw-pi/experimento-integracao-openclaw-pi.md 43d38a9c7bfe82cc72848f40a3cab619a88e0609a09a7f3ae1bc6e332aa2ba21
prototipo/prova-pi-eventos-rpc-v2/pi-rpc-eventos.mjs d51acfced0bc0168540dfe9291629ab3dc859ad60270f4603228fce33b367461
prototipo/prova-pi-eventos-rpc-v2/README.md 1af6923df71cae73a9e96cd1e442ba92c928433ee66883b47cd1fd311d4a66d6
prototipo/teste-cancelamento-pi/pi-rpc-abort.mjs f074f1752ba7c869b0a20e917305fbe5c9065b2e791d256fab700b7488580abc
prototipo/teste-cancelamento-pi/README.md e4ae6ddb7177a647302c33a77934ae00578571e16a4db5a930b2609f07ad3f98
```

Hashes dos diffs das fontes: HEAD/unstaged `492854eefb555d4052098eb15c2ec94ca78c863c10bc7d662de91ad9f90a7c9d`; staged vazio `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

## Confronto com relatos

Examinados somente após persistir a avaliação independente: relatório integral T05 (implementação, preparação e correção), revisão R1 finalizada, Observações, guias `README.md`, `PI-LOCK.md` e `ROLE-RUNNER.md` integrais, configuração, trechos adiados do plano/contrato/ADRs, diagnóstico, registro histórico de integração e os seis arquivos de protótipos selecionados. Conferidos todos os caminhos do inventário e todos os diffs adiados HEAD/staged/unstaged; HEAD e unstaged idênticos, staged vazio. Fontes históricas/protótipos/skills/Driver/lease não apresentam alterações. Nenhum conteúdo alheio identificado; nenhuma mudança de index ou código pelo revisor.

### Histórico e preparação

- Há **uma correção completa**, seção `Correção após revisão 1`, compatível com R1 e com o estado recebido. R1 não foi reescrita; a retificação das evidências iniciais foi acrescentada ao relatório, preservando a história. Esta é R2, não reinício de contagem.
- A configuração acrescenta apenas M01-T05. Comparação estrutural própria com HEAD, usando leitura UTF-8, confirma T01–T04 idênticas. O mapa acompanha essa seleção e o plano só converte quatro rótulos em subtítulos, sem alteração dos requisitos/dependências. Partições e conteúdos iniciais/adiados correspondem às fontes; os guias e narrativas não foram antecipados.
- Documentação atual corresponde à implementação: mailbox por UUID, pedidos idempotentes, arbitragem curta, bootstrap, limite de contenção, corte final, significado restrito de recibos e falha conservadora. Não promete autenticação/sandbox, abort ativo após settlement ou reconciliação automática. Integração OpenClaw continua reservada à T06.

### T05-R1-I01 — confronto e encerramento

O achado importante da R1 era um falso positivo do **harness**, não erro na prevalência de pedido tardio do Runner. A correção permaneceu nesse escopo: helper de evidência ativa, asserções do smoke, prompt fictício longo, controlador independente já carregado, regressões, roteiro e retificação do relatório. Driver, lease, Runner e mailbox não foram modificados na rodada de correção descrita.

Verificação própria dos journals/controles/resultados históricos com `activeCancellationEvidence`:

| Evidência externa | Resultado nesta reauditoria |
| --- | --- |
| Implementação inicial `devout-runner-cancel-smoke-gFUaqj`, run `run-d8592fba-593c-4c17-834e-88f56e7eb805` | Rejeitada: `ACTIVE_CANCEL_ORDER_INVALID` |
| R1 `devout-runner-cancel-smoke-azUKs1`, run `run-bfdf0f68-c49e-40ad-8c78-eb4c94aedf1c` | Rejeitada: `ACTIVE_CANCEL_ORDER_INVALID` |
| Correção `devout-runner-cancel-smoke-jo9EIP`, run `run-878faf69-9556-4b7b-bcdb-20440b4ce238` | Aceita: texto 12:47:57.138Z, pedido .151Z, consumo .226Z, settlement .248Z; seq 6 < 7 < 10 |
| Execução própria R2 `devout-runner-cancel-smoke-mDMtU5`, run `run-7ce0e6b1-a794-435e-baa0-4d418c61b07d` | Aceita com ordem e interrupção efetiva, conforme fase 1 |

Os dados históricos foram somente lidos, não alterados. O caso determinístico de resposta natural rápida seguido de pedido externo durante `finish` reproduz a condição antiga e agora exige rejeição do falso positivo, mesmo com `interrupted` e `abortAccepted:true`. Ausência de `prompt_observed` é aceitável porque `Driver.cancel()` rejeita imediatamente o waiter; settlement no journal e flags finais continuam obrigatórios. Não se exige artificialmente que o prompt retorne normalmente após cancelamento.

**I01 resolvido.** Relatório reconhece expressamente que os dois antigos `pass:true` não eram prova ativa; a nova prova do corretor e a reprodução independente R2 satisfazem a pendência. O caso distinto em `stopping` continua válido sem ser apresentado como aborto de geração ativa. A CLI independente permanece coberta pelos processos fictícios/força e pelas repetições reais; a API do smoke roda em processo controlador diferente do Runner, compatível com a task.

### Validação adicional e atualidade

- `npm.cmd --prefix src run test:runner`: **passou**, regressão normal com Pi real. Run `run-42d75e7b-1e6b-426c-8451-6bb5f3907309`, `succeeded`, `taskApproved:false`, marcador/settlement corretos, término sem força, lock liberado, CIM sem PIDs remanescentes, Runner fechado e reaquisição confirmada. Registro inalterado. Evidência: `C:\Users\User\AppData\Local\Temp\devout-runner-smoke-fDuikl\smoke-summary.json`.
- Diagnóstico próprio: Node `v24.20.0`, npm `11.19.0`, OpenClaw `2026.11.3 (847611d)`, Pi `1.5.2`, launcher `C:\Users\User\.pi\agent\bin\pi.cmd`. Não se exigiu Gateway para T05 nem se alterou sua configuração.
- `git diff --check` integral: exit 0. Não há build/lint definido; nenhuma dependência instalada.
- Preparador executado novamente com a mesma configuração e `--check-input` antes do parecer: exit 0, mesmos `input_id`, HEAD, hashes e snapshot da avaliação inicial. Somente esta revisão narrativa foi criada nesta execução; nenhuma mudança concorrente da entrega/fontes detectada.

## Decisão final

**Resultado: APROVADA TECNICAMENTE na R2.**

Contagem: **0 bloqueadores, 0 importantes, 0 melhorias opcionais novas; 1 correção completa.** O achado obrigatório **T05-R1-I01 está resolvido**, com regressão determinística, rejeição comprovada dos falsos positivos históricos, retificação preservando a história e nova prova real reproduzida pelo revisor.

Todos os itens de Fazer, as duas proibições, ambos os entregáveis e o critério da M01-T05 estão atendidos. Suíte própria **114/114**, smoke de cancelamento real **2/2** e regressão normal real passaram no Windows, sequencialmente. Cancelamento ativo, pedido de último instante, alvo correto/processo alheio, repetição, escalonamento, término e bloqueio por incerteza foram conferidos. Não foi necessário nem realizado ajuste de código pelo revisor.

**Encaminhamento:** manter `aguardando revisão` e acrescentar às Observações, via `update_registro.py`, a aprovação R2 e `revisão aprovada; aguardando autorização dos commits`, preservando o histórico. O pedido do usuário cobre revisão, **não autoriza os dois commits**. Nenhum commit, integração, troca de branch ou avanço para T06 realizado. A task só poderá ser declarada concluída/liberada após autorização explícita cobrindo commit funcional e commit exclusivo do registro, revalidação da entrega e confirmação dos dois hashes.
