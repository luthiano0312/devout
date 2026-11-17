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

1. Consultar o [plano](../plano.md), o [registro](../03-execucao/registro.md) e o [AGENTS.md](../../AGENTS.md).
2. Confirmar o commit autorizado de baseline que inclui esses três arquivos. Atualmente ele ainda está pendente; não confundir o commit anterior `e616980` com baseline do M01.
3. Preservar alterações preexistentes e usar workspace descartável sem segredos para o Pi experimental.
4. Se ferramenta, dependência, identidade de processo ou estado Git estiver incerto, registrar o bloqueio; não contornar com alterações de arquitetura ou credenciais.

## Testes disponíveis

Ainda não há comando de testes do código definitivo validado. `prototipo/` contém experimentos históricos, não uma suíte de aceite do novo orquestrador. Não repetir experimentos sem hipótese técnica nova; os comandos de testes definitivos serão registrados após a criação e validação dos scripts em `src/`.

Consultar a [prova OpenClaw + Pi](../reference/01-registro-integracao-openclaw-pi-e-decisoes.md) apenas para os fatos e limites do host de teste de 2026, sem presumir que instalações, versões e credenciais foram transferidas.
