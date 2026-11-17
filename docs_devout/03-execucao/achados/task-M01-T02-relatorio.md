# M01-T02 — Relatório da implementação inicial

**Data:** 2026-11-17. **Papel:** implementador. **Não é aprovação de revisão.**

## Pré-condições e escopo

- Task consumida de `docs_devout/plano.md`: término, cancelamento, timeout, identidade e diagnóstico de incerteza do Pi Driver.
- Baseline documental confirmado em `c771c4b39a34716f15728c1e0d5b2596e776bc41`; plano, registro e `AGENTS.md` rastreados e sem alterações pendentes ao iniciar.
- M01-T01 concluída: commit funcional `011a984cc0b0780368386f300708506b5e545498` e metadados `eacc45687461b4d13eaac3b73ecce4b729624bc4`, ambos ancestrais do HEAD inicial.
- Checkout inicialmente limpo em `main`. Usuário autorizou criar/usar `feat/M01-T02`, sem commits. HEAD funcional de referência permanece `eacc45687461b4d13eaac3b73ecce4b729624bc4`.
- Registro atualizado exclusivamente por `update_registro.py`: `não iniciada` → `em andamento`; ao entregar este relatório, deve passar para `aguardando revisão`.
- Fontes pertinentes: contrato MVP v1.0, §§5.1–5.3 e T07; limites do plano/AGENTS; ADR-0001; interface/transporte e smoke existentes.
- Ambiente observado: Windows nativo (`win32`), Node v24.20.0, npm 11.19.0, Pi 1.5.2, OpenClaw 2026.11.3. Descoberta do launcher por `Get-Command pi.cmd`. Sem instalação, troca de políticas ou alteração de credenciais.

## Arquivos e entregas

| Arquivo | Alteração |
| --- | --- |
| `src/pi-driver.mjs` | `shutdown()`/`cancel()`, ciclo de vida explícito, bloqueio de novos comandos, prazos, supervisão automática de falhas/EOF, prova de término e resultado idempotente. |
| `src/pi-host.mjs` | Host Node temporário com gate anterior ao lançamento de Pi; pipes RPC herdados pelo launcher. Não é Role Runner nem serviço residente. |
| `src/windows-process-tree.mjs` | Helper privado por execução, bootstrap/identidade, consultas limitadas, propagação de falha do observador e liberação de seus recursos. |
| `src/windows-process-tree.ps1` | APIs nativas via C#: handles, criação/imagem/pai, Job Object sem breakaway, console inicial verificado, inspeção/pinning da árvore antes de taskkill e consulta posterior. |
| `src/test/fixtures/lifecycle-rpc.mjs` | Atividade RPC fictícia e árvore multigeração descartável resistente ao EOF; modos de falha e abort. |
| `src/test/pi-lifecycle.test.mjs` | Cinco testes de incerteza/identidade com observador falso, testes nativos Windows e validação de prazos; inspeção CIM independente. |
| `src/test/pi-driver.test.mjs` | Teardown do launcher Windows passa a exigir prova de término do Driver, em vez de matar só o root em caso de erro. |
| `src/test/smoke-pi.mjs` | Preserva as verificações funcionais da T01; substitui fallback específico do smoke pela supervisão reutilizável da T02. |
| `src/test/smoke-cancel.mjs` | Smoke opt-in com Pi real: atividade aberta → abort → término verificado → CIM independente. |
| `src/package.json` | Suíte sequencial dos dois arquivos de teste e comando opt-in `test:cancel`. |
| `src/README.md` | Interface, resultado, limites, estados, identidade, prazos e roteiros de reprodução atualizados. Preservada a evidência histórica da T01. |
| `docs_devout/03-execucao/registro.md` | Somente transições oficiais da M01-T02 pelo script. |
| Este relatório | Evidências e limites da implementação inicial. |

### Comportamento entregue

