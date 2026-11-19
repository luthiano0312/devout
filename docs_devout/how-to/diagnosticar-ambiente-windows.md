# Diagnosticar o ambiente Windows

## Quando usar

Antes de implementar/testar uma task que dependa de OpenClaw ou Pi, ou ao trocar de host. Estes comandos consultam o ambiente; não instalam pacotes nem alteram políticas do PowerShell.

## Conferir checkout e ferramentas

Na raiz do repositório, em PowerShell:

```powershell
git status --short
git branch --show-current
git log -1 --oneline
node --version
npm.cmd --version
openclaw.cmd --version
pi.cmd --version
Get-Command pi.cmd | Select-Object Source
```

Usar `npm.cmd` evita o bloqueio histórico de `npm.ps1` sem reduzir a política de execução. Descobrir o Pi instalado; não presumir que está em `%APPDATA%\npm`.

## Se a task exigir o Gateway OpenClaw

```powershell
openclaw.cmd config get gateway.mode
openclaw.cmd gateway status --json
```

Essas consultas foram usadas na prova histórica; conferir compatibilidade com a versão local. Conexão RPC bem-sucedida não comprova todas as permissões nem conclusão de uma execução. Não expor portas, copiar configurações com tokens ou versionar logs brutos.

## Antes de executar código da task

1. Consultar o [registro](../03-execucao/registro.md) e o [AGENTS.md](../../AGENTS.md). O [plano M01 encerrado](../03-execucao/planos/marco-M01.md) é histórico; não há plano ativo. Para nova implementação, exigir plano aprovado em `docs_devout/plano.md`, caminho previsto para o próximo marco.
2. Confirmar o commit autorizado de baseline do marco a executar. O baseline M01 foi confirmado em `c771c4b39a34716f15728c1e0d5b2596e776bc41`; `e616980` é anterior a ele. Esse baseline histórico não autoriza implementar o M02.
3. Preservar alterações preexistentes e usar workspace descartável sem segredos para o Pi experimental.
4. Se ferramenta, dependência, identidade de processo ou estado Git estiver incerto, registrar o bloqueio; não contornar com alterações de arquitetura ou credenciais.

## Testes disponíveis

O Slice 1 possui código e testes em `src/`, com evidências de execução e revisão vinculadas no registro M01. Comandos a partir da raiz, em Windows nativo:

```powershell
npm.cmd --prefix src test
npm.cmd --prefix src run test:smoke
```

O primeiro usa processos fictícios; o segundo é opt-in com Pi real, provedor configurado e workspace temporário sem segredos. Não executar smokes em paralelo com outro Pi controlado pelo workflow ou após encerramento incerto. Interfaces, demais roteiros e limites estão no [guia de src/](../../src/README.md).

`prototipo/` contém experimentos históricos, não substitui a suíte do orquestrador. Não repetir experimentos sem hipótese técnica nova; o encerramento documental utiliza as evidências existentes, sem exigir nova bateria funcional.

Consultar a [prova OpenClaw + Pi](../reference/01-registro-integracao-openclaw-pi-e-decisoes.md) apenas para os fatos e limites do host de teste de 2026, sem presumir que instalações, versões e credenciais foram transferidas.
