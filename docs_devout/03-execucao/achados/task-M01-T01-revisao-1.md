# Revisão M01-T01 — rodada 1
Estado: finalizada
Snapshot da entrega: 3e9a6922dd50aeceec40203eb70abb41e3674aee1e9ae40ecd8717302d886a8d
Entrada: 30dcb6ad85ce9a6cfffebc0a52f97d271ee5297f38b792f51bf8a45954f6ea71
Revisão Git: 0d1d049427d5dacbd18bbc4f41599ff032a035d9
Configuração: `docs_devout/03-execucao/fontes-revisao.json`; SHA-256 `1c8d034db26302c94aab54b4ffec381029dd9e68209b5228f328af9a07a42709`.

## Avaliação independente

Avaliação persistida antes de consultar relatório, Observações, conteúdos históricos e diffs adiados. Entrada própria gerada por `review_inputs.py --sources`, guardada fora do repositório e revalidada com `--check-input` imediatamente antes desta gravação. A tentativa anterior desta conversa parou por ausência da configuração, sem exposição a relatos ou conclusões técnicas anteriores; a configuração foi posteriormente fornecida pelo usuário.

### Identificação e escopo

- Task completa com Fazer/Não alterar/Entregáveis/Critério recebida pelo preparador; status `aguardando revisão`; nenhuma dependência obrigatória; nenhuma revisão anterior identificada (R1).
- Branch `feat/m01-t01-pi-driver`, coerente com a entrega e sem troca de branch. Baseline `c771c4b` contém mapa/plano/registro rastreados e é ancestral de HEAD. Alterações intermediárias do registro não foram exigidas limpas.
- Inventário inicial: alterações em AGENTS.md, plano e registro; novos configuração de fontes, relatório e seis arquivos em src/. Entregáveis de código estão untracked, não ausentes: foram lidos integralmente. Diffs filtrados HEAD/staged/unstaged vazios; conteúdos/diffs das fontes e narrativas ficam para o confronto.
- Inspecionados: `src/package.json`, `src/pi-driver.mjs`, `src/test/fixtures/fake-rpc.mjs`, `src/test/pi-driver.test.mjs`, `src/test/smoke-pi.mjs`, seleções iniciais de `src/README.md`, plano, mapa, contrato, decisões e diagnóstico.

### Checklist de Fazer e Entregáveis

- Driver reutilizável e interface documentada: `startPi`, `PiDriver`, ready/closed, command/getState/prompt/promptAndWait e eventos; sem dependências externas.
- Windows: launcher usa cmd.exe com shell:false, windowsVerbatimArguments, comando literal fechado por perfil e caminho confiável em variável própria, com rejeição de metacaracteres. Não concatena prompt/argumentos arbitrários ao shell. Valida limites antes de spawn.
- Transporte: UUID por comando, correlação id/requestId, separação response/event/diagnostic, rejeição de command mismatch e resposta malformada; eventos com ID não satisfazem pendências.
- JSONL incremental: acumula bytes até LF, decodifica UTF-8 de forma estrita, aceita CRLF e separadores Unicode dentro do JSON; limita registros antes do parse, comandos pendentes e fila de escrita; respeita backpressure.
- Erros: erro RPC pertence ao comando; parse inválido, EOF truncado/antecipado, timeout e falhas do processo/pipes invalidam transporte e rejeitam pendências; não há retry silencioso.
- Conclusão observada: aceitação started e agent_settled são ambos exigidos por promptAndWait; agent_end/exitCode=0 não bastam. Observador instalado antes do envio e funciona com settlement anterior ao ack. Erro/abort do assistente permanece sinalizado; nenhum julgamento de aprovação de task.
- Testes falsos cobrem fragmentação UTF-8, CRLF, múltiplas linhas, respostas fora de ordem, eventos intercalados, erros RPC/protocolo, EOF, timeouts, limites, backpressure, spawn e ausência de falso sucesso.
- Smoke usa workspace temporário e perfil isolated, prompt inofensivo, saída sanitizada, observação de identidades e encerramento. Sem persistir RPC, stderr ou histórico bruto.
- Roteiro reproduzível presente nas seleções iniciais do README. Evidências próprias do teste real registradas abaixo. Experimentos históricos serão consultados apenas na fase 2, conforme seleção aprovada.