- Estados: `starting`, `running`, `stopping`, `terminated`, `uncertain`.
- Término normal recusa atividade/comando pendente (`WORK_ACTIVE`). Cancelamento rejeita observação ativa (`CANCELLED`), tenta abort por prazo limitado e solicita EOF; não converte cancelamento em sucesso funcional.
- Prazos iniciais documentados/configuráveis: abort 5 s, EOF normal 10 s, taskkill 5 s, verificação após força 5 s, intervalo de consulta 100 ms. Orçamentos por fase; consultas ao helper têm limite próprio de 15 s. Esperas do bootstrap são limitadas. Espera de término usa relógio monotônico.
- Antes de lançar `.cmd`/Pi, o host é identificado e atribuído ao Job Object. O console Windows inicialmente criado fora do Job só é incluído após verificar pai, criação, imagem `conhost.exe` do sistema e handle vivo. Demais descendentes são acompanhados pelo kernel, inclusive entre snapshots.
- Fallback executa a linha fechada `taskkill /PID <host> /T /F` somente com handle original vivo/criação conferida e árvore inspecionada pertencente ao Job; mantém handles dos alvos inspecionados durante a operação. Links de pai para processos alheios recusam matança.
- Root já ausente com descendentes vivos, identidade ambígua/alterada, falha de observação ou sobreviventes retornam `uncertain, canRelease=false`. Não se tenta matar PID antigo nem repetir fallback em chamadas posteriores.
- `terminated/canRelease=true` exige root encerrado, Job vazio e `close` dos pipes. Não depende isoladamente de abort, SIGTERM, taskkill ou exit 0. Falha/cancelamento com processos encerrados podem liberar recursos, mas não aprovar trabalho.
- Chamadas repetidas, concorrentes e reentrantes de término compartilham Promise/resultado. O primeiro pedido prevalece; não há novo processo, sinal ou matança por repetição.

## Testes executados e resultados finais

Comandos executados na raiz, sequencialmente, sem dois Pi do workflow em paralelo:

```powershell
node --version
npm.cmd --version
openclaw.cmd --version
pi.cmd --version
Get-Command pi.cmd | Select-Object Source
npm.cmd --prefix src test
npm.cmd --prefix src run test:smoke
npm.cmd --prefix src run test:cancel
git diff --check
```

- **Suíte final: 48/48 passaram, 0 falhas, 0 skips** (~32 s): os 33 casos de transporte existentes e 15 casos adicionais de ciclo de vida. Sem provedor na suíte.
- Inclui término normal, recusa de término com atividade aberta, abort aceito/rejeitado/sem resposta, timeout de comando, EOF inesperado, JSON inválido com processo resistente, saída anormal, árvore resistente multigeração, processo alheio, idempotência/reentrância, identidade ausente/alterada, root ausente com filho sobrevivente e falso sucesso do taskkill.
- **Smoke normal real:** `2026-11-17T18:08:02.423Z`, `pass=true`, aceitação/settlement/marker válidos, stdin aberto no settlement, `exitCode=0`, `forced=false`, `processesGone=true`, `terminationState=terminated`, sem stderr ou DEP0190.
- **Smoke abort real:** `2026-11-17T18:08:09.983Z`, `pass=true`, `promptAccepted=true`, `activeAtCancel=true`, `abortAccepted=true`, `settledObserved=true`, `state=terminated`, `forced=false`, `canRelease=true`, `exitCode=0`, `failureCode=null`, inspeção CIM independente com zero PIDs observados presentes.
- `git diff --check`: sem erros. Não há lint configurado no projeto.

### Identidades sanitizadas das provas finais

Criação em FILETIME decimal Windows; não são PIDs autorizados para operações futuras.

**Árvore resistente / fallback nativo:** root `5808 / 134394124629507347`; demais observações `11532 / 134394124629770505`, `11076 / 134394124643172795`, `12664 / 134394124643491416`, `9376 / 134394124644359626`, `1032 / 134394124645637584`.

Resultado: `forced=true`, `taskkillExitCode=0`, Job vazio, CIM independente `remainingPids=0`, `canRelease=true`, `workCompleted=false`, `failureCode=PROCESS_EXIT` (saída forçada não é sucesso funcional). O teste também confirmou que o processo Node alheio de controle continuava vivo após chamadas repetidas de `shutdown`/`cancel`.

**Abort com Pi real:** root `10092 / 134394124899936385`; demais observações `12456 / 134394124900003413`, `13540 / 134394124913591929`, `6112 / 134394124913943542`, `1032 / 134394124914729000`.

O PID `1032` reaparece em execuções distintas com criações diferentes; as evidências registram identidade, não equivalência por PID. Nenhum desses PIDs foi reaproveitado para matança posterior.

Após os testes, inventário CIM separado de `node.exe` dos hosts/fixtures/sentinela descartáveis: `disposableOwnedRemaining=0`, lista vazia. Workspaces bem-sucedidos removidos somente após prova de término. Nenhum histórico Pi/OpenClaw, stderr bruto, token ou resposta do modelo foi versionado.

### Iterações de diagnóstico (não contam como aprovação)

