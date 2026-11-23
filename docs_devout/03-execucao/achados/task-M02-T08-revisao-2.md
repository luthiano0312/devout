# Revisão M02-T08 — rodada 2
Estado: finalizada
Snapshot da entrega: e8ad6c75c99d3e752d3f7faf2c6a24f65116391dc88ab93ad6fd863ccde50c61
Entrada: 5e1715ab8b3b5352e8fec3e81fb230f7ce596aad94b8743845f1ccaa6b195a1d; revisão Git: cb64e89fdb9f7c9c75741dca91b1adf61d5e82ac.

## Identificação da entrada

Entrada integral temporária fora do repositório: `C:\Users\User\AppData\Local\Temp\devout-m02-t08-review-F3HqgJ\input.json`. Preparada com `review_inputs.py` e seleção M02-T08; `--check-input` reconfirmado antes desta persistência. Nenhum conteúdo de relatório, Observações ou revisão anterior foi aberto antes desta avaliação. A R1 consta como finalizada nos metadados; esta é a rodada seguinte, sem sobrescrevê-la.

Hashes SHA-256 dos bytes integrais da configuração/fontes:

- `docs_devout/03-execucao/fontes-revisao.json`: `3eaed63884697efdbf26847757291bdead1c9f240f25978d8f0a621c1809ec3e`
- `docs_devout/plano.md`: `c26a9281ce1bcb7c2d1d56019e3358e140cbc1135cdf2af49b6ada4772a3f4c3`
- `AGENTS.md`: `b2c0c6cf328a7d0458b02bc18d754be2e9a08b37417341dfe4ef3c09f13b6f80`
- `src/PI-LOCK.md`: `5ed40953b85aabd007a8fe734b3abcdbda575db5e91aabfd316ba6909ca9e460`
- `docs_devout/02-design/contrato-orquestracao-mvp.md`: `4cf19380d07012be6f67d144acb74ae3e0393e16727c3501083f8f3aa8dbdbd2`
- `docs_devout/02-design/arquitetura-hld.md`: `194a7c6db6ec51b94b671044442e282ab98d69079f6f0fcee2143bbf09756988`
- `docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md`: `31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6`
- `docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md`: `8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8`
- `docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md`: `306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018`
- `docs_devout/01-requisitos/escopo.md`: `8c08fe3775f1e8aef9394c8a7220e29ff9a275d461e16d3be484602a43d6f0f7`
- `.agents/skills/implement/SKILL.md`: `7e14e2819878e14397f815b526933e4f4f08cdd62aba8261fc0fe4bd0a0f0f1a`
- `.agents/skills/implement/references/implementador.md`: `7a58b7b61f8a09e97041b01a6841bdb125ac831c63093aaf5161d7f9e2a83695`
- `.agents/skills/implement/references/entradas-independentes.md`: `c5c1f01d69f71ab31bad74d103db09ec2d85bab33c7211f8025e7b181dfbbdea`
- `src/package.json`: `e7d7c40faf70f982429f70c6808083f3e67af1cef6b8f0537903aac601f610f9`
- `src/README.md`: `ed1f514a6eb163be04d1f6d0d1bf1fba89411fc13a86c5972da18ea6c745b493`
- `src/ROLE-RUNNER.md`: `3f15e0ae7a5efc05faa6b7c2c754f513fa99b515677cce03a48da2957697f110`
- `src/OPENCLAW.md`: `909705dfa67b3a0d8e9e618e6b1a26914407289c1ac485756c1126e4f3fdd7b0`
- `docs_devout/how-to/diagnosticar-ambiente-windows.md`: `8b5792657a7f4d1565620327a4f88aed498919682a6d3e74cb60da5766b14070`

## Avaliação independente

### Gate e escopo

- Estado inicial `aguardando revisão`, branch `feat/m02-t08`; baseline documental rastreado em `cb64e89fdb9f7c9c75741dca91b1adf61d5e82ac`, incluindo plano, mapa, registro, seleção, contrato PI-LOCK e evidência pendente da R2 M02-T03. Dependência M01-T03 concluída: funcional `647a8501f5b7689a1037495bdd1da5b33cbe0d85`, metadados `54d1f0f1fed3bf4d0fd6d7a3799fb4ab93cff0e0`, presentes no histórico.
- Examinados diffs filtrados HEAD/unstaged (iguais), staged vazio e todos os dez arquivos novos permitidos, além do contexto integral de `pi-lock.mjs`, guard JS/PowerShell e testes envolvidos. Alterações de código limitadas à identidade, recuperação e adequação de fixtures. Documentação/relatos adiados serão confrontados na fase 2.

