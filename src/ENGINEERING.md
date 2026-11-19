# Perfil de engenharia controlado — M02-T01

Perfil opt-in para **dados inteiramente fictícios**, Windows nativo, Pi RPC e Git
local descartável. Não habilita os papéis implementador/revisor/corretor, aprovação
de tasks, commits, push, remotes ou transições oficiais. O Runner continua temporário,
com `role: "test"`, um prompt e a mesma lease global do M01.

## Entrada e ferramentas

Além dos campos de [`ROLE-RUNNER.md`](ROLE-RUNNER.md), o controlador confiável fornece:

```json
{
  "modelProfile": "configured-engineering",
  "engineering": {
    "baseline": "<SHA-1 completo do commit local preparado>",
    "branch": "fixture",
    "testPolicy": "node-test-only-v1"
  }
}
```

O exemplo é um fragmento, não uma solicitação completa. Não aceitar solicitações,
launchers ou comandos de um modelo como autorização. `engineering` é obrigatório
nesse perfil e proibido em `configured-isolated`; o objeto tem exatamente os três
campos acima. Perfis desconhecidos são rejeitados. Não há seleção livre de ferramentas,
comandos, shell, extensões, modelo, MCP, argv ou raiz de lock na solicitação.

O Driver mapeia para uma **linha literal** `engineering`:

```text
--mode rpc --no-session --tools read,edit,write,bash --no-extensions --no-mcp --no-skills --no-prompt-templates --no-context-files --no-approve
```

- `read`, `edit`, `write`: inspeção e edição do fixture.
- `bash`: inspeção local e execução de `node --test`; não é um filtro de comandos.
- Nenhum MCP, skill, extensão, template ou AGENTS/CLAUDE externo é descoberto
  automaticamente. Sessão não é gravada. O provedor já configurado no Pi é mantido.
- O launcher continua `cmd.exe` com `shell:false`, caminho `.cmd` validado e sem
  metacaracteres, argumentos literais e prompt somente no stdin RPC.
- `configured-isolated`/`isolated` não muda: continua sem ferramentas, não admite Git
  e não recebe o bloco `engineering`. `default` não é exposto pelo Runner.

## Admissão do repositório

`engineering-workspace.mjs` verifica antes de criar Pi, novamente depois de adquirir
a lease e no preparo da especificação do Driver:

1. Diretório local real abaixo de `os.tmpdir()`, não a raiz temporária, não o Devout,
   não contido em outro Git. Não admite `.git` como arquivo/worktree compartilhada.
2. Marcador **versionado** `.devout-disposable.json` com exatamente
   `{"schemaVersion":1,"disposable":true}`. É atestação humana de dados fictícios,
   baseline revisado e ausência de segredos, **não autorização para um repo real**.
3. Git local com HEAD SHA-1 e branch iguais aos declarados; árvore/index limpos,
   sem arquivos ignorados ou não rastreados. Rejeita flags assume-unchanged/skip-worktree,
   symlinks/gitlinks no index e repositórios aninhados.
4. Sem remotes; configuração local fechada às opções estruturais usuais do `git init`
   (`core.repositoryformatversion=0`, `filemode`, `bare=false`, `logallrefupdates=true`,
   `ignorecase`, `symlinks=false`). Rejeita aliases, includes, helpers de credenciais,
   fsmonitor, filtros, hooksPath e quaisquer outras opções locais.
5. Sem hooks (inclusive exemplos), alternates, grafts, replace refs, shallow, módulos
   ou metadados compartilhados. Preparar com `git init --template=` para não copiar hooks.
6. Sem links/junctions/hardlinks de arquivos, históricos `.pi`/`.openclaw`, diretórios
   de credenciais conhecidos, `.env*`, `.git-credentials`, `.npmrc`, `.netrc`, chaves
   conhecidas e certificados privados. Até 4096 entradas incluindo `.git`, 8 MiB por
   arquivo e 32 MiB totais; marcador até 1024 bytes. Não é scanner universal de segredos:
   conteúdo arbitrário e histórico devem ser fictícios por construção/atestação.
