# Pré-validação de uma task — M02-T02

API síncrona e **somente de leitura**, em [`task-input.mjs`](task-input.mjs).
Não despacha Runner/Pi, não adquire lease, não escreve artefatos, não muda branch,
registro ou arquivos e não faz commits. Consultas Git internas usam listas literais,
`shell:false`, timeout, buffers limitados e o ambiente restrito do perfil de engenharia.
Não há comandos ou prompt livres na entrada.

## Autoridade e chamada

```js
import { validateTaskInput, revalidateTaskInput, taskTextHash, taskGitRefsHash } from './task-input.mjs';

// Preparados pelo controlador confiável APÓS revisão/aprovação humana do fixture.
// Não derivar aprovação de um prompt, resposta Pi ou arquivo enviado pelo modelo.
const approval = {
  schemaVersion: 1,
  taskId: 'M02-T02',
  workspace: fictionalWorkspace, // caminho absoluto, descartável, em os.tmpdir()
  baseline: approvedCommit,     // SHA-1 completo, minúsculo
  branch: 'fixture',
  taskHash: taskTextHash(humanApprovedTaskText),
  refsHash: taskGitRefsHash(fictionalWorkspace), // capturar somente após revisar refs/HEAD
  allowedChanges: ['value.mjs', 'test/'],
};
const request = {
  schemaVersion: 1, taskId: approval.taskId, workspace: approval.workspace,
  baseline: approval.baseline, branch: approval.branch,
};
const first = validateTaskInput(request, approval);
if (!first.accepted) {
  // Bloquear: first.reason.code é um enum estável, sem stderr/conteúdo externo.
} else {
  // Persistência, se desejada, é responsabilidade do controlador, fora do repositório.
  // Revalidar imediatamente antes do futuro handoff; só input é entrada pública ao Pi.
  const current = revalidateTaskInput(request, approval, first.input.inputId);
  // current.accepted NÃO inicia Pi, não aprova a task e não substitui o gate da lease.
}
```

Os objetos têm **exatamente** os campos do exemplo. `approval` é um parâmetro separado
que o controlador deve manter fora do controle do modelo. Não existe verificação
criptográfica da identidade humana: copiar ID/texto, calcular um hash automaticamente
sobre dados não revisados ou aceitar `approval` fornecida pelo Pi anula essa fronteira.
O hash fixa os requisitos efetivamente revisados, não cria sua aprovação.

`refsHash` é obrigatório e fixa o conjunto de refs/HEAD revisado pelo controlador.
`taskGitRefsHash(workspace)` é uma consulta somente de leitura para essa preparação
confiável; usa o mesmo ambiente Git restrito e pode lançar erro de inspeção. Seu retorno
não é aprovação por si só. Não recalcular/substituir `approval.refsHash` automaticamente
em cada admissão ou revalidação para acomodar uma mudança detectada.

O gate inicial aceita somente `não iniciada` com `Commit = -`. Estados em execução
exigiriam prova explícita de retomada e reconciliação de processos/lease; esta API não
implementa essa política. Revisão, correção e transições são outras tasks do marco.

## Fixture e mapa

Mantém o plano único por marco e o registro de seis colunas vigentes. Reutiliza toda
a admissão de [`ENGINEERING.md`](ENGINEERING.md): Git local fictício, marcador
versionado, teste `test/fixture.test.mjs`, política `node-test-only-v1`, nenhuma
credencial/remotes/hooks/config arbitrária, links ou alteração inicial.

O mapa está em `AGENTS.md` na raiz; na ausência dele, em `CLAUDE.md`. Se ambos existirem,
ambos devem estar versionados e indicar os mesmos caminhos. Para esta fixture, o recorte
determinístico do mapa usa as linhas Markdown já usadas pelo Devout:

```md
- **Plano ativo:** `docs/plano.md`.
- **Registro oficial de execução:** `docs/registro.md`.
```

Exige uma ocorrência de cada rótulo, caminho relativo sem traversal ou alias Windows,
`plano.md` como nome final e arquivos rastreados. Não adivinha caminhos nem executa
instruções do mapa. Exemplos dentro de fences Markdown não contam como estrutura.

O plano contém:

- Uma linha `**Status:** APROVADO ...` fora de exemplos.
- Tabela `Task | Dependências obrigatórias | Justificativa`, com linha da task;
  `—` significa nenhuma dependência; IDs separados por vírgula significam obrigatórias.
- Cabeçalho `### M02-T02 — Título` único, e os quatro subtítulos `#### Fazer`,
  `#### Não alterar`, `#### Entregáveis`, `#### Critério de conclusão`, únicos e preenchidos.
  A seleção termina no próximo cabeçalho de nível 1–3 fora de fences.

`taskTextHash` é SHA-256 do **bloco completo selecionado**, incluindo o cabeçalho,
normalizado de CRLF para LF, sem whitespace final e com uma única quebra de linha final.
O hash não normaliza espaços internos nem reescreve requisitos. Não é permitido trocar
o conteúdo revisado mantendo somente o mesmo ID. Outros blocos de task não são enviados.

