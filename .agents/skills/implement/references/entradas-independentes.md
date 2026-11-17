# Entradas da avaliação independente

Aplica-se ao revisor e ao implementador quando a própria task exige avaliação independente. Execute o preparador **antes** de diffs, buscas ou leituras de documentos mistos, não depois de ler o plano inteiro para descobrir seus limites. O mapa do projeto informa os caminhos e a configuração; não adivinhe seleções nem contorne erro de preparação.

## Preparar e conferir atualidade

```bash
python <skill>/scripts/review_inputs.py <registro.md> <ID> --sources <fontes.json>
```

O JSON contém `task_input` completo (incluindo subseções/protocolo), `common_input`, `normative_input`, metadados das tasks/revisões, inventário e diffs filtrados. `git_revision` identifica HEAD; `config.sha256` e cada `source_manifest[].sha256` identificam os **bytes integrais** da configuração e das fontes no worktree, inclusive trechos adiados. O conteúdo selecionado normaliza CRLF para LF, mas o hash não normaliza os bytes. Fontes não precisam coincidir com HEAD: mudanças pendentes são identificadas pelos hashes, não presumidas commitadas.

Persista a saída fora do repositório (arquivo temporário próprio); não a versione como evidência integral, pois duplica documentos e pode conter conteúdo que mude de classificação. Se exceder o limite da ferramenta, extraia localmente os campos de conteúdo do JSON para arquivos temporários e leia-os em partes; não omita fontes nem abra os originais mistos como alternativa ao truncamento. Não redirecione sobre o mesmo arquivo usado em `--check-input`.

```bash
python <skill>/scripts/review_inputs.py <registro.md> <ID> --sources <fontes.json> --check-input <entrada-anterior.json>
```

O comando sempre lê novamente as fontes. Em caso de identidade diferente, termina com erro e sem JSON: não reutilize a entrada antiga. Prepare outra entrada, confira as mudanças e refaça a parte afetada da avaliação antes de emitir decisão. Registre `input_id`, `git_revision`, hashes/configuração e `snapshot` na avaliação inicial. O `input_id` inclui também os metadados do registro, sem suas Observações; o `snapshot` cobre a entrega filtrada e as fontes/configuração. `source_diff_hashes` identifica mudanças HEAD/staged/unstaged dessas fontes sem emitir seus hunks narrativos; modificar só o index também invalida a entrada. Fontes/HEAD alterados durante a preparação também geram erro. Não há cache nem promessa de imutabilidade após o comando: reconfira a atualidade antes de persistir a avaliação e antes dos commits autorizados.

Sem `--sources`, mantém-se o modo legado de metadados/diffs: ele **não seleciona** plano, estratégia ou guias mistos. Não usar esse modo como substituto da configuração exigida por uma task. Para tasks ainda sem configuração, peça um recorte explícito e verificável antes de carregar documentos mistos; não descubra seus limites por leitura antecipada. Não acrescentar uma task à configuração durante sua avaliação sem escopo autorizado. Na própria task de preparação da ferramenta, siga o procedimento existente e o recorte explicitamente aprovado no baseline, sem exigir circularmente que a capacidade futura já esteja entregue. No Recolhe, a T41 tem essa exceção de bootstrap no bloco “Controle de execução e baseline — M01-T33–T40” do plano: o preparador legado fornece seus metadados/diffs; a task e as restrições comuns têm os títulos publicados no plano, sem necessidade de ler o histórico inteiro.

## Contrato da configuração do projeto

JSON UTF-8, `version: 1`, objeto `tasks` indexado por ID. Cada task tem:

- `task`: `{ "path": "plano.md", "selector": { "heading": "## ID — Título" } }`;
- `common`: lista não vazia de seleções no mesmo formato;
- `sources`: lista não vazia de `{ "path": "...", "sections": [...] }`.

Cada seção tem `selector` e `phase` (`initial` ou `deferred`). Seletores:

- `{ "heading": "## Título exato" }`: título Markdown ATX único e sua árvore, até o próximo título de nível igual/maior. Títulos em fences de crases ou tils são ignorados. Não usar títulos repetidos como `### Fazer` isoladamente;
- `{ "start": "marcador único", "end_before": "outro marcador único" }`: intervalo literal que inclui o início e exclui o fim. `null` representa início/fim do arquivo. Permite separar narrativa intercalada em parágrafos sem copiar conclusões para os próprios seletores. Títulos completos também podem ser marcadores.

As seções de cada fonte devem formar uma partição completa, sem lacunas, duplicações ou sobreposições. Isso obriga a classificar conteúdo adiado, não a apagá-lo. Para uma fonte inteiramente normativa, a seleção integral deve ser explícita (`start: null`, `end_before: null`, `phase: initial`). Task e restrições devem estar integralmente em intervalos permitidos. Caminhos são relativos à raiz Git; arquivos ausentes, aliases simbólicos, fontes reservadas a registro/relatos e seleções inválidas interrompem a preparação. Não há fallback de documento inteiro.

A validação estrutural **não prova** que um trecho é normativo. Revise a configuração contra as fontes ao prepará-la e na revisão da sua entrega. Alterações em fontes podem exigir reclassificação, mesmo quando os marcadores continuam únicos. O Python não contém caminhos ou regras específicos de um projeto/task.

## Informações permitidas e incidentes

- IDs, estados, hashes, caminhos, referências, runtime selecionado e decisões vigentes são permitidos; não comprovam funcionamento. Um link para relatório não equivale à leitura do seu conteúdo.
- Testes, logs e resultados produzidos pelo próprio avaliador nesta execução são permitidos.
- Relatórios, achados e conclusões técnicas de execuções anteriores, inclusive resumos/evidências em documentos mistos, ficam para depois da avaliação inicial persistida.
- Exposição antecipada **efetiva** a essas conclusões exige registrar o incidente, preservar o trabalho e interromper a fase independente. Retomar em conversa nova pela entrada corrigida, sem gastar outra rodada nem zerar a task. No revisor, preservar o rascunho incompleto e retomar por append conforme seu papel; no implementador-avaliador, preservar igualmente a avaliação/evidências e registrar a interrupção no relatório/Observações, sem declarar parecer independente concluído.

O contexto operacional automático, inclusive `AGENTS.md`, não precisa fingir inexistência: referências/decisões vigentes não invalidam a avaliação. Isso não dispensa tratar uma exposição efetiva a conclusões anteriores. O preparador organiza entradas; **não é barreira de segurança nem isolamento absoluto do harness**. Outras ferramentas continuam capazes de abrir os arquivos.

## Consulta posterior obrigatória — sem esconder mudanças

Depois de persistir a avaliação inicial, consulte `deferred_sections` (caminhos/seletores) e confronte os conteúdos integrais correspondentes. Consulte também relatório, revisões, evidências anteriores pertinentes e Observações. Examine **todos** os arquivos de `inventory`, inclusive `deferred_changed`: os caminhos configurados têm seus diffs integrais adiados (até hunks removidos podem conter narrativas), não eliminados da revisão final. Arquivos novos dessas fontes também saem de `untracked_allowed`, mas permanecem no inventário e na lista adiada.

Na fase de confronto, use `read` para conteúdos e, com caminhos explícitos, `git diff HEAD -- <caminhos>`, `git diff --cached -- <caminhos>` e `git diff -- <caminhos>` para os diffs adiados. Inclua configuração, fontes, registro e relatos no exame apropriado; não use a ausência de diff inicial como evidência de ausência de mudanças. O preparador não altera arquivos/index e não fornece um atalho de aprovação. A revisão final e seu pacote de commits continuam sujeitos às regras completas do papel de revisor.