- A primeira tentativa de identidade encontrou acesso insuficiente a `GetProcessTimes`; corrigida a máscara de direitos do handle. A suíte de transporte voltou a passar 33/33.
- O primeiro fallback recusou com segurança um `conhost.exe` fora do Job (`PROCESS_FOREIGN_DESCENDANT`), sem executar taskkill contra árvore não comprovada. Acrescentado o tratamento verificado do console durante o bootstrap, antes de liberar Pi.
- Algumas execuções diagnósticas com fixtures resistentes atingiram o prazo do harness; não são prova de término do Driver. A ausência de remanescentes foi revalidada por CIM antes da entrega, além das provas positivas posteriores de Job/CIM.
- Um teste EOF competia com prazo artificial de comando de 150 ms durante startup da fixture; passou a usar 5 s para EOF/JSON inválido e 500 ms para o cenário especificamente silencioso. `ready` indica lançamento, não prontidão RPC. A suíte final exige o código correto de cada falha e não mascara timeout como EOF.

## Critério de conclusão e limites

- [x] Interface de encerramento/cancelamento reutilizável e diagnóstico de término/incerteza.
- [x] Teste Windows real com Pi demonstra abort enquanto ativo e encerramento verificado.
- [x] Processo Node descartável resistente aciona fallback seguro; árvore relevante confirmada vazia pelo Job e por inspeção CIM independente.
- [x] Identidade/processo ambíguos bloqueiam liberação em testes negativos; repetição não aciona novos kills e processo alheio permanece vivo no teste nativo.
- [x] Término normal, cancelamento, timeout, EOF/falha e fallback cobertos; T07 apenas na camada Driver.
- [x] Sem reinício de task, Git automático, avanço por exitCode, Runner assíncrono, lock global, HTTP, Docker/WSL ou alteração de protótipos/skills/documentos de requisitos.

Limites: depende de PowerShell/Add-Type e permissão de Job Object no Windows; acesso negado ou observador perdido resulta em incerteza. Não promete isolamento forte contra agentes privilegiados/brokers externos/manipulação hostil da conta. Na incerteza o consumidor deve preservar diagnóstico e bloquear nova execução; recuperação/trava entre invocações permanece na T03. Resultados não constituem validação de Role Runner ou do cancelamento assíncrono da T05.

**Pendências de workflow:** revisão independente em conversa nova e autorização explícita dos dois commits, se aprovada. A configuração `docs_devout/03-execucao/fontes-revisao.json` ainda seleciona somente M01-T01: antes de revisar M01-T02 é necessário recorte/seleção autorizada compatível com o preparador, sem fallback integral nem leitura antecipada deste relatório pelo revisor. Não foi ampliada essa configuração por iniciativa do implementador. Nenhum commit realizado; não avançar para M01-T03.

## Atualização preparatória autorizada — seleção da revisão

Após a entrega inicial, o usuário autorizou preparar a seleção de fontes de M01-T02. A pendência de seleção indicada acima está resolvida no worktree, sem iniciar revisão nem autorizar commits.

- `docs_devout/03-execucao/fontes-revisao.json`: acrescentada M01-T02, com task completa, restrições comuns e partição explícita de 15 fontes. O objeto de configuração M01-T01 foi preservado integralmente.
- `docs_devout/plano.md`: somente os quatro rótulos da M01-T02 passaram de negrito para subtítulos Markdown, exigidos pelo preparador. Comparação automatizada com HEAD confirmou ausência de qualquer outra alteração no plano ou nos requisitos.
- `AGENTS.md`: mapa/comando de entrada atualizado para as duas seleções. Sem conclusões técnicas novas nesse mapa.
- Entrada inicial: contrato e decisões vigentes; relatos/Observações continuam excluídos. Tasks alheias, evidências históricas, referência de integração, guia de diagnóstico e `src/README.md` ficam adiados. O README da implementação está integralmente adiado para evitar antecipar seu desenho/relato, mas deve ser examinado por completo no confronto posterior.
- Preparador executado com `--sources` e revalidado com `--check-input` para **M01-T01 e M01-T02**. Validadas partições completas, quatro campos obrigatórios, classificação dos diffs adiados e ausência de resultados/Observações da implementação no conteúdo inicial emitido. Entradas persistidas em diretório temporário fora do repositório; o revisor deve gerar sua própria entrada atualizada.
- Casos negativos: `--check-input` com identidade deliberadamente desatualizada recusado; M01-T03 sem seleção recusada, ambos sem JSON de fallback. `git diff --check` passou.
- Nenhum código de produção, teste, skill ou experimento alterado nesta preparação; não foi necessário repetir Pi/smokes. Registro permanece `aguardando revisão`, com o mesmo instante da última transição de status, e recebe somente nota documental pelo script.

Esta preparação e sua validação não são avaliação independente, não consomem rodada e não aprovam a task. Próximo passo: revisor em conversa nova, começando pelo preparador antes de abrir este relatório, Observações ou diffs adiados. Nenhum commit realizado.
