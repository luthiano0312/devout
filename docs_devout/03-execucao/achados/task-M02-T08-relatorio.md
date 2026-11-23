# M02-T08 — Relatório da implementação inicial

**Estado da entrega:** aguardando revisão independente; NÃO é aprovação técnica.
**Data:** 2026-11-23.
**Papel:** implementador. Sem troca de papel, commits, reboot automático ou recuperação operacional.

As etapas parciais abaixo foram preservadas cronologicamente. As ações manuais do
operador e a situação final estão no fechamento ao final deste relatório.

## Entrada e gates

- Pedido: implementar M02-T08; criação de branch própria autorizada em seguida.
- Branch criada: `feat/m02-t08`, a partir de `cb64e89fdb9f7c9c75741dca91b1adf61d5e82ac`.
- Baseline documental confirmado nesse commit: plano aprovado, mapa, registro,
  seleção M02-T08, contrato reconciliado de `src/PI-LOCK.md` e apêndice da R2 da
  M02-T03 rastreados/commitados; checkout inicialmente limpo.
- Dependência M01-T03 concluída: funcional
  `647a8501f5b7689a1037495bdd1da5b33cbe0d85` e metadados
  `54d1f0f1fed3bf4d0fd6d7a3799fb4ab93cff0e0`, confirmados no histórico/ancestralidade.
- Quatro campos, manutenção aprovada, dependências e limites da task lidos.
  Não é uma rodada da revisão da M02-T03 nem uma segunda correção dela.
- Estado atualizado pelo script oficial, sem editar a tabela manualmente.

## O que foi implementado nesta etapa

1. **Bloqueio conservador da prova legada:** `pi-lock.mjs` não considera diferença
   de `BootIdentifier` como evidência de kernel anterior encerrado. Sempre consulta
   o proprietário quando a máquina coincide. Fonte desconhecida/flag textual de
   qualificação não habilita recuperação. As provas existentes de ausência antes
   do lançamento e de recibo durável continuam disponíveis.
2. **Coletor separado, ainda não qualificado:** leitura nativa candidata de
   `KUSER_SHARED_DATA.BootId`, com fonte explícita, máquina, arquitetura AMD64 nativa
   e build/layout conferido contra `RtlGetVersion`. CIM/Kernel-General 12 e campos
   sanitizados de Kernel-Power 42/107 são observações corroborantes, não provas de
   término para produção. Sem mudanças de política, instalação ou shell variável.
3. **Roteiro opt-in de qualificação:** cria uma lease incerta inteiramente sintética
   sob o guard nativo, sem criar Driver/Pi. Mantém a fixture bloqueada e intacta;
   só lê o hash da lease operacional. Snapshots imutáveis e hashes das fontes
   permitem recusar continuidade após mudança de código. Raiz operacional ou
   diretório arbitrário não são aceitos como fixture.
4. **Comparações/testes:** estabilidade no mesmo kernel; recusa de fonte/formato
   inválidos, overflow, contexto divergente, prova ausente, GUID divergente,
   proprietário vivo/incerto/ausente/reutilizado e falta de eventos novos ordenados
   de suspensão/hibernação. Reboot simulado exige mudança do candidato e observações
   corroborantes, mas SEMPRE mantém `qualified:false`.

O coletor não integra o guard de produção. Não foi introduzida opção de liberação,
conversão silenciosa do legado ou autorização por texto. Nenhuma etapa do roteiro
chama `reconcilePiLock`, inicia Pi ou executa ações de energia.

## Arquivos

Alterados:

- `src/pi-lock.mjs`: desativação da prova inválida do GUID.
- `src/test/pi-lock.test.mjs`: expectativa legada corrigida e quatro regressões de
  fonte não qualificada/estado do proprietário, preservando a lease nas recusas.
- `src/PI-LOCK.md`: situação parcial, comportamento efetivo e roteiro.
- `docs_devout/03-execucao/registro.md`: estado/observações via atualizador oficial.

Novos:

- `src/windows-kernel-candidate.ps1` e `src/windows-kernel-candidate.mjs`.
- `src/test/qualify-kernel.mjs`.
- `src/test/windows-kernel-candidate.test.mjs`.
- `src/test/kernel-qualification-procedure.txt`.
- Este relatório de implementação parcial.

## Comandos e resultados próprios

