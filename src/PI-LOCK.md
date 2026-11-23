# Exclusividade de Pi — M01-T03 e manutenção M02-T08

**Situação em 2026-11-23 — implementação M02-T08 entregue para revisão:** identidade nativa, schema 2 e ancoragem/reconciliação implementados; ensaio sintético fim a fim através de reboot real executado e conferido. A fonte habilitada é `windows-kuser-shared-data-bootid-v1`, limitada a Windows 10 AMD64 build 19045. Outros contextos bloqueiam, sem fallback ao GUID legado. Revisão independente e commits ainda pendentes. A lease operacional não foi recuperada.

## Escopo e uso

`pi-lock.mjs` protege Pi **do workflow**, no Windows nativo. Não é sandbox,
não controla Pi abertos por outros programas e não implementa o Role Runner
(M01-T04), cancelamento entre Runners, transições de tasks ou Git.

Todas as invocações independentes devem usar **a mesma raiz absoluta**, fora do
repositório. Default: `%LOCALAPPDATA%\devout\pi-exclusivity` (fallback:
`<home>\devout\pi-exclusivity`). A raiz é global para o orquestrador/conta Windows,
**não** por workspace, task, sessão ou `runId`. Contas diferentes precisam de
configuração comum e permissões compatíveis; defaults separados não coordenam
contas distintas. Não trocar de raiz para contornar bloqueios.

```js
import { acquirePiLock } from './pi-lock.mjs';

const lease = await acquirePiLock({ runId: 'identificador-unico-do-run' });
try {
  const driver = await lease.launch({ piCmd, cwd, profile: 'isolated' });
  // Driver pronto, mas nenhum prompt considerado concluído por isso.
  await driver.getState();
  await driver.promptAndWait('Pedido fictício e inofensivo.');
} finally {
  // Após settlement: finish(); para interromper trabalho/falhas: cancel:true.
  // Somente released:true autoriza outra aquisição; não aprova a task.
  await lease.finish({ cancel: true });
}
```

Não chamar `startPi` diretamente nesse fluxo: a aquisição deve preceder **qualquer**
criação de Pi. O Driver e os smokes antigos continuam como primitivas sem trava
implícita; seu uso isolado exige exclusividade manual. O Runner futuro deverá
consumir esta interface. Nenhum teste T03 usa provedor ou Pi real.

## Interface e persistência

- `acquirePiLock({runId, root?})`: uma aquisição exclusiva ou erro, sem espera/retry
  nem recuperação automática. `LOCK_BUSY` significa handle ocupado;
  `LOCK_RECONCILIATION_REQUIRED` significa lease anterior persistida.
- `lease.token` e `lease.metadata`: identidade e cópia dos metadados. Incluem UUID,
  `runId`, proprietário (PID + criação FILETIME + imagem), identidade de máquina/boot,
  fase e, após bootstrap, identidade do host Pi. Não contêm prompts/credenciais.
- `lease.launch(options)`: uma única chamada, delega ao `startPi` da T02 e aguarda
  `ready`. Persiste `launching` **antes** de chamar o Driver; depois grava `running`
  e a identidade do host. Falha de spawn/ready/persistência deixa bloqueio conservador,
  mesmo quando o controlador acredita não ter iniciado nada.
- `lease.finish({cancel=false}?)`: aguarda lançamento pendente e chama `shutdown`
  do **Driver vinculado**, não aceita prova/booleano do chamador. Exige `terminated`,
  `canRelease`, `processesGone` e identidade igual à registrada. Essa prova inclui
  a árvore/kernel Job da T02, não somente exit code, PID ou aceitação de abort.
  Sem tentativa de lançamento, pode liberar com evidência `neverLaunched`.
  Persiste recibo de término antes de arquivar a lease. Chamadas repetidas retornam
  a mesma Promise, sem novos sinais/matança. Planejar a chamada como operação final:
  erros (inclusive `WORK_ACTIVE` se faltar `cancel:true`) fecham o guard, preservam
  a lease e exigem diagnóstico, não uma nova sessão.
- `lease.abandon()`: fecha somente o handle e mantém o bloqueio persistido; **não**
  encerra Driver/Pi nem autoriza nova execução. Usado para preservar incerteza.
  Depois disso, a lease não pode lançar/liberar.