### Checklist item a item de Não alterar

1. **Sem HTTP, daemon Node permanente, Named Pipe ou framework genérico:** atendido; somente módulo e processos temporários de testes.
2. **Sem lógica de papéis/revisão/registro/Git Gateway/commits automáticos no produto:** atendido pelo código; não há automação de workflow/Git. A atualização documental desta revisão é execução manual da skill, não comportamento do Driver. Diffs documentais adiados serão conferidos na fase 2.
3. **Sem shell com argumentos arbitrários de modelo nem logs brutos com credenciais:** atendido; shell recebe somente literal fixo, RPC segue por stdin, diagnósticos são expostos sem gravação automática, smoke imprime resumo e limpa texto em memória. A árvore e fallback test-only não recebem parâmetros do modelo.

Nenhuma antecipação de T02–T06 identificada: closeInput apenas solicita EOF e closed observa o filho; o Driver não promete matar/verificar árvores nem obter exclusividade global. O smoke realiza supervisão própria para não abandonar processos de teste silenciosamente.

### Validações próprias (Windows nativo, 2026-11-17)

- Ferramentas: Node v24.20.0; npm 11.19.0; Pi 1.5.2; OpenClaw 2026.11.3 (847611d). OpenClaw Gateway não é necessário nesta task.
- `npm.cmd --prefix src test`: **33 testes passaram**, 0 falhas, 0 skips; duração aproximada 5 s. Inclui launcher real com fixture em caminho com espaço/Unicode e prompt contendo metacaracteres.
- Inventário CIM anterior ao smoke: nenhum processo node/pi/cmd com `--mode rpc` identificado; smoke executado sequencialmente.
- `npm.cmd --prefix src run test:smoke`: **pass=true** em `2026-11-17T17:31:45.202Z`; getStateCorrelated=true, promptAccepted=true, settled=true, stdinOpenAtSettled=true, markerMatched=true, assistantError=false, diagnosticBytes=0, dep0190=false, exitCode=0, forced=false, processesGone=true, observedProcessCount=4.
- Eventos do smoke: agent_start=1, turn_start=1, message_start=3, message_end=3, message_update=9, turn_end=1, agent_end=1, agent_settled=1. Nenhum conteúdo de resposta/provedor ou session ID persistido.
- Inventário CIM posterior: `RpcProcessesRemaining=0`. Sem processo RPC de teste observado abandonado; encerramento normal confirmado pelo smoke, sem taskkill.
- `review_inputs.py ... --check-input <entrada própria>`: passou após os testes, antes de persistir esta avaliação; snapshot/entrada/fontes inalterados.

### Achados e conclusão preliminar

Nenhum bloqueador ou importante identificado na entrega inspecionada. Critério técnico de conclusão reproduzido no Windows com processo falso e Pi real, sem DEP0190 ou stdin fechado prematuramente. Aprovação ainda preliminar: falta confrontar relatório e revisar integralmente fontes/conteúdos/diffs adiados, inclusive separação das mudanças de preparação fornecidas pelo usuário. Nenhum commit autorizado.

### Manifesto SHA-256 das fontes da entrada

