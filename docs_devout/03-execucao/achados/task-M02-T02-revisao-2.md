# Revisão M02-T02 — rodada 2
Estado: finalizada
Snapshot da entrega: fdbdf8b9ed476953c1eca70e5aeb3fa6b7bf0648831ea1386cf05af7054608d2
Entrada: 0597adb1d68c8934e79b9c00744fa8ef37be565c239e0a9ffee94d2bdbe51fd0; revisão Git: 455c2b4e45cc40351a46b76bb06c51ae3a7218bd
Configuração: docs_devout/03-execucao/fontes-revisao.json; SHA-256: 3cb3238bc7b7b330258047c1e2dea4d70883c65de789f75dc3320c28d31df6b6

## Avaliação independente

Persistida antes da consulta ao relatório, à revisão R1 e aos conteúdos/diffs adiados. O preparador informa R1 finalizada, sem lacunas; esta é a rodada R2. Histórico de correções e contrato documental ainda dependem do confronto.

### Entrada e gates

- Entrada preparada por `review_inputs.py ... M02-T02 --sources docs_devout/03-execucao/fontes-revisao.json`, persistida fora do repositório, em diretório temporário próprio.
- Task completa contém Fazer, Não alterar, Entregáveis e Critério de conclusão; estado `aguardando revisão`; nenhuma dependência obrigatória da M02-T02.
- Branch `feat/m02-t02`. Plano, mapa, registro e seleção estão rastreados; baseline no histórico (plano/registro M02 em `9014b8b`, seleção M02-T02 em HEAD `455c2b4`). Plano/mapa/seleção sem alterações de conteúdo pendentes. Registro intermediário pendente é esperado.
- `--check-input` repetido após os testes: sucesso, JSON idêntico à entrada inicial. Um marcador de status Git para o plano M01 arquivado não produziu diff bruto; os bytes/hashes e inventário do preparador permaneceram iguais. Nenhum conteúdo adiado foi aberto nesta fase.

### Inspeção e testes próprios

Examinados integralmente `src/task-input.mjs`, `src/test/helpers/task-fixture.mjs` e `src/test/task-input.test.mjs`, incluindo os arquivos novos não rastreados; contexto de `src/engineering-workspace.mjs` e fontes normativas selecionadas. Diffs filtrados HEAD/staged/unstaged vazios: implementação nova está não rastreada, e não ausente.

- Aprovação separada e fornecida pelo controlador confiável; esquema fechado da solicitação; correspondência de workspace, ID, branch, baseline, hash da task e refs aprovadas.
- Seleção de uma task no plano aprovado; cabeçalhos/tabelas dentro de fences ignorados; quatro campos únicos e preenchidos; mapa coerente e registro de seis colunas com estados/timestamps validados.
- Admissão inicial somente de `não iniciada`, sem inferir retomada. Dependências precisam estar concluídas e ter evidência versionada por dois commits ou vínculo integrado verificável.
- Workspace descartável, Git local sem remotes/credenciais/configuração executável; conteúdo/index limpos; diretórios externos, links, aliases Windows, operações Git pendentes e áreas protegidas recusados.
- Hash das refs inclui HEAD simbólico, objeto atual, destinos simbólicos e objetos de branches/tags. Snapshots repetidos e conferência final detectam mudanças concorrentes cobertas; nova aprovação/área de alteração produz nova identidade. Revalidação exige o inputId original.
- Saída pública contém somente a task selecionada, IDs/hashes, dependências e política/área aprovada; Observações, narrativas dos mapas/registros e outras tasks não são encaminhadas. Recusas expõem somente códigos. Status oficial vem separado; `taskApproved` permanece falso.
- Validador não grava arquivos, não muda registro/branch, não faz commits e não importa/inicia Pi. Testes verificam a preservação dos bytes, inclusive index/config/refs, e preservam as alterações dos escritores concorrentes simulados.
- `npm.cmd --prefix src test`: primeira tentativa interrompida pelo limite de 240 segundos da ferramenta, sem resultado conclusivo. Reexecutada integralmente com limite ampliado: **297 testes passaram, 0 falhas, 0 cancelados, 0 ignorados**, duração 443485 ms. Nenhum smoke/Pi real iniciado.

### Checklist contra a task

