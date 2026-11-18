# M01-T04 — Relatório da implementação inicial

**Papel:** implementador; não constitui revisão independente nem aprovação técnica.  
**Data:** 2026-11-18.  
**Branch:** `feat/m01-t04`, criada após autorização explícita do usuário.  
**HEAD inicial/final desta implementação:** `54d1f0f1fed3bf4d0fd6d7a3799fb4ab93cff0e0`; nenhum commit realizado.

## Entrada, baseline e dependências

- Task consumida de `docs_devout/plano.md`, seção M01-T04, com Fazer/Não alterar/Entregáveis/Critério de conclusão. Entrada regular de implementador: esta task não exige avaliação independente durante a implementação.
- Checkout inicialmente limpo, na `main`; nenhum arquivo alterado antes da confirmação humana da nova branch. Baseline `c771c4b39a34716f15728c1e0d5b2596e776bc41`, com `AGENTS.md`, plano e registro rastreados, commitados e sem pendências nesses caminhos.
- Dependência M01-T01 concluída: funcional `011a984cc0b0780368386f300708506b5e545498`, metadados `eacc45687461b4d13eaac3b73ecce4b729624bc4`.
- Dependência M01-T03 concluída: funcional `647a8501f5b7689a1037495bdd1da5b33cbe0d85`, metadados `54d1f0f1fed3bf4d0fd6d7a3799fb4ab93cff0e0`. Esses quatro commits foram confirmados como ancestrais do HEAD. Histórico de T02 também presente, sem necessidade de reconstrução ou integração por squash.
- Fontes consultadas: mapa `AGENTS.md`, instruções da skill/papel implementador, limites globais/dependências e task atual do plano, registro; contrato MVP v1.0 (seções de arquitetura, invocação, estados, processos e persistência), ADRs ativos 0001–0003, diagnóstico Windows e interfaces/código/testes pertinentes de `src/`. Nenhum protótipo histórico foi reescrito ou reexecutado.
- Ambiente consultado pelos comandos do diagnóstico: Windows nativo (`process.platform=win32`), Node **v24.20.0**, npm **11.19.0**, OpenClaw **2026.11.3 (847611d)**, Pi **1.5.2**, launcher `C:\Users\User\.pi\agent\bin\pi.cmd`. Sem instalação, mudança de política ou credenciais. Gateway não necessário à T04.

## Arquivos criados/alterados

| Arquivo | Alteração |
| --- | --- |
| `src/role-runner.mjs` | CLI `run --config`, validação fechada, papel de teste, integração Driver/lock, estados, evidências sanitizadas e publicação atômica. Exporta interfaces locais para testes; costuras confiáveis não são aceitas pelo JSON/CLI. |
| `src/ROLE-RUNNER.md` | Esquema de solicitação, perfil, autorização de workspace, comandos PowerShell, arquivos/resultados/exit codes, limites, gravação Windows, reconciliação e roteiro de testes. |
| `src/README.md` | Ponte para o Runner e distinção entre smokes diretos do Driver e smoke protegido pela trava; alerta de execução separada. |
| `src/package.json` | Acrescenta somente `test:runner`, sem dependências externas. |
| `src/test/fixtures/runner-rpc.mjs` | Pi falso controlado com canários em stderr/eventos/respostas/modelo/session ID, sucesso e falhas. |
| `src/test/role-runner.test.mjs` | 23 testes novos: validação, ordenação, sanitização, estados, falhas/resultado atômico e oito modos de CLI com Pi falso e supervisão/trava Windows reais. |
| `src/test/smoke-runner.mjs` | Smoke opt-in com subprocesso CLI e Pi real; prova Job + CIM, término do Runner, persistência, registro inalterado e reaquisição. |
| `docs_devout/03-execucao/achados/task-M01-T04-relatorio.md` | Este relatório inicial, persistido antes da passagem à revisão. |
| `docs_devout/03-execucao/registro.md` | Somente estado/observação da T04 pelo `update_registro.py`, na qualidade de agente desenvolvendo o projeto. **O executável Runner não lê nem altera esse registro.** |

Driver, lock, helpers nativos, testes anteriores, `AGENTS.md`, plano, configuração de fontes, `.agents/` e `prototipo/` preservados.

## Implementação e decisões locais de interface

