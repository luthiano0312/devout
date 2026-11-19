# Revisão M02-T02 — rodada 1
Estado: finalizada
Snapshot da entrega: ec1b59e3dac3991f7b0df555c68a8e985573b681e670b1bb98971ce5a0d966bf
Entrada: 283453f4e019a729f57e0282c41d4eff289085baa4e5095ca03495c307cc594c; revisão Git: 455c2b4e45cc40351a46b76bb06c51ae3a7218bd

Configuração/fontes (SHA-256 dos bytes integrais):

| Caminho | SHA-256 |
| --- | --- |
| docs_devout/03-execucao/fontes-revisao.json | 3cb3238bc7b7b330258047c1e2dea4d70883c65de789f75dc3320c28d31df6b6 |
| docs_devout/plano.md | bc8c1f8f2fc7f8121531fe64295bf4d7ed9d756649e2738028f83305b5dff20f |
| AGENTS.md | ea56d7225bcb787119a3b9c0af8b099c04d6caf180459621d57500ad70e102ad |
| docs_devout/02-design/contrato-orquestracao-mvp.md | 4cf19380d07012be6f67d144acb74ae3e0393e16727c3501083f8f3aa8dbdbd2 |
| docs_devout/02-design/arquitetura-hld.md | 194a7c6db6ec51b94b671044442e282ab98d69079f6f0fcee2143bbf09756988 |
| docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md | 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6 |
| docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md | 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8 |
| docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md | 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018 |
| src/package.json | c46153c746612511ef0d09ad6cbcb2e8dfd2ff4f967f5db07c8edba4a7f97ef2 |
| src/TASK-INPUT.md | 20b5c13b8daaf8e35824eb805ab63093138aafea3078ba684b85dfdb74514589 |
| src/ENGINEERING.md | 90d7a40623822259cbc46b7b7afa13563feb7cbba6630f17e0924047e8145db6 |
| src/README.md | 10dc2edd3d03188e25c6f1fb99d57b63c2cb945317590076c1a4c3725ba22452 |
| src/ROLE-RUNNER.md | f2bfbe7773a61f22d269dcb5adb62e21c1073ce1af62abe30589c0376fc91b7a |
| src/PI-LOCK.md | 527f93092dcec93306b9200ab800658a488ea1159adbe3a4141b83cc0579560d |
| src/OPENCLAW.md | 909705dfa67b3a0d8e9e618e6b1a26914407289c1ac485756c1126e4f3fdd7b0 |
| docs_devout/03-execucao/planos/marco-M01.md | 2557b0698e0eac38f11ee1326f80ec843434844c76e4e56fa1b495879921c5d1 |

## Avaliação independente

### Entrada, gates e abrangência

- Preparador executado antes de plano integral, relatos, Observações e diffs não filtrados. JSON persistido fora do repositório em `C:/Users/User/AppData/Local/Temp/devout-M02-T02-review-input.json`; `--check-input` confirmou a identidade antes desta persistência.
- Estado recebido: `aguardando revisão`; sem revisões anteriores; esta é R1. Plano aprovado, quatro campos presentes e nenhuma dependência obrigatória de M02-T02. Não se impôs gate adicional de M02-T01.
- Branch `feat/m02-t02`, coerente com a task e sem troca de branch. Plano, registro, mapa e seleção rastreados em HEAD; mapa/plano/seleção sem mudanças pendentes. Baseline da preparação: `455c2b4e45cc40351a46b76bb06c51ae3a7218bd`. Ancestralidade dos dois commits de M02-T01 também confirmada, sem ler suas narrativas.
- Examinados integralmente `src/task-input.mjs`, `src/test/task-input.test.mjs` e `src/test/helpers/task-fixture.mjs`, incluindo os três arquivos novos permitidos pelo preparador. Diffs filtrados HEAD/staged/unstaged vazios: a implementação está em arquivos novos, não omitidos da revisão.
- Examinado contexto de `src/engineering-workspace.mjs` e `src/test/helpers/engineering-fixture.mjs`. Conteúdos narrativos e documentação do resultado continuam adiados para o confronto.

### Validações próprias