- `inspectPiLock({root?}?)`: verificação sem recuperação; retorna `status`,
  `canAcquire`, `canReconcile`, motivo e, quando seguro ler, metadados/probe do dono.
  Busy, erro de observação ou metadados inválidos sempre bloqueiam.
- `anchorPiLock({root?, expectedToken, expectedLeaseSha256})`: cria uma âncora
  imutável para lease **schema 1**, sob o mesmo guard. Exige proprietário ausente,
  mesma máquina e fonte atual qualificada. Hash esperado vem da inspeção. Preserva
  os bytes da lease e retorna `canReconcile:false`; não libera/reinicia nada.
- `reconcilePiLock({root?, expectedToken, expectedLeaseSha256?})`: recuperação explícita
  da lease inspecionada, serializada pela mesma trava. O hash opcional fixa a inspeção
  do chamador; use-o em operações manuais. Token divergente impede retirar uma lease
  posterior (ABA). Revalida lease/âncora, proprietário e prova antes de arquivar;
  não inicia Pi nem tasks. Preserva a lease original em `retired-<token>.json` e
  grava a prova em arquivo separado `reconciliation-<token>-<uuid>.json`.

O segundo argumento de `acquirePiLock`/`inspectPiLock`/`anchorPiLock`/`reconcilePiLock` (`openGuard`)
e o segundo argumento de `launch` (factory de Driver) são costuras **confiáveis de
teste**, não entradas de modelo, CLI ou opções de produção. Não substituir prova
nativa por mocks em execução real.

### Mecanismo mínimo

Um helper PowerShell temporário por aquisição mantém um `FileStream` Windows com
`FileShare.None` sobre o arquivo estável `guard`. A abertura é exclusiva no kernel,
inclusive na primeira disputa entre processos Node. **Nunca apagar/renomear esse
arquivo**: sua existência sozinha não prova nada, é o handle que serializa operações.
O helper usa somente stdin/stdout privados, sem shell variável, serviço residente,
porta, dependências instaladas ou mudança de política. IPC UTF-8 suporta espaços/Unicode.

Todas as operações de lease/reconciliação ocorrem sob o mesmo guard. A persistência
`lease.json` é criada com `wx` + flush; atualizações usam temporário com flush e rename
no mesmo diretório/volume. Uma gravação parcial ou erro de leitura não vira lease livre.
A fase `launching` bloqueia recuperação baseada apenas na morte do proprietário:
um filho pode ter sido criado antes da falha. A morte do helper libera o handle,
mas **não** remove `lease.json`; proprietário ainda vivo impede reconciliação.

Após liberação/reconciliação comprovada, rename para `retired-<token>.json` preserva
metadados/recibo. Reconciliação não reescreve a lease; a prova separada referencia
SHA-256 dos bytes da lease e, quando presente, da âncora. Destino já existente
bloqueia arquivamento, sem sobrescrever evidência anterior. Temporários e arquivos
retirados são evidência operacional; não há limpeza automática nem devem entrar no Git. Não alterar arquivos enquanto
uma execução puder usá-los. Falha de energia, manipulação hostil, corrupção de disco,
restauração de VM e compartilhamento remoto não têm garantia de isolamento; usar
filesystem Windows **local**, diretório confiável e permissões restritas à conta.

## Reconciliação explícita

1. Parar despachos do workflow. Consultar `inspectPiLock` na **mesma raiz**; preservar
   lease, temporários, workspace e diagnósticos. Não usar `taskkill` com PID de arquivo.
2. `LOCK_BUSY`: há guard nativo ocupado. Aguardar a execução responsável; se sua
   identidade/árvore estiver incerta, diagnosticar, sem apagar o guard ou a lease.
3. Lease legível: conferir `runId`, token, fases e identidade do proprietário.
   O probe abre handle nativo e compara criação/imagem; PID reutilizado significa
   proprietário original ausente, **não** prova ausência de seus filhos. Falha de
   acesso é `unknown`, nunca processo presumidamente morto.