| Caminho | SHA-256 |
|---|---|
| docs_devout/plano.md | 638515b57c7e32e1786fb024f0ab332e1e612821bb71123c7dc059a75f59ddfc |
| AGENTS.md | 3a04b9e562e00aae2bb824d897c033c3770eb78d02afe6aef9aab710e5e1ae96 |
| docs_devout/02-design/contrato-orquestracao-mvp.md | 34845bd0154612091c44d969216e488679fcd6184958c124a73b7b14aebb63dd |
| docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md | a4855eacf2083f3eed1d563507f3560baeea9facab21a52cbe349d069f18903a |
| docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md | 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6 |
| docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md | 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8 |
| docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md | 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018 |
| docs_devout/how-to/diagnosticar-ambiente-windows.md | 85d0e049136eb8ba35cb073e0c043fe29cc9eaea5979f86bbfff6bff8972b562 |
| src/README.md | 64b418e46e220dd2e5061f926a2cc1b4769afc992bb432c11d081ebd4bd3c85f |
| prototipo/prova-integracao-openclaw-pi/probe-pi-rpc.mjs | 47e7c81ecaab144482c976fbaabf1a1e924fc4f2b78963b4298b0350a0776d84 |
| prototipo/prova-integracao-openclaw-pi/experimento-integracao-openclaw-pi.md | 43d38a9c7bfe82cc72848f40a3cab619a88e0609a09a7f3ae1bc6e332aa2ba21 |
| prototipo/prova-pi-eventos-rpc-v2/pi-rpc-eventos.mjs | d51acfced0bc0168540dfe9291629ab3dc859ad60270f4603228fce33b367461 |
| prototipo/prova-pi-eventos-rpc-v2/README.md | 1af6923df71cae73a9e96cd1e442ba92c928433ee66883b47cd1fd311d4a66d6 |
| prototipo/teste-cancelamento-pi/pi-rpc-abort.mjs | f074f1752ba7c869b0a20e917305fbe5c9065b2e791d256fab700b7488580abc |
| prototipo/teste-cancelamento-pi/README.md | e4ae6ddb7177a647302c33a77934ae00578571e16a4db5a930b2609f07ad3f98 |

