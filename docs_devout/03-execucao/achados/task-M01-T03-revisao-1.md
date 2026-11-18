# Revisão M01-T03 — rodada 1
Estado: finalizada
Snapshot da entrega: 28ea038284d563b7e181c67ded32e6aa0dc7d3e1fa5eddfdba03e5b891c5c38d
Entrada: 7e879609d6d98ed47fdf23b14cd8b36ee8c0c69c36e7cf20505af0a3a3420006; revisão Git: fbde012df9dfd069478172d431fd22503d913de3
Configuração: docs_devout/03-execucao/fontes-revisao.json; SHA-256: 9c4480836f635653895007d853d6fc63b58fb1adfe42f32acfada2644a73700b

## Avaliação independente

Avaliação persistida antes de abrir relatos, Observações, guias adiados e diffs narrativos. Entrada preparada com `review_inputs.py --sources`, guardada fora do repositório e revalidada com `--check-input` (exit 0) imediatamente antes desta gravação. Sem revisões anteriores segundo os metadados; esta é R1.

### Gates e identificação

- Task com os quatro campos obrigatórios; estado `aguardando revisão`; branch `feat/M01-T03-exclusividade-pi`, coerente com a task e com a convenção de branches por task.
- Baseline dos três caminhos rastreados identificado em `c771c4b39a34716f15728c1e0d5b2596e776bc41`.
- Dependência obrigatória M01-T02 concluída: funcional `9c6e88c534e47f95c4c42c72c3797d40631710d1` ancestral de HEAD e metadados em HEAD `fbde012df9dfd069478172d431fd22503d913de3`. Conferência inicial restrita a metadados/presença/ancestralidade, sem ler relatos.
- Inventário preparado: cinco novos arquivos executáveis/testes permitidos, sete caminhos adiados; nenhum diff de entregável rastreado, staged ou unstaged. Todos os cinco arquivos novos foram lidos integralmente. Contexto de integração lido em `src/pi-driver.mjs`, `src/windows-process-tree.mjs` e `src/package.json`.

### Requisitos e entregáveis

- `src/windows-lock-guard.mjs` e `.ps1`: helper temporário mantém handle nativo com `FileShare.None` sobre arquivo estável, sem unlink; disputa independente perde com `LOCK_BUSY`. Executável fixo e script codificado, `shell:false`; caminho e PID via stdin JSON.
- `src/pi-lock.mjs`: lease criado com `wx` sob guarda; runId/token, proprietário PID+criação+imagem e identidade de máquina/boot. Intenção `launching` persistida antes de executar a factory do Driver; apenas um lançamento por lease; falha preserva bloqueio. Finalização espera lançamento pendente, chama o Driver vinculado e exige identidade correspondente, `terminated`, `canRelease` e `processesGone` antes de arquivar/liberar.
- Inspeção não libera nem inicia execução. Reconciliação explícita exige token e nova avaliação sob a mesma guarda: proprietário comprovadamente ausente antes de lançamento, recibo durável de término ou boot anterior da mesma máquina. PID reutilizado não prova término da árvore lançada. Dono vivo, observação incerta, lease inválido e crash pós-lançamento continuam bloqueando. Não há restart de task.
- `src/test/pi-lock.test.mjs` e `src/test/fixtures/lock-worker.mjs`: cobertura de políticas de falha, corrupção, perda de guarda, identidade e disputa com três processos Node reais sincronizados por barreira. Pi falso lançado pelo Driver real/Job Object no Windows.
- Entregável documental identificado em `src/PI-LOCK.md` e alterações de `src/README.md`; conteúdo deliberadamente reservado para confronto. Aprovação documental ainda pendente nesta fase.

### Checklist de Não alterar (item a item)

1. **Não iniciar dois Pi simultaneamente:** atendido nos caminhos inspecionados e nas duas execuções próprias dos testes T08. Uma única autorização entre três contendores; bloqueio durante execução; próxima execução somente após `finish` com prova de término. Guarda perdida não permite ignorar lease existente.
2. **Não usar lock/PID isolado como prova nem apagar lock incerto:** atendido. Identidades nativas incluem criação/imagem; término vem do Driver/árvore. Locks anteriores exigem reconciliação; arquivos antigos são arquivados, não apagados. Crash pós-lançamento mantém bloqueio mesmo após sumirem os PIDs conhecidos.

Limites comuns: nenhum código novo fora de `src/`, nenhum serviço permanente/Docker/WSL, nenhum shell com parâmetros variáveis, nenhuma automação de registro/commits/tasks introduzida. Integridade e atribuição das alterações documentais/seleção serão conferidas integralmente na fase 2.

### Validação própria

- `npm.cmd --prefix src test`: **67/67 passaram**, 0 falhas, 0 skips; duração aproximada 71,9 s. Incluiu regressões Driver/ciclo de vida e os quatro testes Windows novos de exclusividade/recuperação.
- `node --test --test-name-pattern='Windows T08' src/test/pi-lock.test.mjs`: **2/2 passaram**, 0 falhas/skips; duração aproximada 21,1 s. Nova disputa entre processos e novo crash pós-lançamento, independentes da execução da suíte completa.
- Não executado smoke com Pi real/provedor: o aceite desta task permite Pi falso e foi exercitado com processos Windows reais, sem abrir outro Pi do workflow.