- `npm.cmd --prefix src test`: primeira tentativa atingiu timeout de 240 s; repetição com prazo de 600 s terminou com **282 testes, 282 aprovados, zero falhas e zero skips**, duração reportada de 278322,8524 ms, em Windows nativo. Saída própria fora do repositório: `C:/Users/User/AppData/Local/Temp/devout-M02-T02-review-tests-2.txt`.
- A suíte cobre os casos exigidos de task válida/inválida, dependências, baseline/branch divergentes, Git alterado, caminhos externos e artefatos ausentes; compara bytes do workspace, HEAD e branch antes/depois das inspeções. Inclui credenciais/remotes, junction, flags do index e mutações concorrentes simuladas.
- Prova adicional própria, somente em fixture descartável: capturar entrada válida; criar um commit filho do baseline com `git commit-tree` e publicá-lo em `refs/heads/unapproved`, mantendo HEAD, branch corrente, index e worktree; chamar `revalidateTaskInput` com o inputId anterior. Resultado: **accepted=true, reason=null, mesmo inputId e mesmo snapshotId**, apesar da nova ref/commit não aprovados. Saída: `C:/Users/User/AppData/Local/Temp/devout-M02-T02-review-probes.txt`. Fixture removida ao final; nenhum commit no Devout.
- Não foram executados smokes com Pi/provedor real: não são necessários para um validador somente de leitura, e esta revisão não cria processos Pi do workflow.

### Checklist dos requisitos

- **Fazer — seleção e aprovação:** há aprovação externa ao prompt, vinculada a taskHash, workspace, baseline, branch e área permitida; seleção de uma task com os quatro campos; mapas e tabela de seis colunas; estado inicial estrito e evidências de dependências. A implementação admite somente `não iniciada`, sem fingir retomada operacional.
- **Fazer — integridade Git e snapshot:** verifica HEAD/branch, índice, conteúdo bruto rastreado, configuração, remotes, links e área permitida, com segunda inspeção. **Não atende integralmente à detecção de Git alterado/commits indevidos: refs e commits fora de HEAD ficam invisíveis ao snapshot (R1-I01).**
- **Fazer — separação de informações:** `input` contém a task selecionada, hashes, IDs e política, não o registro/mapa integral ou Observações. Erros públicos são códigos sanitizados, sem stderr/caminhos/segredos.
- **Fazer — resultado estruturado:** módulo consumível pelo controlador, recusa com `input:null`, nenhuma dependência do Pi Driver e nenhuma gravação/transição/commit no validador.
- **Não alterar 1:** respeitado: taskId/prompt/modelo não bastam; objeto de aprovação é exigido por canal confiável e taskApproved permanece false, separado da admissão técnica.
- **Não alterar 2:** respeitado: não cria um plano por task e não escreve no registro da fixture. Código novo não escreve arquivos; os commits das fixtures são preparação dos testes, não operações do validador.
- **Entregável 1:** validador presente; contrato documental `src/TASK-INPUT.md` existe no inventário e será examinado apenas na fase 2, conforme filtro obrigatório.
- **Entregável 2:** testes presentes e reexecutados, mas falta regressão para a modificação de refs/commits sem mover HEAD.
- **Critério de conclusão:** entrada válida identificável e distinção entre estado oficial e resultado técnico estão demonstradas; recusa antes do Pi e sem gravações é consistente com o código/suíte. A correspondência com Git/snapshot ainda tem a lacuna reproduzida abaixo.
- **Escopo:** novos código/testes em `src/`; nenhuma mudança examinada em `.agents/`, `prototipo/`, contrato/HLD/ADRs, runtime ou skills. Registro e relatório da task seguem o ciclo manual e ficam para confronto; não são atualizações automáticas da fixture.

### Achados preliminares

**R1-I01 — importante: snapshot e revalidação ignoram novas refs/commits não aprovados fora de HEAD.**

- Local: `src/task-input.mjs:142–162` (`trackedSnapshot`), `:258` (snapshotId) e `:274–284` (revalidação). O snapshot inclui somente indexHash, configHash e arquivos rastreados; a admissão reutilizada verifica o HEAD e a branch corrente, não o conjunto de refs.
- Evidência: após capturar uma entrada válida, executar na fixture `git -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit-tree <HEAD^{tree}> -p <baseline> -m "Unapproved side commit"` e `git update-ref refs/heads/unapproved <novo-commit>`. HEAD permanece no baseline e `git status --porcelain` fica vazio. A revalidação aceita o mesmo inputId/snapshotId; a própria execução produziu novo commit `e93068d14f1045b0f82b1c45657dec4cbe9b6eb8` referenciado pela branch adicional.
- Requisito violado: Fazer exige integridade do Git, ausência de commits indevidos e detecção de alterações concorrentes/correspondência com snapshot inicial; os testes exigem bloqueio de Git alterado. Não é hipótese de sandbox forte: são alterações objetivas no repositório local que o gate pode inspecionar.
- Correção recomendada: capturar e vincular ao snapshot o estado relevante completo de refs (incluindo resolução simbólica/HEAD), rechecá-lo na inspeção final e na revalidação; recusar alterações de refs/novos commits não autorizados frente à referência aprovada. Acrescentar regressões para criação/movimentação/remoção de branches/tags sem mudança de HEAD e para commit lateral. Se houver refs preexistentes permitidas, sua política deve ser explícita e vinculada à aprovação, não presumida pela estabilidade de HEAD. Não basta documentar o bypass como limite do sandbox.

