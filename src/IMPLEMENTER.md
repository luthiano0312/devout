# Role Runner implementador — M02-T03

Ensaio técnico em Git fictício/descartável no Windows nativo. Reutiliza o
[Runner/Driver e sua lease global](ROLE-RUNNER.md), o
[perfil de engenharia](ENGINEERING.md) e a [pré-validação M02-T02](TASK-INPUT.md).
Não executa revisão, correção, transições oficiais ou commits.

## Autoridade e entrada

O controlador humano prepara e revisa a fixture e a `approval` descrita em
`TASK-INPUT.md`. Ela continua sendo um argumento confiável **separado**: nunca
copiar uma aprovação gerada pelo modelo ou calcular novamente seus hashes para
acomodar mudanças. Primeiro executar `validateTaskInput(request, approval)`.
Somente uma entrada aceita fornece `inputId` para esta solicitação:

```js
const config = {
  schemaVersion: 1,
  taskId: 'M02-T02', // ID fictício da fixture, não da execução Devout
  role: 'implementador',
  workspace, artifactsRoot, piCmd, // absolutos; regras existentes de segurança
  modelProfile: 'configured-engineering',
  engineering: { baseline, branch: 'fixture', testPolicy: 'node-test-only-v1' },
  taskInputId: first.input.inputId,
  reportPath: 'docs/achados/task-M02-T02-relatorio.md',
  driver: { settlementTimeoutMs: 180000 },
};
const outcome = await runRole(config, { approval });
```

`reportPath` é relativo ao workspace, deve terminar em
`/achados/task-<ID>-relatorio.md`, não existir no baseline e constar **exatamente**
na lista humana `approval.allowedChanges`. Colocá-lo em `achados/` ao lado do
registro da fixture, conforme a convenção da skill manual. O controlador atesta
que os arquivos/prefixos permitidos respeitam `Não alterar`; não há tradução
semântica universal desse texto em ACL. Caminhos distinguem caixa. O Runner não
aceita `prompt`, `expectedText`, `approval`, comandos ou parâmetros de shell na
solicitação do implementador. O papel `test` preserva sua interface M01/M02-T01.

CLI local, com dois arquivos preparados pelo controlador e fora do Git:

```powershell
node src/role-runner.mjs run --config C:\temp\request.json --approval C:\temp\human-approval.json
```

O arquivo de aprovação é autoridade local de quem invoca a CLI, não autenticação
criptográfica: deve estar sob controle humano, nunca ser uma saída Pi aceita
automaticamente. A API recebe a aprovação por opção separada e captura uma cópia
antes das operações assíncronas. Ausência/divergência bloqueia sem adquirir lease
ou lançar Pi. `--approval` não é aceito para o papel `test`.

A entrada é revalidada novamente **depois** da aquisição da lease, antes do spawn.
Não há retomada automática: o gate M02-T02 continua exigindo `não iniciada`,
`Commit = -`, baseline/refs e árvore limpa. A execução não muda esse estado.

## Contexto e relatório

O prompt é construído pelo Runner com a **task selecionada**, os hashes públicos,
a área permitida, a política de testes e as instruções específicas de execução.
Não envia mapa, plano completo, registro/Observações, dependências narradas ou
relatórios anteriores. Arquivos locais de código/testes necessários são referências
que Pi pode ler; as ferramentas continuam sem sandbox forte. Contexto acima de
64 KiB bloqueia, sem truncar silenciosamente os requisitos.

A diferença em relação à skill `implement` **manual** é explícita no prompt:
Pi só implementa/testa/persiste evidências. Não atualiza registro (nem para
`em andamento`/`aguardando revisão`), muda branch, escreve Git ou faz commits.
As invocações manuais e a skill existente não foram alteradas.

O relatório Markdown usa o título
`# Relatório da implementação inicial — <ID>` e seções únicas, não vazias:

- `## Arquivos alterados`
- `## O que foi feito`
- `## Comandos e testes`
- `## Entregáveis`
- `## Critério de conclusão`
- `## Pendências`
- `## Evidências estruturadas`

Na última seção, um único fence `json`, para conferência determinística:

```json
{
  "schemaVersion": 1,
  "taskId": "M02-T02",
  "baseline": "<SHA-1 aprovado>",
  "inputId": "<SHA-256 da entrada>",
  "changedFiles": ["value.mjs"],
  "commands": [{ "command": "node --test", "outcome": "passed" }]
}
```

`changedFiles` identifica todos os arquivos criados/alterados/excluídos, **exceto o
próprio relatório**. Falha de teste deve ser registrada como `failed`, sem alegar
sucesso; esse relatório é preservado, mas não passa o gate. O comando é a política
estreita M02-T01: `node --test`, sem instalação, wrappers, rede ou dependências.

## Gate de saída e persistência

Somente depois de `lease.finish()` e da prova de término/liberação, o validador em
`implementation-delivery.mjs` confere:

1. Processo terminou normalmente, sem cancelamento, erro, força ou exit code não zero;
   término e liberação são necessários, mas não bastam.