O registro exige `| Task | Marco | Status | Commit | Atualizado em | Observações |`,
nessa ordem, delimitadores externos e seis células por linha, IDs únicos e estados
conhecidos. Espaços, alinhamentos `:` e três ou mais hífens no separador são aceitos.
Datas têm calendário válido e fuso explícito (`Z` ou `±HH:MM`). `Marco` corresponde ao
prefixo do ID. Commits, quando presentes, usam SHA-1 completo. Não se permite `|` nas
Observações. O validador não cria nem corrige linhas.

Dependências devem estar `concluída` no baseline versionado. Sem reescrita, verifica o
commit funcional ancestral e uma versão posterior do registro com conclusão e mesmo
hash (busca limitada às últimas 64 mudanças do registro; ausência bloqueia, sem fallback).
Após reescrita, aceita vínculo `Integração: <SHA-1 completo>` único nas Observações:
o commit integrado deve ser ancestral do baseline e conter a linha concluída com o
hash funcional original. Não exige recuperar objetos individuais reescritos. Isso
verifica vínculo/estado Git; não refaz semanticamente a revisão da dependência.

## Área de mudanças e snapshot

`allowedChanges` é uma lista humana explícita, de 1 a 64 caminhos relativos:

- Arquivo exato: `value.mjs`; diretório/prefixo: `test/` (barra final obrigatória).
- Pode incluir arquivo/diretório futuro, mas não tratar arquivo existente como diretório
  nem atravessar arquivo como se fosse um pai. Duplicatas sem distinção de caixa são rejeitadas.
- Sem globs, caminhos absolutos, `..`, `.`/segmentos vazios, backslashes, streams NTFS,
  dispositivos Windows, metadados Git ou nomes conhecidos de credenciais/históricos.
- Não pode cobrir marcador, mapa(s), plano ou registro, nem por diretório ancestral
  ou variante de caixa. Mesmo um `CLAUDE.md` ainda inexistente fica protegido.

O controlador atesta que essa lista respeita o `Não alterar` aprovado. Texto livre de
proibições **não é um ACL automaticamente inferido**. A lista limita o contrato da futura
execução, não intercepta ferramentas. A conferência dos arquivos realmente alterados
pelo implementador pertence à M02-T03, não a este gate de entrada limpa.

Além da política de engenharia, rejeita locks Git e indicadores conhecidos de
merge/rebase/cherry-pick/revert/bisect/sequenciador. A árvore tem de estar limpa,
sem alterações staged, ignoradas, não rastreadas ou ocultas por flags do index.
Cada arquivo deve coincidir **byte a byte** com seu blob no index (sem filtros ou
conversão de EOL no checkout da fixture); não confia somente em stat/cache de Git.

O snapshot contém hashes SHA-256 de todos os arquivos rastreados, da listagem do
index, de `.git/config` e do estado semântico de refs/HEAD (`refsHash`). Este último é
SHA-256 de `JSON.stringify({ head, object, refs })`, nessa ordem: `head` é a saída de
`git symbolic-ref --no-recurse HEAD` sem whitespace final; `object` é a saída de
`git rev-parse --verify HEAD` sem whitespace final; `refs` é a saída UTF-8 integral de
`git for-each-ref --sort=refname --format=%(refname)%00%(objectname)%00%(symref)`.
Inclui todas as refs enumeradas, seus objetos diretos (inclusive objetos de tags
anotadas), destinos simbólicos, o destino simbólico direto de HEAD e seu commit resolvido.
Não depende de refs soltas versus `packed-refs`, reflogs, timestamps ou objetos soltos
inalcançáveis; não é um hash de cada byte transitório de `.git`.

A política é igualdade exata com `approval.refsHash`: refs preexistentes só são
permitidas como parte desse conjunto explicitamente revisado. Criar, mover ou remover
uma branch/tag/ref, ou mudar um destino simbólico, bloqueia mesmo com HEAD/branch
resolvidos e worktree estáveis. Uma ref para commit lateral não aprovado também bloqueia.
Não se assume que a estabilidade de HEAD autoriza as demais refs.

Leituras selecionadas são comparadas com os hashes; árvore/index/refs e admissão completa
são conferidos novamente antes do retorno, com uma última comparação de refs/HEAD após
a admissão final. `snapshotId` vincula os hashes, workspace real, HEAD e branch.
`inputId` vincula ainda os requisitos, área permitida e demais parâmetros públicos.
Não contém timestamp variável: chamadas semanticamente idênticas produzem o mesmo ID.

A revalidação repete o gate e compara `inputId`. Mesmo um novo baseline explicitamente
aprovado, inclusive um conjunto de refs reautorizado explicitamente, não pode reutilizar
uma entrada antiga. Não faz rollback de mudanças concorrentes.
Essas são detecções pontuais, **não uma trava contra escritores hostis nem snapshot
atômico do filesystem**. Resta uma janela entre a última leitura e a execução: o futuro
controlador deve revalidar após adquirir a lease e antes de lançar Pi. A exclusividade
Pi e o término comprovado continuam responsabilidade dos gates existentes.