### Achados e conclusão preliminar

Nenhum bloqueador ou importante identificado no código/testes. Exclusividade, próximo lançamento após encerramento confirmado e bloqueio de estado incerto (T08) demonstrados nas execuções próprias. Conclusão preliminar favorável, sujeita ao confronto documental/histórico obrigatório; não é aprovação final nem autorização de commit.

### Manifesto SHA-256 das fontes recebidas

- `docs_devout/plano.md`: 963d5452c62ec376e03872e9b32b70a2db08a38ae0265831a5974b43168c1a18
- `AGENTS.md`: e8deb2d71df103d71f4ec360287c949f377bd51e4e6417f547e3549c7a0eef1c
- `docs_devout/02-design/contrato-orquestracao-mvp.md`: 34845bd0154612091c44d969216e488679fcd6184958c124a73b7b14aebb63dd
- `docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md`: a4855eacf2083f3eed1d563507f3560baeea9facab21a52cbe349d069f18903a
- `docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md`: 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6
- `docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md`: 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8
- `docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md`: 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018
- `docs_devout/how-to/diagnosticar-ambiente-windows.md`: 85d0e049136eb8ba35cb073e0c043fe29cc9eaea5979f86bbfff6bff8972b562
- `src/README.md`: 95dd080cd5665721eb5360713761d4370e05ca4f5dc04d9f9edce3b4aa16cb81
- `src/PI-LOCK.md`: 7cea97c617271a7db2c49503d24bcdb4775ce787497c50d47678cd35ffb2c317
- `prototipo/prova-integracao-openclaw-pi/probe-pi-rpc.mjs`: 47e7c81ecaab144482c976fbaabf1a1e924fc4f2b78963b4298b0350a0776d84
- `prototipo/prova-integracao-openclaw-pi/experimento-integracao-openclaw-pi.md`: 43d38a9c7bfe82cc72848f40a3cab619a88e0609a09a7f3ae1bc6e332aa2ba21
- `prototipo/prova-pi-eventos-rpc-v2/pi-rpc-eventos.mjs`: d51acfced0bc0168540dfe9291629ab3dc859ad60270f4603228fce33b367461
- `prototipo/prova-pi-eventos-rpc-v2/README.md`: 1af6923df71cae73a9e96cd1e442ba92c928433ee66883b47cd1fd311d4a66d6
- `prototipo/teste-cancelamento-pi/pi-rpc-abort.mjs`: f074f1752ba7c869b0a20e917305fbe5c9065b2e791d256fab700b7488580abc
- `prototipo/teste-cancelamento-pi/README.md`: e4ae6ddb7177a647302c33a77934ae00578571e16a4db5a930b2609f07ad3f98

## Confronto com relatos

Fase 2 executada após a persistência da avaliação acima, que permanece intacta.

- Relatório M01-T03 integral (incluindo preparação posterior autorizada), registro/Observações, `src/README.md`, `src/PI-LOCK.md`, configuração e todas as 19 seleções adiadas examinados. Incluídos trechos do plano/contrato/ADRs, referência de integração, diagnóstico e seis arquivos históricos de protótipos. Protótipos apenas consultados, sem execução/alteração.
- Todos os caminhos de `inventory`/`deferred_changed` conferidos por conteúdo e diffs HEAD/staged/unstaged com caminhos explícitos. Staged vazio; diffs HEAD e unstaged iguais; demais fontes históricas/normativas não têm alterações. Relatório e guia novos examinados diretamente, sem depender de `git diff` para arquivos untracked. Nenhum conteúdo alheio/preexistente não identificado no pacote; a preparação documental está discriminada no apêndice autorizado.
- Comparação automatizada: JSON acrescenta apenas M01-T03 e preserva integralmente os objetos T01/T02; plano altera somente os quatro rótulos da T03 para subtítulos, sem mudar requisitos/dependências. Mudanças do mapa limitam-se à entrada/seleção da revisão. Partições e classificação initial/deferred compatíveis com os conteúdos: conclusões históricas/implementação e guias reservados ao confronto, não ocultados da revisão final.
- Relatório e R1 finalizada da dependência M01-T02 consultados nesta fase. Aprovação/versionamento coerentes com histórico e testes de regressão reproduzidos agora. Não há revisão anterior nem seção de correção da T03: **zero correções completas**. Ajustes durante implementação/preparação não são correções do workflow.
- Alegações técnicas da T03 confirmadas pelas provas próprias: 19 casos novos dentro dos 67 testes, exclusão nativa em disputa inicial, próxima execução após término comprovado, reconciliação explícita antes de lançamento, bloqueio após crash com árvore incerta e tratamento de PID reutilizado. Falha inicial de UTF-8 relatada não é usada como evidência positiva; raízes com espaços/Unicode passaram nesta execução.
- Guia de reconciliação completo e coerente com a implementação: mesma raiz confiável/global, proibição de apagar guard/lease ou trocar de raiz, token/prova revalidados sob guarda, arquivo retirado preservado e nenhuma retomada/reinicialização automática de task. Reconciliação após boot anterior é política testada por costura; **não houve reboot físico** nesta revisão nem na implementação. Metadados corrompidos/árvore perdida no mesmo boot permanecem bloqueados deliberadamente, sem bypass.
- `finish` final/idempotente e encerramento conservador em erro (inclusive WORK_ACTIVE sem cancelamento) documentados expressamente; não promete retry ou liberação por PID ausente. Costuras de teste não são entradas de produção/modelo. Uso direto do Driver/smokes permanece explicitamente sem aquisição implícita; integração obrigatória pertence à T04 e não foi antecipada.
- Diagnóstico reconfirmado: Windows nativo, Node v24.20.0, npm 11.19.0, Pi 1.5.2, OpenClaw 2026.11.3 (847611d), launcher descoberto em `.pi/agent/bin/pi.cmd`. Nenhum provedor/Gateway ou Pi real de workflow iniciado. CIM posterior dos hosts/workers/fixtures descartáveis retornou `DisposableProcessesRemaining=0`.
- `git diff --check` passou. Entrada revalidada novamente com `--check-input` antes desta decisão: exit 0, mesmo input_id/snapshot/HEAD/fontes/index. A revisão criada é narrativa excluída da entrega filtrada e não invalida seu snapshot.
- Persiste a melhoria opcional documental O1 preexistente, já descrita na R1 da T02 e herdada da T01: `docs_devout/how-to/diagnosticar-ambiente-windows.md` ainda diz baseline e testes pendentes. Git, mapa e README permitem conferir a situação atual. Não foi introduzida pela T03; não exige correção nesta task.