2. Inventário limitado e sem links/hardlinks/nomes privados; arquivos fora da área
   permitida e novos diretórios fora dessa área bloqueiam. Mapas, plano, registro e
   marcador continuam protegidos pela autorização M02-T02.
3. Refs/HEAD iguais à aprovação e **todos os bytes/metadados Git** iguais à captura
   imediatamente anterior ao lançamento. Inclui index, config, hooks, reflogs e
   objetos inalcançáveis: commit seguido de reset também bloqueia. Não repara Git.
4. Diff Git sem renames/ext-diff/textconv + arquivos não rastreados coincidem com as
   diferenças de bytes reais. Arquivos ignorados não escapam ao inventário.
5. Relatório UTF-8 de até 256 KiB, seções presentes, identidade/baseline/entrada e
   arquivos estruturados coerentes; exige ao menos uma mudança além do relatório.
6. Teste declarado como aprovado e evidência final coerente de eventos correlacionados
   da ferramenta bash para o comando literal `node --test`: exige início/fim de todas
   as execuções observadas, IDs únicos e sucesso explícito da tentativa mais recente
   (pela ordem de início). Passe antigo não mascara falha posterior nem execução
   pendente; fim atrasado de tentativa anterior não substitui o resultado mais recente.
   Falha intermediária seguida de correção e novo passe é permitida. `result.json`
   registra somente contadores, resultado final e validade da correlação em
   `observed.engineering.testEvidence`, sem payloads ou IDs de ferramentas.
   O booleano histórico `harmlessTestSucceeded` sozinho não satisfaz este gate.
7. Releitura final dos arquivos/metadados/refs sem mudanças concorrentes observadas.

Artefatos operacionais em `artifactsRoot/runs/<runId>/`, fora do Git:

- Os arquivos já existentes `events.jsonl`, `state.json`, `control.json`, `result.json`.
- `implementation-input.json`: entrada selecionada + snapshot inicial para rastreio.
- `delivery.json`: gate aceito/recusado. Quando aceito, inclui `deliveryId`,
  `inputId`, `snapshotId`, baseline/branch, caminho/hash do relatório, arquivos
  alterados com SHA-256 (`null` para exclusão) e hash do diff binário rastreado.
  Arquivos novos são identificados por seus próprios hashes; não dependem do diff.

O resultado acrescenta `roleOutcome`: `completed` somente com gate aceito;
`blocked` para falha objetiva da entrega; `failed` para falha técnica;
`interrupted` para cancelamento/aborto. O `technicalOutcome` existente permanece
`succeeded`/`failed`/`interrupted`; `state` descreve apenas o processo. Todo resultado
mantém `taskApproved:false`. A CLI retorna 0 somente quando processo **e** entrega
passaram. Não autoriza commits, não altera o registro, não satisfaz o gate definitivo
de entrada do revisor ou o T01 integral do MVP (pendentes do Slice 4).

Recusas têm enums sanitizados, sem stderr de Git/provedor ou conteúdo de ferramentas:
`IMPLEMENTATION_ENTRY_REJECTED`, `REPORT_PATH_REJECTED`,
`IMPLEMENTATION_PROCESS_UNCONFIRMED`, `UNSAFE_DELIVERY`, `DELIVERY_TOO_LARGE`,
`GIT_REFS_CHANGED`, `GIT_METADATA_CHANGED`, `PROHIBITED_CHANGE`, `DIFF_MISMATCH`,
`IMPLEMENTATION_REPORT_MISSING`, `INVALID_IMPLEMENTATION_REPORT`,
`REPORT_DIFF_MISMATCH`, `IMPLEMENTATION_TEST_UNCONFIRMED`,
`IMPLEMENTATION_PROCESS_FAILED`, `DELIVERY_CONCURRENT_CHANGE`,
`DELIVERY_INSPECTION_FAILED`. O resultado do Runner inclui
`IMPLEMENTATION_DELIVERY_REJECTED` quando o gate recusa. Falhas inesperadas nunca
viram aprovação; falha na persistência não publica resultado de sucesso.

## Testes

```powershell
node --test --test-concurrency=1 src/test/implementation-runner.test.mjs
npm.cmd --prefix src test
# Opt-in, consome provedor e a lease global; executar sequencialmente:
npm.cmd --prefix src run test:implementer
```

O smoke prepara commits **antes** de Pi, depois executa a CLI real, exige mudança de
`value.mjs` de 1 para 2, teste local e relatório revisável; repete o teste pelo
controlador, confere HEAD/refs/branch/registro da fixture e registro Devout intactos,
consulta CIM para os processos observados e demonstra readquisição/liberação da lease.
Mantém fixture, relatório, diff e `smoke-summary.json` em temporário fora do repositório.

As verificações são pontuais, não snapshot atômico nem monitor de todas as ações
transitórias. A igualdade da árvore e dos metadados detecta alterações persistentes;
não prova que nenhum arquivo foi lido nem que uma mutação inteiramente revertida
nunca ocorreu. Recibos de ferramentas e relato não demonstram a qualidade dos testes
ou do código: essa análise pertence à revisão independente posterior. Usar somente
dados fictícios, sem segredos ou credenciais Git amplas.
