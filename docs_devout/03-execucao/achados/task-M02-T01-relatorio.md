# M02-T01 — Relatório da implementação inicial

**Natureza:** declaração do implementador; não é avaliação independente nem aprovação.
**Data:** 2026-11-19. **Papel:** implementador. **Revisão independente:** pendente em conversa nova.
**Branch:** `feat/m02-t01`. **HEAD de entrada:** `b96fba3397be05ddbef878719556366ba691ccd4`.

## Entrada, gates e escopo

- Task consumida: `docs_devout/plano.md`, M02-T01, quatro campos completos; sem dependências obrigatórias.
- Baseline M02 confirmado no histórico: `9014b8b116bb6f2bfd3499d50aeef481bc44e7ec`.
  Plano, mapa, registro e seleção M02-T01 rastreados e commitados, sem mudanças pendentes ao retomar.
- Reconciliações documentais anteriores preservadas: `9e4e21345af419eaf4e9b165ea7395e53dc43267`
  e `b96fba3397be05ddbef878719556366ba691ccd4`. O usuário confirmou resolução e autorizou continuar.
  Working tree inicialmente limpo; estado `pausada` retomado por `update_registro.py` com motivo.
- Consultados task/restrições, mapa, guia Windows, contrato v1.0 pertinente, HLD, três ADRs ativos,
  Driver/Runner, guias e testes diretamente relacionados. Esta task de implementação não exige
  avaliação independente pelo implementador; a revisão manual futura usará o preparador antes dos relatos.
- Sem alterações em skills, protótipos, requisitos, plano, seleção de fontes ou arquitetura aprovada.
  Não foram criados os validadores/papéis das M02-T02–T07.

## Arquivos alterados/criados

| Arquivo | Entrega |
| --- | --- |
| `src/engineering-workspace.mjs` | Admissão fechada de Git fictício e ambiente/instruções de engenharia. |
| `src/pi-driver.mjs` | Perfil literal `engineering`, política obrigatória e validação pré-spawn. |
| `src/role-runner.mjs` | `configured-engineering` no papel de teste, revalidação, contexto de política e observações sanitizadas. |
| `src/test/engineering-profile.test.mjs` | 28 testes de admissão/rejeição, ambiente, ciclo e recibos de ferramenta. |
| `src/test/helpers/engineering-fixture.mjs` | Preparação local de fixture com dados/identidade fictícios e baseline antes do Pi. |
| `src/test/smoke-engineering.mjs` | CLI/Pi real, edição/teste, Git/diff, CIM, release e readquisição. |
| `src/package.json` | Comando opt-in `test:engineering`. |
| `src/ENGINEERING.md` | Contrato do perfil, superfície de ferramentas, política, execução e limites. |
| `src/README.md`, `src/ROLE-RUNNER.md` | Referências ao novo perfil sem retirar o M01. |
| Este relatório e `docs_devout/03-execucao/registro.md` | Evidências e handoff manual pela skill; não são alterações do registro pela fixture/orquestrador em teste. |

## Implementação

O novo perfil mantém `--no-session` e habilita explicitamente apenas `read,edit,write,bash`.
Extensões, MCPs, skills, templates, contexto de arquivos e aprovação local automática continuam desabilitados.
O launcher recebe somente perfil/linha literais; prompt via stdin RPC. Não aceita comando, shell ou argv livres.

O esquema admite apenas `configured-isolated` (M01, sem Git/ferramentas) ou `configured-engineering`
com `engineering: { baseline, branch, testPolicy: "node-test-only-v1" }`. Continua somente `role:test`.
O perfil de engenharia exige marcador versionado, Git local limpo e branch/HEAD declarados; bloqueia remotes,
configuração local fora da allowlist, credenciais conhecidas, hooks/alternates/metadata compartilhada,
links/hardlinks, históricos, arquivos ignorados/não rastreados e flags de index que escondem alterações.
Exige teste local `test/fixture.test.mjs`, política conhecida e fixture atestada como inofensiva.
As consultas Git são internas, sem shell, com limites; o ambiente normal de engenharia não herda configs
Git global/system, helpers, overrides Git/SSH ou tokens Git conhecidos. Mantém o provedor Pi configurado.

Controles de caminho, artifactsRoot fora do Git/workspace, lease global, identidade, Job Object,
encerramento e cancelamento do M01 permanecem em uso. Admissão é revalidada após adquirir a lease
antes de launch; o próprio Driver também valida antes do spawn. Uma mutação após aquisição é testada,
impedindo launch e liberando a lease ainda sem processo.

O prefixo controlado instrui não usar rede, arquivos/credenciais externos, instalações ou escritas Git.
O resultado adiciona apenas contagens e booleanos de ferramenta no perfil novo; correlação do comando
exato `node --test` ocorre em memória. Não persiste argumentos, resultados de ferramentas ou respostas.
`taskApproved` permanece falso; não há automatização de registro oficial ou commit da alteração do Pi.

## Comandos e resultados

Ambiente consultado: Windows nativo, Node `v24.20.0`, npm `11.19.0`, Pi `1.5.2`, OpenClaw
`2026.11.3 (847611d)`; launcher descoberto em `C:\Users\User\.pi\agent\bin\pi.cmd`.
Sem instalação de dependências, Gateway, mudanças globais ou execução paralela de Pi.