- **Não alterar — taskId/prompt/modelo não equivalem a aprovação:** respeitado; aprovação externa estruturada, plano versionado aprovado e taskHash são exigidos.
- **Não alterar — não migrar plan para arquivo por task:** respeitado; uma seleção é extraída do plano único mapeado.
- **Não alterar — não editar registro da fixture:** respeitado; validador somente lê, com testes de preservação inclusive nas recusas.
- **Entregável — validador:** presente e examinável. Contrato documentado em `src/TASK-INPUT.md` consta no inventário, mas seu exame é deliberadamente reservado à fase 2.
- **Entregável — testes:** cobrem entrada válida/inválida, dependências, baseline/branch, Git alterado, caminhos externos, ausência de artefatos, privacidade, refs e concorrência.
- **Critério:** evidência própria favorável à entrada identificável/revalidável, bloqueio sem Pi/escritas e separação entre resultado técnico e estado oficial. Integração com controlador/papéis futuros não é alegada nem exigida nesta task.
- Não foram encontrados bloqueadores ou importantes no código/testes. Sem alteração de skills, protótipos, arquitetura, Runner ou Driver no inventário de conteúdo.

### Manifesto de hashes SHA-256 das fontes integrais

| Fonte | SHA-256 |
| --- | --- |
| docs_devout/plano.md | bc8c1f8f2fc7f8121531fe64295bf4d7ed9d756649e2738028f83305b5dff20f |
| AGENTS.md | ea56d7225bcb787119a3b9c0af8b099c04d6caf180459621d57500ad70e102ad |
| docs_devout/02-design/contrato-orquestracao-mvp.md | 4cf19380d07012be6f67d144acb74ae3e0393e16727c3501083f8f3aa8dbdbd2 |
| docs_devout/02-design/arquitetura-hld.md | 194a7c6db6ec51b94b671044442e282ab98d69079f6f0fcee2143bbf09756988 |
| docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md | 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6 |
| docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md | 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8 |
| docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md | 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018 |
| src/package.json | c46153c746612511ef0d09ad6cbcb2e8dfd2ff4f967f5db07c8edba4a7f97ef2 |
| src/TASK-INPUT.md | 22bd52240d2355fb1898a97343ae42f47bc966066b072a32119f08a2679966d5 |
| src/ENGINEERING.md | 90d7a40623822259cbc46b7b7afa13563feb7cbba6630f17e0924047e8145db6 |
| src/README.md | 10dc2edd3d03188e25c6f1fb99d57b63c2cb945317590076c1a4c3725ba22452 |
| src/ROLE-RUNNER.md | f2bfbe7773a61f22d269dcb5adb62e21c1073ce1af62abe30589c0376fc91b7a |
| src/PI-LOCK.md | 527f93092dcec93306b9200ab800658a488ea1159adbe3a4141b83cc0579560d |
| src/OPENCLAW.md | 909705dfa67b3a0d8e9e618e6b1a26914407289c1ac485756c1126e4f3fdd7b0 |
| docs_devout/03-execucao/planos/marco-M01.md | 2557b0698e0eac38f11ee1326f80ec843434844c76e4e56fa1b495879921c5d1 |

Conclusão preliminar: código/testes aptos tecnicamente; parecer ainda incompleto até conferir documentação, relatos, correções e todos os trechos/diffs adiados. Limite mantido: mitigação em fixture fictícia, não sandbox nem capacidade de lançamento/commit.

## Confronto com relatos