Ambiente: Windows 10 build 19045 AMD64; Node v24.20.0, npm 11.19.0,
OpenClaw 2026.11.3, Pi 1.5.2. Consultas de versão não iniciaram Pi RPC.
`powercfg.exe /a` informou S3/hibernação disponíveis e Fast Startup desabilitado;
isso NÃO comprova que as transições foram executadas.

```powershell
node --test --test-concurrency=1 src/test/pi-lock.test.mjs src/test/windows-kernel-candidate.test.mjs
```

**Execução final: 56/56 passaram, zero falhas/skips**, incluindo integração Windows
com processos falsos, disputa exclusiva, recuperação anterior ao lançamento,
recibo durável, identidade nativa e recusa após crash de processo falso.

```powershell
node src/test/qualify-kernel.mjs prepare
node src/test/qualify-kernel.mjs same-kernel 'C:\Users\User\AppData\Local\Temp\devout-kernel-qualification-DEmTNK'
git diff --check
```

- Preparo final e nova invocação Node no mesmo kernel passaram; candidato estável,
  fixture incerta bloqueada e lease operacional preservada por hash.
- `git diff --check`: sem erros.
- Não executados: suspensão, hibernação, reboot, ensaio de recuperação fim a fim,
  suíte global `npm.cmd --prefix src test` e smokes reais. A implementação está
  incompleta; não se alega aprovação global nem se repete a bateria conhecida por
  envolver a lease operacional bloqueada durante a R2 da M02-T03.

## Evidências sanitizadas / continuidade

Fixture final, fora do Git:

`C:\Users\User\AppData\Local\Temp\devout-kernel-qualification-DEmTNK`

Contém `manifest.json`, `lease.json`, `guard` e `same-kernel.json`. O manifesto
registra hashes das fontes usadas e da lease operacional; as verificações finais
confirmaram preservação. Não foram publicados mensagens completas de eventos,
logs operacionais, credenciais ou conteúdo da lease real neste relatório.

Observações próprias no mesmo kernel: candidato BootId `87`, build `19045`,
Kernel-General 12 record `17683` e CIM LastBootUpTime
`2026-11-23T10:48:51.5000000Z`. Essas leituras NÃO qualificam distinção após reboot.

O primeiro ensaio preparatório também foi preservado em
`C:\Users\User\AppData\Local\Temp\devout-kernel-qualification-31jAAJ`.
Executou apenas preparo/mesmo kernel antes dos últimos ajustes do coletor e da
vinculação de hashes. Não serve à continuidade do roteiro atual. Não houve caso
negativo de reboot/resume apagado ou repetido para ocultar falha.

Para continuar, usar a fixture FINAL e o roteiro
`src/test/kernel-qualification-procedure.txt`. As ações de energia são manuais,
com trabalho salvo, agentes/controladores fechados e nenhum Pi do workflow ativo.
Não editar as fontes durante a coleta; preservar/informar falhas, sem alterar JSONs.
Este é um ensaio de qualificação, não o ensaio final de recuperação.

## Entregáveis / critério de conclusão

| Item | Situação |
|---|---|
| Desativar uso indevido do GUID legado | Implementado e testado |
| Estabilidade do candidato no mesmo kernel | Observada em processos independentes |
| Não confundir suspensão/hibernação com término | Comparações implementadas; transições reais NÃO executadas |
| Distinção após reboot real | Pendente de ação manual e avaliação da fonte |
| Detector de produção com identidade qualificada | NÃO implementado; fonte ainda não qualificada |
| Novo formato/captura/persistência das leases | Pendente; schema legado permanece |
| Ancoragem explícita de legado com token/hash/máquina/kernel | NÃO implementada |
| Reconciliação ancorada sob guard e proteção contra concorrência | Pendente |
| Ensaio fim a fim sintético através de reboot real | NÃO executado; exige protocolo posterior |
| Lease operacional preservada | Hash conferido no preparo e após os testes, sem recuperação |
| Papéis/I1/R2/contagens da M02-T03 preservados | Nenhuma alteração nesses arquivos/fluxos |

## Impedimento e próxima etapa

Sem qualificação real, o plano exige **manter o bloqueio**, não presumir que o
candidato é solução. A implementação foi interrompida nesse ponto externo sem
encaminhar a task para revisão. Continuar no papel implementador após as observações
manuais; avaliar a fonte antes de implementar formato novo e protocolo de legado.
Se o candidato falhar, registrar a falha e manter a lease bloqueada, sem exigir
reboots repetidos sem hipótese/preparação.