Confronto confirma a conclusão preliminar. Nenhum achado bloqueador/importante adicional; os limites relatados são explícitos e não foram convertidos em garantias não testadas.

## Decisão final

**APROVAÇÃO TÉCNICA da M01-T03 — R1.**

- Bloqueadores: **0**. Importantes: **0**. Nenhuma melhoria opcional nova; dívida documental O1 preexistente preservada acima.
- Correções completas: **0**; não abrir correção.
- Fazer, ambos os itens de Não alterar, ambos os Entregáveis e Critério de conclusão atendidos: módulo/identidades/procedimento entregues; aquisição exclusiva antes de lançar; liberação após prova do Driver; disputa com múltiplos Node e crash/lock incerto exercitados. **67/67 testes e repetição focal T08 2/2**, sem falhas/skips, no Windows nativo.
- Aprovação limitada ao snapshot/fontes do cabeçalho, filesystem Windows local confiável e escopo dos processos controlados pelo workflow. Não comprova reboot físico, sandbox, proteção entre raízes/contas diferentes, Runner pronto ou workflow automatizado.
- Manter `aguardando revisão`, acrescentando às Observações o vínculo desta R1 e **“revisão aprovada; aguardando autorização dos commits”** pelo script oficial, preservando notas e timestamp da última transição.
- Sem staging, commit, merge, push, troca de branch ou alteração do código da task pelo revisor. Pedido recebido autoriza revisão, **não os dois commits**. Task ainda não oficialmente concluída; M01-T04 não liberada. Aguardar autorização explícita do commit funcional e do commit exclusivo de metadados.

### Autorização posterior dos commits

Após o pedido explícito de autorização dos dois commits (funcional e metadados), o usuário respondeu “autorizo”. Autorização restrita a esses dois commits na branch atual; não inclui merge, push, troca de branch ou início da próxima task.

Antes de staging, `--check-input` confirmou novamente a entrada/snapshot originais, HEAD e hashes das fontes. Relatório, revisão e registro relidos; inventário, branch e whitespace reconferidos. Nenhuma alteração técnica ou de requisitos após a aprovação. Esta anotação é documental posterior; a avaliação independente permanece intacta. O registro ficará fora do commit funcional.

Após staging explícito dos 12 arquivos, a entrada passou a `9193bb3443269c19a3bb7c9e7c6b1d2713343cab929ebfc449e40087d03ef0ae`, snapshot `e11bb6bb6d209e9f63813a72f9e7a1212a08a19d194965aa141a9595004a7baf`. Reconciliação: adições antes untracked passaram ao index e hunks rastreados passaram de unstaged a staged; HEAD, configuração e hashes integrais das fontes permaneceram iguais. Cada blob staged foi comparado ao worktree auditado com normalização LF/CRLF; lista exata e todos os diffs staged conferidos. Nenhuma mudança técnica/de requisito.

O `git diff --cached --check`, que inclui agora o relatório antes untracked, sinalizou apenas quatro finais de linha com dois espaços nas linhas 3–6 desse Markdown: quebras de linha explícitas intencionais, preservadas como formatação, não erro funcional. A verificação anterior sem staged não abrangia esse arquivo novo. Nenhum outro problema de whitespace identificado.