### Fazer, entregáveis e critério

- Captura nativa: guard lê BootId e build da página compartilhada, verifica AMD64/Windows 10 build 19045 e estabilidade de duas leituras; política recusa GUID/flags textuais/contextos não qualificados. Contador igual/retrocesso/wrap não comprova término. Qualificação empírica de suspensão/hibernação/reboot ainda depende da conferência das evidências na fase 2; não foi repetida nesta execução.
- Persistência: leases novas schema 2 com fonte/build/arquitetura/máquina; schema 1 permanece legado sem conversão silenciosa. Comparação exige mesma máquina/contexto, avanço nativo e proprietário comprovadamente ausente.
- Ancoragem: operação explícita com token e SHA-256 obrigatório, guard existente, arquivo exclusivo, identidade do kernel atual e checksum do payload. Bytes originais da lease não são substituídos. Mesmo kernel, âncora inválida, hash/token divergente, proprietário vivo/incerto e concorrência mantêm bloqueio.
- Reconciliação: operação separada, revalidação de lease/âncora/guard e proprietário antes de arquivar, prova durável separada e preservação dos bytes originais; colisão de arquivo arquivado recusa sobrescrita. Não há recuperação automática em aquisição.
- Testes cobrem identidade, legado, reboot anterior à âncora, recusas, alteração concorrente, falha de guard, corrupção de âncora, divergência de token/hash e preservação. Roteiros distinguem comandos automáticos de ações manuais; smoke restringe fixture sintética e fixa hashes de fontes/lease/âncora. Ensaio histórico através de reboot e documentação integral pendentes de confronto.

### Checklist de Não alterar (item a item)

1. **Prova incerta/PID/relógio/texto isolados:** não foi encontrada liberação indevida; política exige evidência nativa qualificada, ausência de proprietário e integridade. CIM/eventos corroboram somente o ensaio, não autorizam a recuperação de produção.
2. **Apagar lease/trocar raiz/forçar liberação:** não foi introduzido force-release; originais são arquivados sem sobrescrita. Raízes temporárias pertencem exclusivamente às fixtures sintéticas, sem Pi e sem substituir a raiz operacional.
3. **Reboot automático/lease operacional em testes:** não há comando automático de energia nos entregáveis; não executei reboot, ancoragem ou reconciliação operacional. Os 11 testes globais bloqueados não foram contornados.
4. **Papéis/I1/contagens M02-T03:** código dos papéis e evidências M02-T03 não mudam no inventário desta entrega. Mudança em runner-cancel é apenas adaptação da identidade da fixture; nenhuma alteração de papel ou contagem.

### Validação própria

Ambiente: Windows nativo x64, Node `v24.20.0`.

- `npm.cmd --prefix src test`: **419 testes; 408 passaram, 11 falharam, 0 skipped**. As falhas são a pré-condição `inspectPiLock().canAcquire === true`: uma em implementation-runner, oito em role-runner e duas em runner-cancel. A suíte exige lease global livre; não reconciliá-la é uma restrição desta task. Não atribuo essas recusas ao detector nem alego suíte integral aprovada. Log local fora do Git: `devout-m02-t08-review-F3HqgJ/npm-test.log` em `%TEMP%`.
- `node --test --test-concurrency=1 src/test/pi-lock-recovery.test.mjs src/test/pi-lock.test.mjs src/test/windows-kernel-candidate.test.mjs`: **85/85 passaram, 0 skipped**. Inclui guard nativo, paridade de captura, exclusividade entre processos e regressão real prepare + same-kernel em processo independente. Log fora do Git: `recovery-tests.log` na mesma pasta temporária. Fixture desta segunda execução preservada em `%TEMP%/devout-kernel-qualification-eD5OSe`.
- `review_inputs.py ... --check-input <input.json>`: aprovado antes da gravação desta avaliação; entrega/fontes/snapshot inalterados.

### Achados e conclusão preliminar