Mesmo após qualificar a fonte, ainda faltam implementação/testes de ancoragem,
integridade/token/concorrência e ensaio sintético de reconciliação após reboot
posterior à âncora. Portanto, o reboot de qualificação não deve ser apresentado
como validação final nem como liberação operacional. Recuperação real exige
outra autorização. A mesma R2 da M02-T03 continua incompleta, sem consumir R3.

**Sem commits. Sem aprovação técnica. M02-T08 permanece em andamento.**

## Atualização — coleta manual concluída em 2026-11-23

O relato inicial acima permanece como histórico da etapa anterior às ações manuais.
O operador executou suspensão S3, hibernação e reboot, com capturas antes/depois na
mesma fixture final `devout-kernel-qualification-DEmTNK`. Não houve ação de energia
executada pelo agente, reconciliação ou retomada da M02-T03.

Conferência própria após o reboot: hashes das seis fontes do manifesto coincidem
com o checkout; hashes das leases sintética e operacional continuam iguais aos do
preparo. Todos os pares before/after têm o mesmo token/raiz. As três comparações
foram recalculadas com `compareKernelCandidates` e coincidem com as persistidas.

| Caso observado | BootId antes → depois | Observações |
|---|---|---|
| Suspensão S3 | 87 → 87 | Par Kernel-Power 42/107 novo, TargetState/EffectiveState 4; CIM e evento de boot estáveis |
| Hibernação | 87 → 87 | Par Kernel-Power 42/107 novo, TargetState/EffectiveState 5; CIM e evento de boot estáveis |
| Reboot real | 87 → 88 | Kernel-General 12 record 17683 → 17923; CIM LastBootUpTime 10:48:51.5000000Z → 12:01:05.5000000Z em 2026-11-23 |

SHA-256 dos arquivos de evidência locais, sem publicar os logs:

- `after-suspend.json`: `c80229c0a4e34008fdfa3ed10ab3a504cfaf38f8588c578cedd783dea0d0e4bd`.
- `after-hibernate.json`: `0c1ded356c24019a82822bb2f77bf7c52295f84ca13ce10a49c39c49aaf7872d`.
- `after-reboot.json`: `b61dd76a08a7fc84e4f1dc4242f7e2b7731a5528f85f5a78ee035ca9da43df35`.

Os casos observados satisfizeram as expectativas do coletor no host Windows 10
AMD64 build 19045. Isso não comprova outras arquiteturas/builds, ciclos repetidos,
restauração de VM nem o protocolo de recuperação ainda ausente. `qualified:false`
continua intencional nos arquivos imutáveis: o coletor não habilita política de
produção nem deve ser reescrito para aparentar uma aprovação posterior.

**O impedimento de coleta manual desta etapa foi resolvido.** A próxima etapa de
implementação é avaliar/incorporar a fonte com limites explícitos, implementar o
formato novo e a ancoragem/reconciliação com testes de token/integridade/concorrência.
Depois será preparado o ensaio fim a fim sintético; nenhum novo reboot deve ser
solicitado antes dessa preparação. O reboot de qualificação não satisfaz a condição
posterior a uma âncora que ainda não existe. Não houve alteração do detector de
produção nesta conferência, nem novos testes globais/smokes.

**M02-T08 continua em andamento, não pronta para revisão. Lease operacional
preservada; sem commits ou recuperação.**

## Continuação autorizada — detector/protocolo e preparo do ensaio fim a fim

Após o usuário autorizar a continuidade, o checkout foi revalidado em
`feat/m02-t08`, HEAD `cb64e89fdb9f7c9c75741dca91b1adf61d5e82ac`. As alterações
anteriores foram preservadas. Esta seção atualiza a situação técnica, sem apagar
as declarações das etapas parciais anteriores.

### Implementado agora

- `src/kernel-identity.mjs`: fonte explícita e validação estrita de uint32 canônico,
  máquina, AMD64 e build 19045. Prova exige aumento estrito do contador no mesmo
  contexto. GUID, flag textual `qualified`, mudança de formato/build/arquitetura,
  mesmo valor, rollback e wrap não autorizam recuperação.