4. `canReconcile=true` só ocorre com proprietário comprovadamente ausente (`gone`
   ou `reused`, nunca `alive`/`unknown`) e uma destas provas:
   - `acquired`, sem intenção de lançamento: nenhum Pi pôde ser criado pela interface;
   - recibo `terminated` durável e vinculado à identidade (ou `neverLaunched`), cobrindo
     falha entre persistência de término e arquivamento;
   - **kernel posterior comprovado**: identidade qualificada em schema 2 ou âncora
     íntegra do legado. Máquina, fonte, build e arquitetura devem coincidir; BootId
     atual deve ser estritamente maior. Mesmo valor, rollback/wrap e diferença de
     formato não provam término. Retornos: `NATIVE_PRIOR_KERNEL_ENDED` ou
     `ANCHORED_PRIOR_KERNEL_ENDED`, nunca o motivo legado `PRIOR_BOOT_ENDED`.

   O GUID `SystemBootEnvironmentInformation.BootIdentifier` **não** identifica
   exclusivamente cada boot e sua diferença não libera. Relógio, PID isolado ou
   autorização textual não são prova. Suspensão/hibernação não equivalem a reboot.
5. Após conferir a prova, chamar explicitamente:

   ```js
   const state = await inspectPiLock({ root });
   if (state.canReconcile) {
     await reconcilePiLock({ root, expectedToken: state.record.token,
       expectedLeaseSha256: state.leaseSha256 });
   }
   // Uma aquisição posterior é outra ação; reconciliação não reinicia tasks.
   ```

**Limite deliberado:** após crash durante `launching`/`running`/`uncertain`, sem
recibo de árvore vazia, não há prova completa da árvore no mesmo boot. Nem owner
morto, nem lista de PIDs observados ausente autoriza limpar. O módulo mantém o
bloqueio; preservar diagnóstico. Na implementação legada, repetir uma reinicialização
real do Windows pode manter o mesmo GUID e não viabiliza a recuperação. A M02-T08
exige ancoragem explícita íntegra antes do reboot destinado a recuperar o legado.
A recuperação é explícita, não reboot/restart automático. Metadados corrompidos ou máquina
incompatível continuam bloqueados: exigem investigação humana, não `rm lease.json`
nem uma nova raiz para ignorar a incerteza.

### Formatos e ancoragem do legado

Schema 1 mantém o GUID histórico, sem reinterpretá-lo como BootId. Schema 2 grava
`boot: {source, machine, id, architecture, build}`. Fonte/build/arquitetura não
qualificados impedem novas aquisições e não autorizam prova de kernel encerrado.
Nenhuma migração ocorre ao inspecionar/adquirir; a âncora é operação separada:

```js
const state = await inspectPiLock({ root });
if (state.canAnchor) {
  await anchorPiLock({ root, expectedToken: state.record.token,
    expectedLeaseSha256: state.leaseSha256 });
}
// Mesmo kernel continua bloqueado. Não chamar reconciliação para forçar liberação.
```

`anchor-<token>.json` vincula token, hash dos bytes originais, máquina/kernel atual,
identidade do observador e data informativa. Seu checksum detecta corrupção do
payload, não é assinatura contra atacante com acesso ao diretório. Uma âncora
existente, mesmo corrupta, não é substituída. Reboot **anterior** à âncora não
satisfaz a prova posterior. Falhas deixam lease/âncora/provas parciais preservadas.

Operações usam o guard existente e releem hashes antes do efeito final; mudanças
concorrentes, token/hash divergentes, erro de leitura ou observação bloqueiam.
Como antes, isso pressupõe filesystem local e diretório confiável: não é proteção
contra administrador malicioso, edição hostil dos metadados, clonagem/restauração
de VM ou rollback de disco. Não usar PID/relógio para contornar uma recusa.

## Validação

`npm.cmd --prefix src test` inclui política determinística (inclusive recusa de
GUID/fonte não qualificada divergente, PID reutilizado, observação indisponível e
recibo interrompido) e integração no Windows:
três processos Node independentes partem de uma barreira, apenas um adquire e lança
Pi **falso**; os demais não lançam. Término verificado admite uma nova invocação.
Outros testes matam o Node proprietário antes/depois do lançamento, verificam bloqueio,
reconciliação concorrente e identidade nativa. Testes determinísticos adicionais
cobrem schema 2, ancoragem do legado, hashes, token, corrupção, concorrência e
recusas. Não reinicializam o Windows; mocks não qualificam uma fonte nativa.

