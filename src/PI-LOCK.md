# Exclusividade de Pi — M01-T03

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
- `reconcilePiLock({root?, expectedToken})`: recuperação explícita da lease inspecionada,
  serializada pela mesma trava, com nova verificação da identidade/prova. Não inicia
  Pi nem tasks. Token divergente impede remover uma lease posterior (proteção ABA).

O segundo argumento de `acquirePiLock`/`inspectPiLock`/`reconcilePiLock` (`openGuard`)
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
metadados/recibo/prova. Temporários e arquivos retirados são evidência operacional;
não há limpeza automática nem devem entrar no Git. Não alterar arquivos enquanto
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
4. `canReconcile=true` só ocorre com proprietário comprovadamente ausente e uma
   destas provas:
   - `acquired`, sem intenção de lançamento: nenhum Pi pôde ser criado pela interface;
   - recibo `terminated` durável e vinculado à identidade (ou `neverLaunched`), cobrindo
     falha entre persistência de término e arquivamento;
   - **novo boot de kernel na mesma máquina Windows**: todos os processos daquele
     boot anterior terminaram. Usa GUID de `SystemBootEnvironmentInformation` e
     MachineGuid, não relógio, PID isolado ou arquivo de lock. Registro de outra
     máquina não é prova. Retorno de suspensão/hibernação não equivale a novo boot.
5. Após conferir a prova, chamar explicitamente:

   ```js
   const state = await inspectPiLock({ root });
   if (state.canReconcile) {
     await reconcilePiLock({ root, expectedToken: state.record.token });
   }
   // Uma aquisição posterior é outra ação; reconciliação não reinicia tasks.
   ```

**Limite deliberado:** após crash durante `launching`/`running`/`uncertain`, sem
recibo de árvore vazia, não há prova completa da árvore no mesmo boot. Nem owner
morto, nem lista de PIDs observados ausente autoriza limpar. O módulo mantém o
bloqueio; preservar diagnóstico e combinar com o operador uma reinicialização
real do Windows, depois verificar e reconciliar explicitamente. Isso é recuperação
conservadora, não reboot/restart automático. Metadados corrompidos ou máquina
incompatível continuam bloqueados: exigem investigação humana, não `rm lease.json`
nem uma nova raiz para ignorar a incerteza.

## Validação

`npm.cmd --prefix src test` inclui política determinística (inclusive boot simulado,
PID reutilizado, observação indisponível e recibo interrompido) e integração no Windows:
três processos Node independentes partem de uma barreira, apenas um adquire e lança
Pi **falso**; os demais não lançam. Término verificado admite uma nova invocação.
Outros testes matam o Node proprietário antes/depois do lançamento, verificam bloqueio,
reconciliação concorrente e identidade nativa. Não reinicializam o Windows: a prova
de novo boot é exercitada por costura determinística, não por reboot real do host.