7. Política exatamente `node-test-only-v1` e arquivo local `test/fixture.test.mjs`.
   O controlador atesta que os testes usam apenas Node/built-ins, não dependências,
   instalações, serviços, rede ou dados externos. A validação verifica o identificador
   e a presença do teste; **não prova que JavaScript arbitrário seja inofensivo**.

As consultas Git de admissão são internas, limitadas por tamanho/timeout e executadas
sem shell, sem configs global/system nem includes locais. O ambiente de engenharia
remove overrides `GIT_*`, `GCM_*`, `SSH_*` e tokens `GITHUB_*`, `GH_*`, `GITLAB_*`,
`BITBUCKET_*`; redefine config global para `/dev/null` (compatível com Git for Windows),
desabilita prompts interativos, helper de credenciais e hooks por config de ambiente.
Não lê nem copia configs pessoais, credenciais Git ou históricos para o fixture/Git.
Credenciais necessárias ao provedor Pi continuam disponíveis ao Pi, não são persistidas.

O Runner prefixa o prompt com a política: permanecer no workspace; não acessar rede,
credenciais/contexto externo, instalar pacotes ou fazer escritas Git (incluindo
commit/push/config). São instruções comportamentais, não interceptação de syscalls.
O Runner não executa o comando de teste solicitado pelo modelo nem aceita comandos
no launcher; a ferramenta `bash` do Pi executa o teste dentro do ambiente aceito.

`artifactsRoot`, identidade de processos, Job Object, término comprovado, cancelamento
e exclusividade global conservam os controles do M01. O Runner persiste somente
contagens de ferramentas e booleanos de início/fim sem erro para o comando exato
`node --test`, correlacionado por toolCallId em memória. Não grava argumentos, respostas,
conteúdo de ferramentas ou IDs de chamadas. Esses sinais não aprovam tasks.

## Smoke real opt-in (Windows)

Executar separadamente, sem Pi anterior do workflow ativo/incerto:

```powershell
$env:DEVOUT_PI_CMD = (Get-Command pi.cmd).Source
npm.cmd --prefix src test
npm.cmd --prefix src run test:engineering
# Compatibilidade M01 (separado, também consome provedor):
npm.cmd --prefix src run test:runner
npm.cmd --prefix src run test:smoke
```

O smoke prepara Git **novo**, sem templates/remotes/config pessoal, com identidade
fictícia (`fixture@example.invalid`). Somente o harness de preparação cria o commit
de baseline **antes do Pi**; não há commit da alteração produzida, nem do Devout.
O teste inicial espera `value=2` mas o baseline contém `value=1`. Um único Pi faz
read/edição de `value.mjs` e executa `node --test`. O controlador verifica:

- resposta esperada + settlement sem erro; recibo correlacionado de ferramenta bash;
- conteúdo/diff real exclusivamente de `value.mjs`; HEAD/branch iguais e sem remotes,
  alterações staged ou arquivos extras; teste reproduzido independentemente;
- Runner encerrado, Pi/descendentes ausentes (Job Object e conferência CIM), término
  normal sem força, lease liberada e readquirida/liberada sem lançar outro Pi;
- registro oficial byte a byte intacto e `taskApproved:false`.

Evidências sanitizadas permanecem **fora do Git**, no temporário indicado por
`evidenceRoot`: `smoke-summary.json`, `fictional-diff.txt`, solicitação fictícia e
`operacional/runs/<runId>/{state,result,events,control}`. Não publicar credenciais ou
stderr bruto. Falha não dispara retry; preservar/reconciliar antes de novo Pi.

## Limites de segurança

O marcador e as checagens **não são sandbox**. A mesma conta Windows pode acessar
arquivos externos por caminhos indiretos, ler credenciais pessoais/provedor, alterar
o ambiente, escrever `.git`, executar outros comandos ou acessar rede via ferramentas.
Desabilitar helpers/remotes e instruir o Pi não garante impedir essas ações hostis.
Não executar com dados reais/privados, segredos ou credenciais Git amplas acessíveis;
se o host não atende à atestação, não lançar Pi. Sem isolamento forte, proteção contra
manipulação concorrente hostil, scanners completos ou alegação de segurança de produção.
O controlador deve revisar o fixture e usar somente diretórios confiáveis/restritos.
Ver [ADR-0003](../docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md).