## Resultado estruturado (schemaVersion 1)

Sucesso estrutural:

```js
{
  schemaVersion: 1,
  accepted: true,
  reason: null,
  gate: 'implementation-entry',
  taskApproved: false,
  input: {
    inputId, taskId, taskHash, baseline, branch, snapshotId,
    task: { title, text, sections }, // só a task selecionada e aprovada
    dependencies: ['M02-T01'],      // IDs, sem narrativas
    allowedChanges: ['test/', 'value.mjs'],
    testPolicy: 'node-test-only-v1'
  },
  snapshot: { refsHash, indexHash, configHash, files: [{ path, sha256 }] },
  official: { taskId, milestone, status, updatedAt }, // leitura da fonte, não estado operacional
  dependencies: [{ id, commit, metadata, evidence: 'two-commits' }]
  // Para vínculo reescrito: { id, commit: integrationHash, evidence: 'integration' }
}
```

`input` é a única porção destinada ao Pi. Snapshot, leitura do estado oficial e
metadados Git são para o controlador; não passar mapa/plano/registro completos.
Não retorna Observações, históricos, credenciais, configuração Git bruta ou stderr.
Hashes de arquivos inteiros não liberam seus conteúdos. O texto selecionado deve ser
fictício e seguro por revisão humana; não há scanner semântico universal de segredos.
O controle de leitura de ferramentas continua sem sandbox forte no Windows.

Recusa:

```js
{
  schemaVersion: 1, accepted: false,
  reason: { code: 'TASK_APPROVAL_MISMATCH' },
  gate: 'implementation-entry', taskApproved: false, input: null
}
```

Códigos:

| Grupo | Códigos |
| --- | --- |
| Solicitação/autorização | `INVALID_REQUEST`, `APPROVAL_REQUIRED`, `INVALID_APPROVAL`, `REQUEST_MISMATCH`, `TASK_APPROVAL_MISMATCH` |
| Workspace/Git | `WORKSPACE_REJECTED`, `GIT_REFS_MISMATCH`, `GIT_OPERATION_IN_PROGRESS`, `DIRTY_CONTENT`, `UNSAFE_PATH` |
| Mapa/artefatos | `INVALID_MAP`, `AMBIGUOUS_MAP`, `MISSING_ARTIFACT`, `ARTIFACT_TOO_LARGE` |
| Plano/task | `PLAN_NOT_APPROVED`, `TASK_NOT_FOUND`, `INVALID_TASK`, `INVALID_TASK_FIELDS`, `TASK_NOT_REGISTERED` |
| Registro/dependências | `INVALID_REGISTER`, `INITIAL_STATE_REJECTED`, `INVALID_DEPENDENCIES`, `DEPENDENCY_PENDING`, `DEPENDENCY_EVIDENCE_MISSING` |
| Atualidade/falha de inspeção | `CONCURRENT_CHANGE`, `INVALID_INPUT_ID`, `SNAPSHOT_MISMATCH`, `INSPECTION_FAILED` |

`WORKSPACE_REJECTED` é deliberadamente genérico: inclui HEAD/branch divergentes,
remotes/config/credenciais, área não descartável e Git sujo, sem vazar caminho ou
mensagem Git. Erros inesperados de filesystem/Git são `INSPECTION_FAILED`; jamais
implicam admissão. `GIT_REFS_MISMATCH` indica divergência das refs/HEAD frente à
aprovação confiável na captura inicial; mudanças detectadas durante o fechamento são
`CONCURRENT_CHANGE`. Mesmo uma nova aprovação válida gera `SNAPSHOT_MISMATCH` ao
tentar reutilizar um `inputId` anterior divergente. Uma tabela estruturalmente quebrada também pode produzir
`INVALID_REGISTER`, inclusive quando encontrada na seção de dependências do plano.

`accepted:true` significa somente **entrada estruturalmente válida** sob a autorização
recebida. Não é aprovação técnica, processo bem-sucedido, conclusão oficial, autorização
de commits ou satisfação do gate definitivo do revisor. O estado oficial é apenas lido.
A automação não atualiza `registro.md`, nem mesmo para `em andamento`.

## Testes

Da raiz, no Windows nativo, sem Pi/provedor/Gateway:

```powershell
node --test --test-concurrency=1 src/test/task-input.test.mjs
npm.cmd --prefix src test
```

Os harnesses preparam Git inteiramente fictício em temporários e criam commits somente
**antes** das chamadas ao validador (salvo escritores concorrentes injetados pelos testes).
Cobrem criação/movimentação/remoção de branches e tags com HEAD estável, commit lateral,
refs preexistentes explicitamente aprovadas, tags anotadas, destinos simbólicos e
estabilidade dos IDs após compactação de refs. Testes de recusa comparam bytes do workspace,
index/config/refs/registro e branch/HEAD antes/depois. Testes de concorrência injetam
mudanças determinísticas durante a inspeção e comprovam recusa sem rollback.
Nenhuma chamada ao validador inicia Pi ou grava artefatos operacionais.