Nenhum bloqueador/importante identificado no código/testes inspecionados. A aprovação final depende da comprovação histórica da qualificação e do ensaio real, do confronto obrigatório com a R1/correção/relatório e da documentação/diffs adiados. A suíte global permanece limitada pela lease operacional bloqueada; não é autorização para recuperá-la. Nenhuma mudança de código foi feita pelo revisor.

## Confronto com relatos

Iniciado somente após persistir a avaliação independente acima, que permanece intacta. Lidos integralmente o relatório M02-T08 (etapas, fechamento e Correção após revisão 1), a R1 finalizada e Observações. Histórico coerente: **uma correção completa da M02-T08**, após o único importante I1 da R1. A M02-T03 continua com sua própria correção 1 e R2 incompleta; seu apêndice diagnóstico foi consultado como evidência histórica, sem retomar sua auditoria.

### I1 da R1 — resolvido

- `qualify-kernel.mjs` agora persiste schema 1 com máquina do guard e UUID explicitamente artificial, sem `boot.source`. Não relaxou o validador nem alterou o protocolo de produção para aceitar formato misto.
- A regressão Windows em `windows-kernel-candidate.test.mjs` executa preparo e observação em processos Node independentes; confere record válido, estado bloqueado, impossibilidade de reconciliação, bytes/hash originais e preservação operacional. Passou em ambas as execuções próprias (suíte completa e bateria pertinente).
- `PI-LOCK.md` e `kernel-qualification-procedure.txt` distinguem o uso atual, a coleta histórica anterior ao detector e o ensaio fim a fim separado. Explicitam mudança de hash, nova fixture para novas coletas e proibição de editar/reutilizar manifestos históricos. Não exigem novo reboot para corrigir erro de formato.

### Evidências históricas verificadas nesta R2

Conferência por assertions próprias, somente leitura/inspeção, no script temporário externo `devout-m02-t08-review-F3HqgJ/check-evidence.mjs`; resumo externo `evidence-check.json`. Não repeti ações de energia, ancoragem ou reconciliação.

- **Qualificação** em `%TEMP%/devout-kernel-qualification-DEmTNK`: SHA-256 dos três after publicados confere; recalculados pares S3 **87→87**, hibernação **87→87** e reboot **87→88**, iguais às comparações persistidas. Conferidos mesmo token/raiz, estados bloqueados, contexto nativo e eventos ordenados. Lease sintética original mantém o hash do manifesto. Collector JS/PS1 e guard JS permanecem com os hashes da coleta; diferenças limitam-se a pi-lock, guard PS1 e qualify-kernel, conforme a integração posterior e a correção documentadas. O hash antigo de qualify-kernel e o atual coincidem com os publicados; a mudança não foi ocultada nem aplicada retroativamente aos dados.
- **Recuperação fim a fim** em `%TEMP%/devout-recovery-smoke-uNxFfv`: oito hashes de fontes coincidem com a entrega atual. Hashes publicados de manifest/ready/observed/completed e das duas provas conferem. Comparação de reboot **88→90** recalculada e igual à persistida; não se presume incremento unitário. Estados anteriores bloqueados e posteriores reconciliáveis com as razões nativa/ancorada corretas. Os dois originais arquivados mantêm os hashes do manifesto; cada prova é única, vincula token/hash/kernel e proprietário ausente. Âncora mantém hash/checksum, vínculo com lease e kernel de ready, além da referência na prova legada. Inspeção nativa própria de ambas as raízes sintéticas: `canAcquire:true`, sem adquirir/lançar Pi.
- **Correção** em `%TEMP%/devout-kernel-qualification-bEnTpQ`: os três hashes publicados (manifest/lease/same-kernel) conferem; seis hashes de fontes coincidem com o checkout corrigido. Não há necessidade de repetir reboot/S3/hibernação para comprovar o ajuste.
- SHA-256 da lease operacional atual coincide com os manifestos históricos de qualificação, recuperação e correção. Nenhuma recuperação operacional foi executada nesta revisão.

Essas verificações sustentam a qualificação e o ensaio real no contexto limitado **Windows 10 AMD64 build 19045**; não certificam outros builds/arquiteturas, restauração de VM, filesystem remoto ou isolamento forte. As ações manuais de energia são evidência histórica do operador, não execução do revisor.