- Avaliação independente acima preservada integralmente. Relatório inicial e sua seção `Correção após revisão 1`, R1 finalizada e Observações vigentes conferidos somente após a persistência inicial. Histórico consistente: **uma correção completa**, seguida desta reauditoria R2; sem lacuna, reset ou quarta correção.
- **R1-I01 resolvido:** `src/task-input.mjs:143–149` captura HEAD simbólico direto, objeto de HEAD e listagem ordenada de refs com objetos/destinos simbólicos. `:185–190` exige refsHash na aprovação externa; `:209` recusa divergência inicial; `:265–268` repete snapshot e consulta refs após a admissão final. SnapshotId/inputId incluem essa identidade. A referência confiável não é recalculada para acomodar alterações.
- Reexecutada separadamente a reprodução executável da Decisão final R1, em fixture temporária própria: entrada inicial aceita; `commit-tree` + `update-ref refs/heads/unapproved` sem mover HEAD e com status vazio; revalidação agora retorna **accepted=false, reason=GIT_REFS_MISMATCH, input=null**. HEAD e árvore permanecem intactos. Fixture removida pelo harness, sem commit no Devout nem Pi.
- A suíte própria de 297 testes confirma a contagem relatada após a correção (117 do validador e 180 existentes), inclusive criação/movimentação/remoção de branches e tags, aprovação explícita de refs preexistentes, tags anotadas, destinos simbólicos, compactação sem mudança semântica, invalidação após reaprovação e concorrência durante a captura/fechamento. O relato inicial de 282 testes permanece histórico, não foi tomado como resultado atual.
- Contrato `src/TASK-INPUT.md` lido integralmente e comparado com a API: campos exatos, preparo confiável, fórmula de refsHash, política de igualdade, códigos de recusa, seleção, normalização, dependências e separação input/official/snapshot correspondem ao código. A documentação não transforma hash/accepted em aprovação humana ou autorização de lançamento/commits.
- Todos os conteúdos de `deferred_sections` foram examinados: demais tasks do plano, diagnóstico de AGENTS, seções adiadas do contrato/HLD e contextos dos três ADRs, TASK-INPUT/ENGINEERING/README/ROLE-RUNNER/PI-LOCK/OPENCLAW e plano M01 arquivado. As fronteiras com M02-T03 e seguintes permanecem preservadas; não se exige nesta task o lançamento de papéis, transição oficial, lease própria ou prova real com provedor.
- Configuração de fontes examinada integralmente, incluindo seleções históricas preservadas, sem executar entradas M01/T01 encerradas. Conteúdo atual, inventário e todos os diffs HEAD/staged/unstaged dos caminhos adiados foram conferidos com caminhos explícitos: somente a linha M02-T02 possui diff rastreado de conteúdo; nenhum staged. Fontes novas e relatos foram examinados integralmente, não confundidos com diffs vazios de arquivos não rastreados. O arquivo desta R2 é o único arquivo novo produzido pela revisão.
- Indicação preexistente de alteração do plano M01 arquivado preservada: hash integral estável, diff de conteúdo/bruto vazio e aviso LF/CRLF. Nenhuma normalização, restauração ou modificação desse documento foi feita.
- `--check-input` repetido antes do parecer final confirmou a entrada original e o mesmo snapshot; HEAD/branch preservados. `git diff --check` sem erros, apenas o aviso preexistente de EOL. Os relatos anteriores permanecem intactos.
- Limites reconhecidos, sem achados novos: fixture fictícia e contrato Markdown estreitos; nenhuma garantia de scanner universal, inferência semântica de proibições ou sandbox. Snapshot pontual de estado semântico relevante, não diário de todas as escritas Git, reflogs/objetos inalcançáveis ou trava contra escritor hostil. Esses limites não reintroduzem o bypass R1: alterações de refs presentes na inspeção agora são vinculadas à aprovação e recusadas. Revalidar após a lease e antes do futuro handoff continua responsabilidade do controlador.

## Decisão final

**Resultado: aprovação técnica da M02-T02 após a primeira correção.**

- **0 bloqueadores, 0 importantes e 0 melhorias opcionais novos.**
- **R1-I01 resolvido**, com inspeção própria, 15 regressões adicionais na suíte e reprodução independente do caso original agora recusado por GIT_REFS_MISMATCH.
- **Uma correção completa; R2 finalizada.** A avaliação independente foi preservada, sem alteração após leitura dos relatos.
- **297/297 testes passaram no Windows**, sem falhas/cancelamentos/skips. Validador e contrato documentado atendem aos Entregáveis; itens de Não alterar respeitados e Critério de conclusão satisfeito no recorte de pré-validação somente de leitura.

**Encaminhamento:** manter `aguardando revisão`, preservar todas as Observações e acrescentar `revisão aprovada; aguardando autorização dos commits`, vinculando esta R2 pelo atualizador oficial. O pedido foi somente de revisão: **nenhum commit autorizado ou realizado**. M02-T02 não está oficialmente concluída e M02-T03 não está liberada; conclusão depende de autorização explícita para o commit funcional e o commit exclusivo de metadados, com nova conferência de atualidade antes deles. Nenhum código corrigido nesta conversa, nenhum Pi real iniciado e nenhuma próxima task executada.