- `src/windows-lock-guard.ps1`: substituída a leitura do GUID por leitura dos mesmos
  campos/offsets nativos do coletor medido, conferindo arquitetura nativa, versão
  e build. Restrição adicional ao build 19045; contextos não qualificados falham
  sem fallback. Teste próprio compara captura persistida e coletor independente.
- `src/pi-lock.mjs`: leases novas schema 2; legado schema 1 é preservado, sem
  conversão. `anchorPiLock` exige token/hash inspecionados, proprietário ausente,
  máquina correspondente e fonte qualificada. Escreve âncora imutável com vínculo
  ao hash dos bytes originais, kernel observado e checksum do payload.
- Ancoragem/reconciliação sob o mesmo guard; rechecagem de token, hashes da
  lease/âncora e proprietário antes do efeito final. Arquivo corrompido ou
  alteração concorrente bloqueiam, mantendo evidências. Checksum detecta corrupção
  em diretório confiável; não é assinatura contra administrador malicioso.
- Reconciliação não reescreve o original: grava prova durável separada e arquiva
  bytes originais em `retired-<token>.json`. Colisão no destino não sobrescreve
  evidência. A API mantém token obrigatório e aceita hash opcional da inspeção;
  o roteiro manual usa ambos. Não há force release ou recuperação automática.
- Prova de kernel anterior NÃO substitui ausência comprovada do proprietário:
  `alive`/`unknown` sempre bloqueiam. Âncora criada no kernel atual não libera;
  reboot anterior à âncora não conta.
- Novos `src/test/pi-lock-recovery.test.mjs`,
  `src/test/fixtures/recovery-seed.mjs`, `src/test/smoke-lock-recovery.mjs` e
  `src/test/lock-recovery-procedure.txt`. O worker de preparo é Node temporário,
  sem Pi/Driver. O opt-in só aceita fixture sintética identificada fora do Git,
  fixa hashes das fontes, originais e âncora; nunca opera sobre a raiz real.
- `src/PI-LOCK.md` atualizado. Em `src/test/runner-cancel.test.mjs`, apenas os
  metadados de boot da costura confiável foram adequados ao novo formato: não
  houve alteração de papel, cenário/asserts de cancelamento ou código do Runner.

A aceitação inicial da fonte se apoia na coleta observada/conferida acima e na
paridade do coletor com o guard nativo. **Não generalizada a Windows 11/ARM64 ou
outros builds.** Resta revisão independente de toda a entrega; esta decisão da
implementação não é aprovação técnica. Os arquivos antigos `qualified:false`
foram mantidos imutáveis, sem edição retroativa para aparentar aprovação.

### Testes próprios desta continuação

```powershell
node --test --test-concurrency=1 src/test/pi-lock-recovery.test.mjs src/test/pi-lock.test.mjs src/test/windows-kernel-candidate.test.mjs
node --test --test-name-pattern='uncertain cancelled Driver keeps the real lease policy' src/test/runner-cancel.test.mjs
```

- Bateria pertinente final: **84/84 passaram**, zero falhas/skips.
- Regressão selecionada de cancelamento: **1/1 passou**. Não equivale à execução
  integral do arquivo de cancelamento.
- Cobertura: identidade/fonte, captura/persistência nativa, legado sem âncora,
  reboot anterior à âncora, bloqueio no mesmo kernel, prova posterior, token/hash
  divergentes, owner vivo/incerto, corrupções de campos/âncora parcial,
  alterações concorrentes, guarda indisponível, disputa entre ancoragens,
  preservação dos bytes originais e colisão de arquivo retirado.
- `git diff --check`: passou.
- Suíte global e smokes reais permanecem não executados. Testes de outras tasks
  consomem a lease operacional, ainda bloqueada. Não foi alterada raiz/default/
  `LOCALAPPDATA` para obter passes nem feita recuperação real durante testes.

### Ensaio real sintético preparado (sem reboot nesta continuação)

Fixture FINAL do protocolo, diferente da coleta de qualificação:

`C:\Users\User\AppData\Local\Temp\devout-recovery-smoke-uNxFfv`

Executados:

```powershell
node src/test/smoke-lock-recovery.mjs prepare
node src/test/smoke-lock-recovery.mjs anchor 'C:\Users\User\AppData\Local\Temp\devout-recovery-smoke-uNxFfv'
node src/test/smoke-lock-recovery.mjs before-reboot 'C:\Users\User\AppData\Local\Temp\devout-recovery-smoke-uNxFfv'
```