Roteiro fim a fim: [`test/lock-recovery-procedure.txt`](test/lock-recovery-procedure.txt).
Usa duas leases sintéticas (nova/legada), sem Pi, ancoragem explícita antes do
reboot manual e reconciliação explícita depois. Não recupera a lease operacional.
O ensaio foi executado em 2026-11-23: ambas as leases sintéticas permaneceram
bloqueadas antes do reboot e foram reconciliadas explicitamente depois, com
originais/âncora preservados. Evidências sanitizadas e limites constam no relatório
`docs_devout/03-execucao/achados/task-M02-T08-relatorio.md`. Isso é evidência da
implementação, não aprovação independente nem autorização de recuperação real.

### Coleta de qualificação — M02-T08

`windows-kernel-candidate.mjs`/`.ps1` coletam **somente observações** do candidato
`KUSER_SHARED_DATA.BootId`. O probe é limitado a Windows 10/11 AMD64, lê a página
compartilhada nativa e confere seu build contra `RtlGetVersion`; outros contextos
falham sem adivinhar layout. Fonte e máquina são explícitas. O coletor não é chamado
pelo guard ou pelo protocolo de recuperação; suas saídas mantêm `qualified:false`. A política
nativa usa os mesmos campos/offsets, com restrição explícita ao build observado.

Roteiro opt-in: [`test/kernel-qualification-procedure.txt`](test/kernel-qualification-procedure.txt).
`node src/test/qualify-kernel.mjs prepare` cria fixture sintética única fora do Git,
sem Pi/Driver, e confere estabilidade em duas leituras. A lease incerta é schema 1,
com máquina do guard e UUID legado **artificial**, sem fonte nativa; não representa
identidade histórica observada. O candidato real fica nas observações, não na
lease legada. Sem âncora, a fixture permanece bloqueada inclusive após reboot;
não usá-la no ensaio de recuperação. O validador de produção continua recusando
schema 1 com fonte nativa. Ações posteriores recebem **somente essa fixture**,
preservam sua lease e verificam o hash da lease operacional
por leitura, sem a adquirir/alterar. O manifesto vincula hashes das fontes usadas;
mudanças de código invalidam a continuidade da coleta. Observações imutáveis ficam
na fixture; nenhuma fase inicia processos Pi, ancora/reconcilia leases ou automatiza
ações de energia.

Comparações determinísticas recusam mudança de contexto, GUID como identidade,
prova ausente e transições de energia não comprovadas. CIM/eventos corroboram o
ensaio, mas não são prova de término para a política de produção. Suspensão S3,
hibernação e reboot são ações manuais distintas; casos não executados permanecem
não validados. Observações positivas não alteram a política automaticamente.
A coleta observada e sua conferência estão no relatório M02-T08: estabilidade no
mesmo kernel/S3/hibernação e diferença após reboot real no build 19045 AMD64.
A aceitação dessa fonte é limitada a esse contexto; não se generaliza a Windows 11,
ARM64 ou outros builds. O ensaio fim a fim é separado desta coleta e sua execução
histórica está documentada na seção Validação e no relatório; não repetir em
fixtures concluídas.

A coleta histórica antecedeu a integração final do detector. A correção após R1
ajusta somente a fixture do coletor ao formato legado válido e altera o hash de
`qualify-kernel.mjs`; não muda o detector nem reinterpreta os resultados antigos.
Manifestos/observações históricos permanecem imutáveis, com seus hashes originais;
não reaplicá-los ao checkout corrigido. Para novas observações, criar fixture NOVA
com manifesto próprio. Validar este ajuste com `prepare` e `same-kernel` em
invocações Node distintas não exige novo reboot/S3/hibernação. Ações de energia
novas continuam manuais e dependem de preparação/autorização próprias.
A lease operacional segue bloqueada; R2 da M02-T03 não retomada.

## Contrato da recuperação corretiva — M02-T08