- Uma invocação, um UUID `run-...`, um papel **`test`**, um prompt e no máximo um Pi. Sem seleção de papel real, gates Slice 2, restart, outra sessão, supervisor, HTTP, Named Pipe, commits ou integração OpenClaw.
- JSON local até 256 KiB, UTF-8 sem BOM, campos/tipos/versão fechados, limites para texto/Driver e caminhos absolutos locais. Sem argv/shell/RPC arbitrário nem possibilidade de escolher raiz de lock por run. O launcher é código local confiável validado pelo Driver; prompts só trafegam pelo pipe RPC.
- Workspace é temporário, marcado explicitamente como descartável/fictício, fora de Git, sem links/históricos e com árvore pequena. Isso é autorização local + mitigação, **não isolamento forte** nem detecção geral de segredos. Validação repetida antes de lançar Pi.
- Perfil único `configured-isolated`: modelo/provedor previamente configurado no Pi, sem selecionar modelo dinamicamente. Usa `isolated` do Driver; confirma `get_state` correlacionado, modelo disponível e sessão ociosa antes do prompt. Não persiste identidade do modelo nem session ID.
- `artifactsRoot/runs/<runId>/`: `events.jsonl`, `state.json`, `result.json`. Fora do Git/workspace; UUID não deriva de task, sessão, PID ou exec. Mesma raiz global **padrão** da T03 em todas as CLIs.
- Estado de processo `starting/running/stopping/terminated/uncertain`; resultado técnico `succeeded/failed/interrupted`, sempre `taskApproved:false`. Não existe resultado `completed` de task. Booleans de comunicação/aceitação/settlement/texto/término são evidências técnicas, não aprovação.
- Callback de eventos não lança exceções para dentro do Driver. Persistência falha durante atividade aciona cancelamento/encerramento seguro. Só `lease.finish` pode autorizar liberação, usando o Driver vinculado e sua prova de árvore vazia. Incerteza ou falha de persistência da lease mantém bloqueio, sem reconciliação automática.
- Eventos contêm só tipos fechados, IDs operacionais/instantes, booleans e códigos permitidos; payloads, prompts, respostas, erro do provedor, stderr bruto e históricos não são gravados. Eventos Pi desconhecidos são contados, não copiados.
- JSON final/estado: candidato `wx`, flush/close, rename no mesmo diretório/volume. No Windows, colisões de sharing recebem retry limitado do **mesmo candidato** por até 250 ms; nunca se apaga o destino válido. Persistência que continuar falhando é erro explícito. Temporários não são resultados publicados; ausência de `result.json` não autoriza sucesso.
- Ao final, a CLI drena stdout/stderr e termina após as tentativas de término e persistência. Mesmo se processos incertos ainda segurarem pipes/IPC, o Runner não vira residente. Isso **não** encerra ou presume encerrado o Pi: sua lease bloqueante fica preservada.

## Comandos, testes e resultados

### Gate final, executado sequencialmente

```powershell
npm.cmd --prefix src test
npm.cmd --prefix src run test:runner
```

1. **90/90 testes passaram**, 0 falhas, 0 skips, aproximadamente 133 s. São os 67 testes anteriores + 23 novos. Os oito modos de CLI com Pi falso passaram: normal, erro RPC, EOF, crash, timeout, erro do assistente, settlement abortado e texto divergente. Cada invocação confirma o `close` do Runner, término/liberação quando comprovados, evidências sanitizadas, `registro.md` inalterado e nova aquisição/liberação da trava global.
2. **Smoke real passou**, iniciado separadamente após o término da suíte:
   - `runId`: `run-2df5322a-f9f8-4495-88ac-1ac6bb58b7f5`;
   - Runner PID `13132`, exit code **0**, `runnerClosed=true`;
   - `state=terminated`, `technicalOutcome=succeeded`, **`taskApproved=false`**;
   - comunicação correlacionada/modelo disponível/aceitação/settlement/marcador: todos verdadeiros; abort/erro do assistente: falsos;
   - 20 eventos Pi observados, 0 bytes de diagnóstico, 9 eventos resumidos persistidos; stdout corresponde exatamente aos eventos + resumo final, stderr vazio;
   - identidade do host: PID `5460`, criação FILETIME `134394754351299642`; 5 identidades observadas;
   - `processesGone=true`, `canRelease=true`, `workCompleted=true`, `forced=false`, exit code **0**, sem falha;
   - CIM independente comprovou ausência dos PIDs observados **e** do Runner; registro inalterado; trava adquirida/liberada novamente.