Ambas as leases sintéticas (`native`/`legacy`) permaneceram bloqueadas; apenas a
legada foi ancorada. O owner do worker foi observado ausente. Saída final:
`readyForManualReboot:true`, `syntheticBlocked:true`, `operationalPreserved:true`.
Nenhum Pi foi iniciado, nenhuma lease operacional foi ancorada/reconciliada.

Também foi executado **deliberadamente no mesmo kernel**, como caso negativo:

```powershell
node src/test/smoke-lock-recovery.mjs after-reboot 'C:\Users\User\AppData\Local\Temp\devout-recovery-smoke-uNxFfv'
```

Recusou com `KERNEL_CANDIDATE_EXPECTATION_FAILED` (exit 1 esperado), antes de
qualquer reconciliação. Conferência posterior: originais mantêm hashes, nenhum
`retired-*`/`reconciliation-*` nem `observed-after-reboot.json` foi criado e o hash
da lease operacional continua igual. Esse negativo não foi ocultado ou resetado;
a mesma fixture está pronta para o reboot manual positivo.

Fingerprints locais sanitizados:

- `manifest.json`: `96040ce6d2bce8584664c7a978e388b90dbbc2a74cf08b625c49fadb8e1d4e4f`.
- `ready.json`: `e0a537f5512ed6100930bc2df86eac644ad671b7d4085b5ff23460e7d3d57cdc`.

**Pendência atual:** operador salvar trabalho, encerrar agentes/controladores,
confirmar ausência de Pi do workflow e reiniciar manualmente; depois executar
`after-reboot` do script NOVO sobre essa MESMA fixture. Essa operação é a
reconciliação explícita somente das duas leases sintéticas. Não editar código ou
repetir `prepare`/`anchor`/`before-reboot` na fixture existente. Erros devem ser
preservados para diagnóstico, sem retry cego ou novos reboots.

### Situação dos gates agora

Detector/formato/protocolo e testes determinísticos estão implementados. O ensaio
fim a fim através de reboot posterior à âncora **ainda não foi executado**. Logo,
M02-T08 permanece **em andamento**, sem aprovação, commits ou passagem para revisão.
A R2 da M02-T03, sua I1 e as contagens foram preservadas. Recuperação operacional
posterior continua sujeita a autorização separada após conclusão da M02-T08 e pode
exigir outro reboot DEPOIS da própria âncora operacional.

## Fechamento da implementação — ensaio fim a fim conferido

O operador executou a reinicialização manual preparada e depois:

```powershell
cd C:\Users\User\projetos\devout
$r = 'C:\Users\User\AppData\Local\Temp\devout-recovery-smoke-uNxFfv'
node src/test/smoke-lock-recovery.mjs after-reboot "$r"
```

Saída persistida: `syntheticReconciled:true`, `originalLeasesPreserved:true`,
`anchorPreserved:true`, `operationalPreserved:true`, `piLaunched:false`,
`automaticRebootPerformed:false`. As duas razões foram
`NATIVE_PRIOR_KERNEL_ENDED` e `ANCHORED_PRIOR_KERNEL_ENDED`.

### Verificação própria pós-reboot

Não foi aceita apenas a saída da conversa. Os arquivos locais foram lidos e
verificados por assertions, sem repetir a reconciliação:

- Oito hashes de fontes no manifesto coincidem com o checkout entregue.
- Comparação de `ready.json` com `observed-after-reboot.json` recalculada:
  BootId observado **88 → 90**; evento Kernel-General 12 **17923 → 18185**;
  CIM mudou. O protocolo exige aumento estrito, não presume incremento unitário
  ou quantidade de reinicializações. Identidade de máquina/fonte/build permanece.
- Para ambas as fixtures, o `lease.json` deixou de existir por arquivamento;
  `retired-<token>.json` mantém exatamente o SHA-256 original do manifesto.
- Cada prova durável é única na sua fixture e vincula token/hash original,
  kernel atual, proprietário ausente (`gone`/`reused`) e motivo esperado.
- Na legada, âncora mantém seu hash de `anchored.json`; checksum do payload,
  vínculo ao token/hash original e referência na prova durável conferem.
- Inspeções próprias nativas das duas fixtures arquivadas retornaram
  `canAcquire:true`, sem aquisição/lançamento de Pi.