**Conclusão preliminar:** não aprovar enquanto R1-I01 permanecer. Documentação e relatos ainda não examinados; decisão final pendente do confronto, sem reescrever esta avaliação.

## Confronto com relatos

- Avaliação acima persistida antes desta fase e preservada integralmente. Relatório inicial examinado; não há revisões anteriores nem seções de correção de M02-T02. **Zero correções completas.**
- A reprodução própria confirma os 282 testes aprovados e a arquitetura descrita pelo implementador. O teste chamado `new unapproved commit` move HEAD; não cobre commits laterais/novas refs com HEAD estável. O hash recursivo que os testes calculam sobre `.git` comprova que o validador não escreveu, mas não significa que seu snapshot operacional capture mudanças anteriores em `.git/refs`.
- `src/TASK-INPUT.md` foi lido integralmente. Esquema, códigos, fronteira do objeto approval, seleção, normalização de hash, estado inicial e separação input/official/snapshot correspondem ao código. O documento descreve exatamente o snapshot limitado a arquivos/index/config; portanto confirma a causa de R1-I01, não sua resolução. A janela pontual sem trava hostil é um limite legítimo e diferente deste defeito: o commit/ref já existia durante toda a segunda chamada, que mesmo assim aceitou a entrada anterior.
- Os limites declarados (fixture estreita, dados fictícios, sem scanner universal de segredos, sem inferência semântica de Não alterar, sem retomada e sem Pi real nesta task) são compatíveis com o recorte. Não se exige sandbox, transição oficial automatizada, lease neste módulo, ou execução das tasks seguintes.
- Examinados todos os conteúdos de `deferred_sections`: restante do plano, diagnóstico de AGENTS, seções 5/8/9/12/13 do contrato, narrativa final do HLD, contextos dos três ADRs, `src/TASK-INPUT.md`, `src/ENGINEERING.md`, `src/README.md`, `src/ROLE-RUNNER.md`, `src/PI-LOCK.md`, `src/OPENCLAW.md` e plano M01 arquivado. Nenhum desses conteúdos autoriza ignorar commits/refs alterados; o contrato, seção 9, exige reconciliação de commit descoberto, não continuação silenciosa.
- Configuração de fontes examinada integralmente, inclusive seleções históricas preservadas (sem executá-las). A seleção M02-T02 forneceu a task e os limites e adiou as narrativas conforme o mapa. O commit documental `455c2b4e45cc40351a46b76bb06c51ae3a7218bd` tem somente mapa/plano/seleção, como consta na Observação vigente. HEAD diferente do relatório inicial é explicado por essa preparação posterior; o HEAD histórico do relatório não foi tratado como HEAD atual.
- Todos os caminhos do inventário e de `deferred_changed` foram examinados, incluindo registro e relatório. Consultados, com caminhos explícitos, os diffs HEAD/staged/unstaged de configuração, fontes, narrativas e registro, incluindo remoções: apenas a linha M02-T02 tem diff de conteúdo pendente entre arquivos rastreados; os arquivos novos foram lidos integralmente, não confundidos com ausência de diff. Registro mantém as seis colunas e não altera outras tasks. A Observação preexistente da preparação será preservada na atualização desta revisão.
- `git status` também sinalizou o plano M01 arquivado, mas seus bytes atuais são idênticos tanto a HEAD quanto ao SHA-256 inicial `2557b0698e0eac38f11ee1326f80ec843434844c76e4e56fa1b495879921c5d1`; diffs numstat/raw/conteúdo vazios, com aviso de conversão LF/CRLF. Não houve edição/normalização/reset desse arquivo nem atribuição dessa indicação à task.
- `git diff --check` sem erros. Nova execução do preparador com `--check-input` antes do parecer confirmou o mesmo input_id, fontes, revisão Git e snapshot. A criação do arquivo narrativo desta revisão não altera a entrega filtrada.