**Aprovado em 2026-11-23.** Este contrato mantém a exclusividade da ADR-0002 e
delimita a manutenção no plano M02 ativo. Define requisitos, não certifica a
implementação nem substitui evidências/testes ou revisão independente.

- **Leases novas:** registrar identidade nativa de sessão de kernel qualificada no
  Windows real, vinculada à máquina e identificada quanto ao formato/fonte. Deve
  permanecer estável no mesmo kernel e distinguir reboot real sem confundir
  suspensão/hibernação com término dos processos. `KUSER_SHARED_DATA.BootId` é
  candidato a validar, não escolha presumida; GUID de entrada do Windows não basta.
  Ausência de fonte/prova confiável mantém o bloqueio.
- **Legado:** preservar os dados originais da lease. Uma operação explícita cria
  âncora vinculada ao token, hash da lease, máquina e identidade qualificada do
  kernel atual. Não substituir a identidade histórica pelo valor atual, reconstruir
  dados que não foram coletados ou comparar formatos diferentes como se provassem
  um novo boot. A âncora estabelece um ponto novo para observação, não uma prova
  retroativa.
- **Prova posterior:** a criação da âncora não libera a trava. Somente um reboot
  posterior comprovado pelo detector qualificado permite reconciliar explicitamente
  o legado, com nova conferência da âncora e lease. Reboot anterior à âncora não
  satisfaz essa condição. Se a prova for insuficiente, continuar bloqueado.
- **Serialização e integridade:** usar o guard existente na criação da âncora e na
  reconciliação; conferir token e integridade da lease/âncora, preservar evidências e
  verificar ausência comprovada do proprietário. Token divergente, mudança concorrente,
  identidade ambígua ou falha de leitura/persistência não podem liberar a trava.
- **Sem atalhos:** não apagar a lease, trocar a raiz para ignorar um bloqueio ou
  introduzir liberação forçada genérica. PID, relógio ou autorização textual isolados
  não provam encerramento do kernel/árvore. Ancoragem e reconciliação são operações
  explícitas e separadas de aquisição ou reinício de task.
- **Validação e operação:** testes determinísticos e roteiro opt-in com lease
  sintética antes/depois de reboot real, sem Pi ativo. O operador realiza os reboots;
  não automatizá-los nem recuperar a lease operacional durante os testes. Documentar
  identidade, legado, token divergente, concorrência, prova ausente e recusas. Casos
  não executados não são evidências positivas.
- **Fronteira de autorização:** entregar/revisar a M02-T08 não autoriza recuperar a
  lease operacional. Essa ação posterior exige autorização separada e poderá exigir
  outro reboot depois da ancoragem. Preservar a M02-T03, sua I1, R2 incompleta e
  contagem de uma correção; a manutenção não conclui nem reinicia essa task.

## Diagnóstico do detector legado

Em 2026-11-23, a inspeção posterior à reinicialização manteve `PROCESS_TREE_UNCERTAIN`:
lease antiga e helper nativo retornaram o mesmo `BootIdentifier`, enquanto CIM e
os eventos Kernel-General ID 12 registraram novas inicializações. O campo identifica
qual entrada/instalação Windows foi inicializada; não fornece a mudança por reboot
assumida pelo detector legado. O mock de IDs distintos cobre a política JavaScript,
não a fonte nativa.

Evidências e limites estão no apêndice de diagnóstico de
`docs_devout/03-execucao/achados/task-M02-T03-revisao-2.md` (R2 incompleta). A causa
original da falha que gerou a lease continua não determinada; corrigir a prova de
boot não equivale a resolver essa falha de lançamento.

Referências consultadas para o diagnóstico:

- https://www.geoffchappell.com/studies/windows/km/ntoskrnl/inc/api/ntexapi/system_boot_environment_information.htm
- https://raw.githubusercontent.com/winsiderss/phnt/master/ntexapi.h
- https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddk/ns-ntddk-kuser_shared_data

A documentação de `KUSER_SHARED_DATA.BootId` o descreve como sequência incrementada
pelo loader a cada tentativa de boot; isso não substitui a qualificação exigida para
recuperação segura. Nenhuma dessas consultas alterou a lease ou implementou a M02-T08.