Hashes de diffs das fontes: HEAD/unstaged `5960a670e25e34e92c235143dfd518077ef8d81a049a36bf0d1006b6e44c3a8e`; staged `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

## Confronto com relatos

Após persistir a avaliação independente, foram lidos integralmente o relatório da implementação inicial, README, configuração de seleção, registro e todos os trechos de `deferred_sections`, incluindo as seis fontes históricas de protótipos. Também foram consultados os diffs integrais HEAD, staged e unstaged de todos os caminhos do inventário e das fontes; staged vazio e somente AGENTS.md/plano/registro com hunks rastreados. Arquivos novos foram revisados pelo conteúdo, sem staging.

- As alegações do relatório sobre transporte, launcher, limites, correlação e settlement correspondem ao código e aos resultados próprios. A evidência antiga de 33 testes e smoke bem-sucedido foi reproduzida independentemente, sem depender dela para aprovação.
- Não há revisões anteriores nem seções de correção: **zero correções completas**, revisão inicial R1. A falha intermediária de asserção descrita pelo implementador não é rodada de correção do workflow; a suíte atual foi reexecutada sem falhas.
- O relatório preserva os limites de T02/T03 e não apresenta o smoke como prova de encerramento robusto genérico, exclusividade global ou aprovação de task. Os quatro processos observados no novo smoke terminaram normalmente.
- Protótipos confirmam os riscos que não foram copiados para a entrega: shell:true/DEP0190, buffers menos defensivos, logs integrais e fechamento de stdin. Foram somente consultados, não editados nem reexecutados. Contrato e ADRs preservados.
- O diff de AGENTS.md atualiza mapa/testes conforme sua instrução preexistente. A configuração e o comando de preparação adicionados, bem como os quatro subtítulos Markdown no plano, são preparação fornecida pelo usuário para destravar esta revisão: foram inspecionados separadamente, sem atribuí-los à implementação original. Não alteram requisitos/IDs/dependências nem automatizam papéis. O arquivo JSON limita a seleção à M01-T01, particiona fontes e adia narrativas/evidências anteriores. Esta revisão não decide seu staging ou integração automática com a task.
- A frase histórica do relatório de que ainda faltava seleção de fontes descreve o instante da implementação; a preparação posterior recebida nesta conversa resolve essa pendência. Não se reescreveu o relato para apagar o histórico.
- Registro mantém seis colunas; somente M01-T01 alterada administrativamente; demais tasks intactas. Não há lógica de registro no produto, commits ou mudanças de skills.
- `node --check` para Driver, smoke e fixture, além de `git diff --check`, passaram na fase 2 (somente avisos Git de normalização LF/CRLF).
- `--check-input` foi novamente aprovado na fase 2; mesma entrada, revisão Git, fontes, index e snapshot. A revisão gerada é narrativa excluída da entrega filtrada, sem invalidar seu snapshot.

### Melhoria opcional O1 — atualizar diagnóstico histórico

`docs_devout/how-to/diagnosticar-ambiente-windows.md`, seções “Antes de executar código da task” (item 2) e “Testes disponíveis”, ainda diz que o baseline está pendente e que não existem comandos definitivos validados. O Git e os testes desta revisão confirmam o baseline `c771c4b` e os scripts documentados em AGENTS.md/src/README.md. Recomenda-se atualizar essas afirmações em manutenção documental autorizada, preservando o contexto histórico pertinente. Documento preexistente e não alterado pela task; não impede o critério técnico nem exige abrir correção da M01-T01. A verificação Git prevalece sobre a afirmação temporal antiga; não há alteração de requisito a decidir.

O confronto confirma a conclusão preliminar, sem novo bloqueador/importante.

## Decisão final

**APROVAÇÃO TÉCNICA da M01-T01 (R1).**

- Bloqueadores: **0**. Importantes: **0**. Melhoria opcional: **O1**, diagnóstico documental desatualizado, descrito acima.
- Correções completas: **0**. Sem rodada de correção a abrir.
- Entregáveis e critério de conclusão atendidos: módulo/interface, suíte **33/33**, roteiro e smoke real **PASS** em Windows, settlement observado sem fechamento prematuro de stdin, sem DEP0190 e com término normal dos processos observados. Todos os itens de Não alterar conferidos, inclusive após os diffs adiados.
- Limites mantidos: sem isolamento forte, sem exclusividade global ou término robusto reutilizável; T02–T06 não foram executadas nem liberadas. A aprovação cobre a entrega/fontes identificadas no cabeçalho, não mudanças posteriores ou integração automática da preparação documental do usuário.
- Encaminhamento: manter `aguardando revisão` e acrescentar ao registro a aprovação e o vínculo desta revisão, preservando as notas existentes. **Aguardando autorização explícita para os dois commits** (funcional e metadados). Não houve commit, staging, push, merge nem troca de branch; a task não está oficialmente concluída e a próxima não está liberada.

### Autorização posterior e preparação dos commits

Após a publicação desta decisão, o usuário autorizou os dois commits e confirmou expressamente a inclusão da preparação da revisão (`fontes-revisao.json`, ajustes no `AGENTS.md` e subtítulos do `plano.md`) no commit funcional. Essa autorização resolve o encaminhamento pendente acima, sem alterar a avaliação independente ou os achados.

Antes do staging, `--check-input` confirmou novamente a entrada/snapshot originais, e relatório, revisão, inventário e diffs documentais foram reconferidos. Nenhuma mudança técnica posterior à aprovação foi identificada. O primeiro commit incluirá entregáveis, preparação autorizada, relatório e esta revisão; o segundo incluirá somente `registro.md`, com status `concluída` e hash do primeiro. Sem autorização ou execução de merge, push ou próxima task.

Após o staging explícito dos 11 arquivos autorizados (sem registro), a entrada passou a `d223ea5a3655ac7a5e4945c20327873d74023daabd9f7f1bb8506a6586ff9ce7`, snapshot `47bb06c49e8018391d59a52ac212a6b08e9c301102a720be713bece59f3d5ede`. A diferença de identificação foi examinada: arquivos untracked tornaram-se adições staged e os hunks anteriores passaram ao index; os diffs de fontes agora incluem também as adições antes untracked. HEAD e os hashes integrais da configuração/fontes continuam iguais. Cada blob staged foi comparado ao conteúdo de worktree já revisado (normalização Git), e o conjunto staged foi validado contra a lista exata autorizada; nenhuma alteração técnica ou de requisito. Esta nota posterior é a única adição narrativa e não modifica a avaliação independente.