## Decisão final

**Resultado: alterações necessárias; não aprovada para commits.**

Contagem: **0 bloqueadores, 1 importante (R1-I01), 0 melhorias opcionais; 0 correções completas**. Os **282/282 testes** passam, mas a prova adicional abaixo demonstra caso inválido ainda aceito. A avaliação independente permanece inalterada após o confronto.

### R1-I01 — importante — alteração de refs/commit lateral não invalida entrada aprovada

- **Arquivos/locais:** `src/task-input.mjs:142–162` (`trackedSnapshot` não captura refs), `:258` (snapshotId derivado desse estado parcial), `:274–284` (revalidação por inputId); regressão ausente em `src/test/task-input.test.mjs`. Contrato do snapshot em `src/TASK-INPUT.md`, seção Área de mudanças e snapshot.
- **Defeito/impacto:** uma entrada capturada para um Git limpo continua válida com o mesmo inputId/snapshotId depois de um commit novo ser publicado em outra branch. HEAD, branch corrente, index/config e arquivos não mudam, logo os checks atuais não percebem a alteração. O controlador pode despachar usando a entrada antiga apesar de commits/refs concorrentes não aprovados. A aprovação inicial também não contém uma política/identidade do conjunto de refs que permita distingui-los de refs previamente autorizadas.
- **Requisito violado:** M02-T02/Fazer exige integridade do workspace Git, ausência de commits indevidos e correspondência entre solicitação, snapshot e estado inspecionado; exige detectar alterações concorrentes. Não é pedido de isolamento forte ou interceptação de ações do modelo, mas de recusa determinística de estado Git já alterado antes da revalidação.
- **Reprodução executável**, a partir da raiz, com Git apenas em fixture temporária (nenhum Pi):

  ```js
  // Executar com node --input-type=module (stdin).
  import { prepareTaskFixture } from './src/test/helpers/task-fixture.mjs';
  import { validateTaskInput, revalidateTaskInput } from './src/task-input.mjs';
  const cleanups = [];
  try {
    const f = prepareTaskFixture({ after: fn => cleanups.push(fn) });
    const before = validateTaskInput(f.request, f.approval);
    const tree = f.git(['rev-parse', 'HEAD^{tree}']);
    const commit = f.git(['-c', 'user.name=Fixture', '-c',
      'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false',
      'commit-tree', tree, '-p', f.request.baseline, '-m', 'Unapproved side commit']);
    f.git(['update-ref', 'refs/heads/unapproved', commit]);
    const after = revalidateTaskInput(f.request, f.approval, before.input.inputId);
    console.log({ accepted: after.accepted,
      sameInput: after.input?.inputId === before.input.inputId,
      sameSnapshot: after.input?.snapshotId === before.input.snapshotId,
      headUnchanged: f.git(['rev-parse', 'HEAD']) === f.request.baseline,
      refs: f.git(['show-ref']), status: f.git(['status', '--porcelain']) });
  } finally { for (const cleanup of cleanups) cleanup(); }
  ```

  **Observado:** accepted/sameInput/sameSnapshot/headUnchanged = true; duas refs (fixture e unapproved); status vazio. **Esperado:** recusa da entrada anterior por alteração Git não aprovada, sem rollback nem gravação pelo validador.

- **Correção requerida:** vincular estado semântico relevante de refs/HEAD a uma referência/política confiável aprovada, inspecioná-lo novamente no fechamento do gate e invalidar a entrada em revalidações divergentes. Tratar explicitamente refs preexistentes permitidas versus novas/movidas/removidas não autorizadas; apenas capturar refs novas na segunda chamada sem compará-las à aprovação/entrada original não resolve. Cobrir criação, movimentação e remoção de branches/tags sem mover HEAD e o commit lateral reproduzido; atualizar o contrato documentado e preservar o caráter somente de leitura. Não é necessário hashear cada byte de metadados transitórios do Git nem alegar prevenção universal de escritores hostis.

**Encaminhamento:** mudar somente a linha M02-T02 para `em correção` pelo atualizador oficial, preservando sua Observação anterior e vinculando este arquivo. Corretor em conversa nova deve tratar R1-I01, acrescentar a primeira correção ao relatório existente e devolver para reauditoria R2 independente em conversa nova. Nenhuma alteração no código nesta revisão, nenhum commit autorizado/executado e nenhuma próxima task iniciada.