3. Evidência operacional pequena, preservada **fora do repositório**:
   - `C:\Users\User\AppData\Local\Temp\devout-runner-smoke-gk6NCk\smoke-summary.json`;
   - `C:\Users\User\AppData\Local\Temp\devout-runner-smoke-gk6NCk\operacional\runs\run-2df5322a-f9f8-4495-88ac-1ac6bb58b7f5\`.
   - Não copiar esses arquivos operacionais ou históricos de sessão para o Git.
4. `node --check` nos módulos do Runner/teste/smoke: sem erro. `git diff --check`: sem erro. Não há lint configurado; não foi inventado outro gate.

### Rodadas intermediárias e diagnóstico preservado

- Primeira suíte focada: **15/21**, com seis diferenças de assert de serialização (`undefined` no mock desaparecia do JSON). Contrato de saída normalizado para `null`; testes seguintes passaram. CLI nativa já passava nos oito modos nessa primeira rodada.
- Um comando com regex negativa de filtro acabou executando testes CLI que se pretendia excluir, enquanto o primeiro smoke real estava ativo. Foi **erro operacional do implementador**: **14/21** nessa rodada, com sete falhas de expectativa relacionadas à disputa `LOCK_BUSY`/checagem de lock. A proteção global recusou o concorrente, **não autorizou dois Pi simultâneos**. O smoke real passou (`run-e0d3f417-db11-4238-9854-998458b8b796`, resumo em `%TEMP%\devout-runner-smoke-gRaQGc`). As invocações subsequentes foram sequenciais, sem contornar/apagar a trava.
- Primeira suíte completa após adicionar leitor concorrente: **89/90**. Teste de publicação encontrou `EPERM` real do Windows durante reposição do destino com polling de 1 ms. Acrescentado retry limitado de sharing e documentado que pressão sustentada pode falhar explicitamente. Teste de leitores usa polling de 20 ms (controlador recomendado: >=500 ms); não se afirma garantia de disponibilidade sob leitura agressiva. Falhas de serialização/rename/publicação continuam cobertas sem destino parcial/falso sucesso. O teste de leitores passou em **5/5 repetições isoladas**, além da suíte final 90/90.
- Essas rodadas são iterações da implementação inicial, não revisões/correções oficiais do ciclo da skill.

## Verificação de entregáveis e critério de conclusão

| Requisito | Evidência obtida nesta implementação |
| --- | --- |
| Executável CLI temporário e interface documentada | `role-runner.mjs` + `ROLE-RUNNER.md`; rejeição de flags/campos inválidos antes do lançamento. |
| Configuração local autorizada, descartável e isolada | Testes de versão/campos/tipos/perfil, marcador, Git/históricos, links/junctions, limites e caminhos; perfil real isolado no smoke. |
| Identidade de execução, acompanhamento e persistência | Dois runs com UUIDs distintos; sequência JSONL; state/result; stdout verificado contra eventos no smoke. |
| Gravação segura/atômica e logs sanitizados | Leitores independentes, candidato + rename, falhas sem resultado publicado; canários não aparecem em eventos/state/result/stdout/stderr do Runner. |
| Estados/resultados sem aprovação de task | Testes de sucesso/falhas/incerteza/interrupção; sempre `taskApproved=false`, sem `completed`. |
| Aquisição antes de Pi e liberação só após término | Ordenação determinística + integrações nativas com lease/Driver reais; smoke confirma árvore vazia e reaquisição. |
| CLI real termina Pi e Runner, com resultado verificável | Smoke real final, Job + CIM e `close` do subprocesso CLI, sem força. |
| Solicitação inválida/crash/EOF não produz sucesso nem altera registro | Testes de CLI e comparação dos bytes do registro em todas as integrações; falha técnica e encerramento verificado. |
| Sem serviço, paralelismo autorizado, automação de task/Git ou históricos | Nenhuma implementação dessas áreas; fontes anteriores e infraestrutura de T01–T03 preservadas. |

## Pendências e limites

- **Revisão independente ainda não realizada.** Não há aprovação nem autorização de commits nesta conversa. Não avançar à M01-T05.
- `fontes-revisao.json` autoriza somente T01/T02/T03. A próxima revisão da **M01-T04** precisa de **recorte/seleção explicitamente autorizado e preparado antes da conversa independente**, incluindo o adiamento deste relatório/Observações e dos guias mistos quando aplicável. Nenhum fallback de leitura integral nem alteração automática de plano/mapa/configuração foi feito aqui. Essa preparação não foi tratada como implementação de código adicional desta task.
- Só papel de teste, um perfil que herda o modelo configurado, sem gates de papéis reais, atualização oficial, seleção dinâmica de modelo, cancelamento entre invocações ou integração OpenClaw.
- Incerteza é exercitada por costura determinística, não por deixar Pi real deliberadamente órfão na raiz global. A recuperação conservadora é a já aprovada na T03; não há matança/reconciliação automática adicional.
- Filesystem Windows local/confiável; teste sob sharing mostra limite real de disponibilidade. Atomicidade não promete durabilidade absoluta contra energia/disco nem proteção contra manipulação hostil dos arquivos da conta.

**Encaminhamento:** implementação inicial entregue para revisão em conversa nova, após preparar a seleção independente da T04. Relatório persistido antes de atualizar a T04 para `aguardando revisão` pelo script oficial. Sem commits.

## Apêndice — preparação da revisão autorizada pelo usuário

Em 2026-11-18, após a entrega inicial, o usuário autorizou preparar a seleção independente da M01-T04. Isso resolve a pendência de configuração descrita acima, **sem iniciar a revisão, aprovar a task ou autorizar commits**.

- `fontes-revisao.json`: adicionada somente a seleção M01-T04, com task completa, restrições globais, contrato/decisões vigentes como fontes iniciais; resultados históricos, diagnósticos e protótipos ficam adiados. `src/README.md`, `src/PI-LOCK.md` e `src/ROLE-RUNNER.md` ficam integralmente adiados para o confronto, sem excluir seu exame final ou seus diffs. Registro/relatos são filtrados pelo preparador, não incluídos como fontes normativas.
- `AGENTS.md`: publicada a seleção autorizada e o comando da T04, com adiamento explícito dos três guias.
- `plano.md`: apenas os quatro rótulos da M01-T04 foram convertidos de negrito para subtítulos Markdown `####`, exigidos pelo preparador. Comparação automatizada com HEAD confirmou que **nenhum requisito, limite, dependência, ID ou outra task foi alterado**.
- Comparação estrutural do JSON com HEAD confirmou que as seleções T01/T02/T03 permanecem **idênticas**. A seleção T04 corresponde ao candidato preparado a partir das regras já aprovadas da T03, ajustando task/intervalos e adiando também o guia do Runner.
- `review_inputs.py --sources` e `--check-input` passaram para **T01, T02, T03 e T04**. Verificações adicionais confirmaram os quatro campos completos, guias sem conteúdo inicial/nem `untracked_allowed`, presença de fontes/registro/relatório e guias alterados em `deferred_changed`, e ausência dos resultados anteriores desta task no conteúdo inicial. Uma cópia temporária com `input_id` incompatível foi recusada com exit 2, sem JSON.
- Entradas de validação persistidas **fora do repositório**, em `C:\Users\User\AppData\Local\Temp\devout-review-T04-prep-f9q0j804\`. A entrada T04 é `M01-T04.json`, com `input_id=70374de36f38f84c5ac5bfc282bc018bc665a916751315d75e04ff26446e6f14`, `snapshot=577224d61efa9621b52bee3d0b1744a253a851c4779e370fd9bceb05d9fc0805` e `git_revision=54d1f0f1fed3bf4d0fd6d7a3799fb4ab93cff0e0`. São entradas de teste da preparação, não avaliação independente nem garantia de atualidade futura. O revisor deve gerar e conferir sua própria entrada na conversa nova; não versionar esses JSONs.
- Nenhum código/teste do Runner, Driver, lock, helper ou skill foi alterado nesta preparação; nenhum Pi foi lançado. Os testes funcionais e o smoke registrados acima continuam sendo os da implementação inicial, não foram promovidos a aprovação técnica. Estado mantido em `aguardando revisão`; apenas Observações atualizadas pelo script, sem mudar status/hash/timestamp.

**Próximo passo:** revisão independente da M01-T04 em conversa nova, começando pelo comando publicado em `AGENTS.md`. Os documentos/diffs adiados e este relatório devem ser confrontados somente após a avaliação inicial persistida. Sem commits.