| Comando | Resultado nesta execução |
| --- | --- |
| `node --test --test-concurrency=1 src/test/engineering-profile.test.mjs` (desenvolvimento) | Primeira execução: 1/22, Git for Windows recusou `os.devNull` (`\\.\nul`). Segunda: 21/22, faltava criar `.git/info` na fixture sem templates. Corrigidos com `/dev/null` para Git e preparação explícita da pasta no teste; nenhum Pi lançado nessas tentativas. |
| `npm.cmd --prefix src test` (intermediário) | 176/176 passaram, sem skips. |
| `npm.cmd --prefix src test` (final) | **180/180 passaram**, sem skips, cancelamentos ou falhas; 28 testes novos e 152 anteriores. Duração ~148 s. |
| `npm.cmd --prefix src run test:engineering` | **2/2 execuções reais passaram**, sequenciais, sem retry automático; detalhes abaixo. |
| `npm.cmd --prefix src run test:runner` | Smoke M01 real passou, término normal, CIM, lease liberada e readquirida. |
| `npm.cmd --prefix src run test:smoke` | Smoke M01 Driver real passou, resposta/settlement, stdin aberto, 5 identidades observadas ausentes, sem força/DEP0190. |
| `git diff --check` | Sem erros; apenas aviso Git de normalização futura LF→CRLF no registro. |
| `review_inputs.py ... M02-T01 --sources ...` e `--check-input` | Seleção existente validada para handoff, sem modificá-la; JSON temporário fora do repositório. Não constitui revisão. |
| `inspectPiLock()` (consulta final) | `status:free`, `canAcquire:true`. |

Log final de testes fora do Git: `C:\Users\User\AppData\Local\Temp\devout-M02-T01-tests-final.log`.
Log intermediário: `C:\Users\User\AppData\Local\Temp\devout-M02-T01-tests.log`.
As falhas iniciais de preparação deixaram pequenos temporários descartáveis sem Pi; não contêm dados reais.

### Evidência real de engenharia (execução final)

- Diretório: `C:\Users\User\AppData\Local\Temp\devout engenharia espaço xIw8EI`.
- `runId`: `run-46e50f3e-19af-4deb-8bc1-11458604bfa1`.
- Baseline fictício: `deb2e4575ecfe9db7c000dafab095a382d2d152e`; branch `fixture`.
- Runner PID 11652: encerrado, exit 0. Pi/árvore observada: PIDs 1212, 7280, 11464, 9180, 6200
  com instantes de criação registrados em `result.json`; todos ausentes na conferência CIM posterior.
  PID isolado não é prova permanente e pode ser reutilizado.
- 4 inícios/fins de ferramentas, recibo correlacionado de `node --test` sem erro;
  `promptAccepted`, `settled`, `markerMatched` verdadeiros; sem abort/erro do assistente.
- Única alteração: `value.mjs`, de `value = 1` para `value = 2`. Conteúdo e diff conferidos;
  teste reproduzido fora do Pi passou. HEAD/branch intactos, sem remotes, staged ou arquivos extras.
- `terminated`, `processesGone`, `canRelease`, `workCompleted`, exit 0 e `forced:false`.
  Lease liberada; nova aquisição/liberação sem Pi comprovada.
- Registro oficial byte a byte intacto durante o smoke; `taskApproved:false`.
- Arquivos preservados: `smoke-summary.json`, `fictional-diff.txt`, solicitação fictícia e
  `operacional/runs/<runId>/result.json`, `state.json`, `events.jsonl`, controle operacional.

Execução anterior igualmente positiva preservada em
`C:\Users\User\AppData\Local\Temp\devout engenharia espaço LUTCDm`,
`run-16339b06-79c6-47c0-86d4-87ba4b49bd10`, baseline
`58da5eb8bafe85e6b79045a78e3fc7733dfb76ec`. O smoke M01 Runner ficou em
`C:\Users\User\AppData\Local\Temp\devout-runner-smoke-NkljfR`,
`run-815f28a4-4c4d-4938-8200-2226023837cd`. Evidências operacionais não versionadas.

## Entregáveis e critério de conclusão

- [x] Perfil explícito de engenharia com validação do Git fictício e superfície documentada.
- [x] Rejeições antes de Pi e diretório operacional; testes também confirmam não aquisição da lease
  em entradas inválidas, revalidação após aquisição, esquema e launcher fechado.
- [x] Pi real produziu edição verificável e executou teste local inofensivo no Windows.
- [x] Compatibilidade M01: suíte anterior e smokes reais de Driver/Runner passaram.
- [x] Término e exclusividade comprovados; registro/HEAD intactos no smoke.
- [x] Ausência de isolamento forte documentada expressamente.

## Não alterar, limites e pendências

Sem serviço residente, comandos livres no launcher, repositórios reais/privados, remote Git ou push.
Somente o harness de preparação da fixture faz um commit inicial local fictício **antes do Pi**;
nenhuma alteração produzida pelo Pi foi commitada. Nenhum commit do Devout foi feito nesta conversa.

A política e o marcador **não são sandbox**: bash tem a superfície da conta Windows, testes JS podem
executar código arbitrário, e conteúdo/histórico não são auditados por scanner universal. A ausência de
credenciais arbitrárias depende da preparação/atestação humana; filtros de nomes e ambiente não provam
isolamento. Credenciais do provedor Pi e dados externos acessíveis à conta não são tecnicamente isolados.
Sem suporte a ambiente hostil/concorrente; não executar sobre dados importantes ou com credenciais Git amplas.

Pendente: revisão independente M02-T01 em **nova conversa**, usando a seleção previamente versionada.
Sem aprovação técnica declarada, sem commits e sem avanço para M02-T02.