- Hash da lease operacional permanece igual ao do preparo. Nenhuma operação de
  recuperação/aquisição foi executada sobre a raiz operacional.

Fingerprints sanitizados adicionais:

- `completed.json`: `8d615e453a4cedb1ad7ed1a44cf0cae17223d4777c3cb649b430cf52ea92a427`.
- `observed-after-reboot.json`: `bdf38d8c45aa12d185d095649d9b2f18bbf00654f3603cd4c74b65d1043bc175`.
- Prova nativa: `826ab5aa7f678c12c7ba9a8c141b03ef7d76d29a21332bf74aa9362e61002af4`.
- Prova legada: `5a8e7803616395a75050eb0a9788006363e82d2daca1ab87697fd1f0fea542ba`.

Os originais e dados operacionais completos permanecem fora do Git. Não executar
novamente `after-reboot` sobre a fixture concluída nem alterar seus arquivos.

### Testes finais após o reboot

Reexecutados os mesmos comandos pertinentes da seção anterior:

- `node --test --test-concurrency=1 src/test/pi-lock-recovery.test.mjs src/test/pi-lock.test.mjs src/test/windows-kernel-candidate.test.mjs`:
  **84/84 passaram**, zero falhas/skips.
- `node --test --test-name-pattern='uncertain cancelled Driver keeps the real lease policy' src/test/runner-cancel.test.mjs`:
  **1/1 passou**, sem alegar execução dos outros casos desse arquivo.
- `git diff --check`: passou.

Suíte global e smokes Pi reais continuam não executados: envolvem a lease real
bloqueada e não foram contornados mediante troca de raiz/configuração. Não há
comando de lint definido. Não se alega aprovação global nem validação de outros
builds/arquiteturas ou de recuperação de tasks/registro do Slice 4.

### Entregáveis e critério de conclusão — declaração do implementador

| Item exigido | Evidência declarada |
|---|---|
| Identidade nativa qualificada, estabilidade e distinção | Coleta real S3/hibernação/reboot e paridade guard/coletor; limitada a Windows 10 AMD64 build 19045 |
| Captura/persistência/comparação novas, sem confundir formatos | Schema 2 com fonte/máquina/build/arquitetura; schema 1 preservado; testes de fonte/formato incertos e rollback |
| Ancoragem explícita íntegra de legado | `anchorPiLock`, guard nativo, token/hash/kernel e checksum; original intacto; ancoragem real da fixture |
| Reboot posterior à âncora e reconciliação explícita | Ensaio sintético real concluído, razões nativa/ancorada verificadas; prova anterior à âncora não é aceita nos testes |
| Token divergente/concorrência/prova ausente/recuperação recusada | Bateria pertinente e caso negativo real no mesmo kernel, sem retirar originais |
| Evidências e roteiro sem Pi/reboot automático | Dois roteiros opt-in em `src/test/`, hashes/resumos neste relatório, dados operacionais fora do Git |
| Lease operacional e limites M02-T03 preservados | Hash conferido, sem recuperação; I1, papéis, R2 incompleta e contagens não alterados |

**Implementação inicial entregue para revisão independente.** Persistir este
fechamento antes da transição oficial para `aguardando revisão`. Isso não conclui a
task, não autoriza commits e não libera a próxima task. Próxima conversa deve ser
do papel revisor da **M02-T08**, usando a seleção existente antes de ler este relato.

Limites restantes: revisão independente, commits funcional/metadados após autorização
explícita e, posteriormente, autorização própria para recuperação operacional.
A M02-T03 não foi retomada nem aprovada nesta conversa.

## Correção após revisão 1

Referência: `task-M02-T08-revisao-1.md`, **R1 finalizada**, Decisão final I1
(importante). Esta é a **primeira correção completa da M02-T08**; não altera as
contagens da M02-T03. Handoff conferido em `em correção`, branch `feat/m02-t08`,
HEAD/baseline `cb64e89fdb9f7c9c75741dca91b1adf61d5e82ac`, com dependência M01-T03
concluída e seus dois commits ancestrais. Trabalho preexistente preservado.

### Achado tratado e arquivos modificados

- `src/test/qualify-kernel.mjs`: preparo agora grava schema 1 válido com máquina
  do guard e UUID legado **explicitamente artificial**. Não copia `guard.boot`
  nativo para schema 1, não inventa identidade histórica e não cria âncora.
  O candidato real continua separado nas observações. Nenhuma alteração nesta
  correção ao detector, validador ou protocolo de produção.