### Documentos/diffs adiados e validação adicional

- Examinados todos os conteúdos adiados: demais tasks do plano, diagnóstico do mapa, partes históricas do contrato/HLD/escopo e contextos dos três ADRs, PI-LOCK integral, README, ROLE-RUNNER, OPENCLAW e diagnóstico Windows. Examinada a seleção M02-T08 da configuração contra essas fontes. Nenhuma mudança nova de arquitetura ou requisito; o contrato corretivo permanece normativo, sem flexibilização de prova.
- Examinados todos os caminhos do inventário, relatório/R1 novos e diffs HEAD/staged/unstaged adiados: só PI-LOCK e linha M02-T08 do registro mudam; HEAD e unstaged iguais, staged vazio. As demais fontes/configuração permanecem sem diff. As evidências/linha da M02-T03 não mudam. Narrativas intermediárias do relatório estão explicitamente preservadas em ordem cronológica, seguidas do fechamento e da correção, sem serem apresentadas como situação final atual.
- `node --test --test-name-pattern='uncertain cancelled Driver keeps the real lease policy' src/test/runner-cancel.test.mjs`: **1/1 passou**, zero skips, após a persistência independente. Revalida a adaptação da fixture sem alterar papéis ou código do Runner.
- `git diff --check`: passou. Entrada reconferida antes da decisão com o mesmo `review_inputs.py --check-input`: sem alteração de identidade/snapshot/fontes/entrega. Nenhum código/index ou narrativa anterior foi modificado pelo revisor.
- A execução própria integral terminou (diferente dos timeouts anteriores registrados na R1): **408/419 passaram**. As 11 recusas na pré-condição da lease global correspondem ao limite operacional já documentado; não são novos achados da correção nem motivo para contornar o bloqueio. Os testes pertinentes da task passaram **85/85 + 1/1**; não se declara a suíte global verde nem se dispensa a validação futura da M02-T03.

## Decisão final

**Aprovação técnica da M02-T08 na R2: I1 resolvido; 0 bloqueadores, 0 importantes e nenhum novo achado opcional. Uma correção completa.**

O detector restrito ao contexto qualificado, formatos distintos, ancoragem íntegra sem liberação no mesmo kernel, prova posterior explícita sob guard, preservação de originais/evidências e recusas exigidas satisfazem Fazer/Entregáveis/Critério nos limites documentados. Evidências físicas históricas foram conferidas, testes pertinentes repetidos e os quatro itens de Não alterar verificados. Suíte global permanece com 11 falhas de pré-condição operacional, sem atribuí-las ao código desta manutenção ou prometer correção da falha original da M02-T03.

**Encaminhamento:** manter `aguardando revisão` e acrescentar ao registro **“revisão aprovada; aguardando autorização dos commits”**, preservando Observações e timestamp. O pedido desta conversa autoriza revisão, não os dois commits: nenhum commit funcional ou de metadados realizado. A task não está oficialmente concluída e não libera a próxima antes dos dois commits manualmente autorizados e confirmados. Recuperação da lease operacional exige autorização posterior separada; não é autorizada por este parecer. Não retomar nem consumir nova rodada da M02-T03.

## Autorização posterior dos commits

Após a aprovação acima, o usuário respondeu **“autorizo”** ao encaminhamento explícito dos **dois commits**. Autorizados o commit funcional da M02-T08 (código, testes, documentação, relatório e R1/R2) e o commit exclusivo do registro de conclusão. Não autoriza merge, push, recuperação operacional ou retomada da M02-T03.

Antes de preparar o commit, branch `feat/m02-t08` e index vazio reconferidos; `review_inputs.py --check-input` confirmou a mesma entrada `5e1715ab8b3b5352e8fec3e81fb230f7ce596aad94b8743845f1ccaa6b195a1d` e snapshot `e8ad6c75c99d3e752d3f7faf2c6a24f65116391dc88ab93ad6fd863ccde50c61`. Pacote narrativo integral relido, sem divergência do conteúdo examinado. `git diff --check` passou. Nenhuma nova mudança de código ou teste após a aprovação; permanecem os resultados e limites desta R2. O registro ficará fora do primeiro commit; seu hash funcional será preenchido somente após confirmação no Git.
