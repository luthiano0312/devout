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

1. Consultar o [registro](../03-execucao/registro.md), o [AGENTS.md](../../AGENTS.md) e a task atual no [plano ativo M02](../plano.md), aprovado em 2026-11-19. O [plano M01 encerrado](../03-execucao/planos/marco-M01.md) é histórico e não autoriza novas execuções. Na avaliação independente, obter primeiro a entrada filtrada conforme o mapa, sem abrir o plano inteiro ou Observações do registro.
2. Confirmar no Git o baseline autorizado do marco e a seleção de fontes pertinente, além do estado, das dependências e da branch da task. O baseline M02 (plano, registro, mapa e seleção M02-T01) foi confirmado em `9014b8b116bb6f2bfd3499d50aeef481bc44e7ec`; revalidar sua presença no histórico e preservar alterações intermediárias da task em curso. O baseline M01 em `c771c4b39a34716f15728c1e0d5b2596e776bc41` é histórico e não autoriza implementar o M02.
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