- `src/test/windows-kernel-candidate.test.mjs`: regressão positiva executa
  `prepare` e `same-kernel` em processos Node distintos, confere formato/record,
  estado bloqueado sem possibilidade de reconciliação, observação imutável,
  bytes/hash da lease sintética, manifesto e preservação da lease operacional.
  Confere também ausência de arquivos de âncora/reconciliação na fixture.
  Fixtures ficam preservadas fora do Git, inclusive em caso de falha.
- `src/test/kernel-qualification-procedure.txt` e `src/PI-LOCK.md`: reconciliados
  uso atual e coleta histórica; retiradas afirmações correntes de protocolo ainda
  inexistente. Esclarecidos UUID artificial, bloqueio por ausência de âncora,
  manifesto novo para fixture nova e roteiro separado do ensaio fim a fim.
- Este relatório recebe somente append; registro atualizado pelo script oficial
  somente depois desta persistência, devolvendo M02-T08 para revisão.

### Testes/comandos próprios e resultados

1. Antes do ajuste, com a regressão nova:
   `node --test --test-name-pattern='qualification prepare and independent' src/test/windows-kernel-candidate.test.mjs`
   reproduziu **1 falha**, `prepare` exit 1 / `SYNTHETIC_LEASE_NOT_BLOCKED`.
   A fixture criada permaneceu fora do Git; nenhum comando de energia foi usado.
2. Após o ajuste, mesmo comando: **1/1 passou**, sem falhas/skips; fixture
   `%TEMP%/devout-kernel-qualification-99r7b9` preservada.
3. `node --test --test-concurrency=1 src/test/pi-lock-recovery.test.mjs src/test/pi-lock.test.mjs src/test/windows-kernel-candidate.test.mjs`:
   **85/85 passaram**, zero falhas/skips. Log fora do Git:
   `%TEMP%/devout-T08-correction1-targeted-Kfi1ln.txt`.
4. `node --test --test-name-pattern='uncertain cancelled Driver keeps the real lease policy' src/test/runner-cancel.test.mjs`:
   **1/1 passou**, sem falhas/skips. Log:
   `%TEMP%/devout-T08-correction1-cancel-Dd90Bo.txt`.
5. Assertions adicionais via Node: seis hashes de fontes da fixture final
   coincidem com o checkout; SHA-256 operacional coincide tanto com o manifesto
   novo quanto com o histórico `devout-kernel-qualification-DEmTNK`. A lease
   histórica mantém seu hash original. `git diff --check`: passou.

A regressão final preservou `%TEMP%/devout-kernel-qualification-bEnTpQ`, com hashes:

- `manifest.json`: `75f4ca510b6ce02e3fb1e82b9bcd5f47d2e3fd924acb613ffcac62b5a64d36b7`.
- `lease.json`: `a61a4c315c29c718254e0ed714677fabddb4f6b21c366cf068149a09752c80a2`.
- `same-kernel.json`: `85f7082fb46a54bddce3b06700dc5f17b6aab8531096c3127396b37cafe2b22a`.

### Preservação histórica e limites

`qualify-kernel.mjs` mudou de SHA-256 histórico
`6c0ea5944fc1fcf4cd579c2b7939e1c990d67b735902b9752a21ead11aaa01ef` para
`467936069be0bbc816bcf1d570e980e06352be11a3c6e2ccfcb53ac1a9bd47a3`.
Isso impede continuar coletas antigas com o checkout corrigido; não altera seus
manifestos, observações ou resultados. Nenhum artefato histórico foi reescrito.
O coletor e a política de produção permanecem inalterados nesta correção.

Não foram repetidos S3, hibernação, reboot ou ensaio de recuperação: I1 é ajuste
de preparo, validado sem energia. Nenhum Pi foi iniciado, nenhuma lease foi
ancorada/reconciliada e a raiz operacional não foi trocada. Suíte global e smokes
Pi reais não foram repetidos; permanece o limite ambiental registrado na R1,
sem alegar aprovação global. Nenhum commit ou avanço/retomada da M02-T03.

**Correção 1 entregue para reauditoria independente R2 da M02-T08 em conversa
nova.** Não é aprovação técnica nem conclusão da task; não autoriza commits ou
recuperação operacional.
