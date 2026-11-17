# Prova de integração OpenClaw → Pi Agent RPC (Windows nativo)

**Planejado em:** 2026-11-13  
**Status:** documentação consultada; código validado com mock do protocolo JSONL (handshake e prompt); teste com Pi real no Windows do operador **ainda não realizado**.  
**Escopo:** comprovar comunicação processo-a-processo e acionamento pelo OpenClaw, sem modificar `my-skills`, criar commits ou executar workflow real.

## Fontes consultadas

- Contexto consolidado do projeto `contexto-projeto-automacao-workflow-atualizado.md`, datado de 2026-11-12.
- OpenClaw Windows: https://docs.openclaw.ai/platforms/windows
- OpenClaw exec: https://docs.openclaw.ai/tools/exec
- OpenClaw CLI agent: https://docs.openclaw.ai/cli/agent
- Pi CLI: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md
- Pi RPC: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md
- Pi comandos RPC: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc-commands.md
- Pi eventos JSONL: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/json.md

Observação: o repositório histórico `badlogic/pi-mono` redireciona para `earendil-works/pi` na consulta de 2026-11-13. Verificar a CLI **instalada**, pois interfaces podem divergir.

## Requisitos

- Windows 10/11 **nativo** no terminal do OpenClaw e no processo do Pi (verificar `process.platform == 'win32'`).
- Node.js suportado pelas versões instaladas de OpenClaw e Pi; recomendação atual da documentação do OpenClaw: Node 26.12.1+ ou 24.22.1+.
- `pi` e `openclaw` disponíveis no PATH da conta que executa cada componente.
- Modelo e autenticação já funcionais no Pi **apenas** para o teste de prompt. Handshake não precisa chamar provedor.
- Pasta *descartável*; sem copiar credenciais, repositórios nem skills para ela.

## Preparação (PowerShell)

Executar no PowerShell do Windows, **não** no WSL:

```powershell
node --version
pi --version
openclaw --version
openclaw gateway status --json
Get-Command pi, openclaw, node | Select-Object Name, Source
```

Se faltar instalação, consultar os procedimentos oficiais. **Não atualizar automaticamente** instalações já existentes:

```powershell
# OpenClaw CLI + Gateway nativos (apenas se não estiver instalado)
iwr -useb https://openclaw.ai/install.ps1 | iex

# Pi (apenas se não estiver instalado)
powershell -c "irm https://pi.dev/install.ps1 | iex"
```

Use apenas os instaladores dos domínios oficiais, após conferir os endereços. O comando de instalação remota executa código baixado; se sua política de segurança não permitir, instale por outro método documentado.

Se necessário, conclua `openclaw onboard` e `openclaw gateway start`; no Pi, faça a configuração de provedor de IA pela interface interativa (`pi` → `/login`), se ainda não estiver funcionando. A autenticação do OpenClaw e a do Pi são independentes; não compartilhe chaves ou outputs de credenciais.

Crie uma pasta descartável, por exemplo `C:\temp\pi-rpc-prova`, e copie `probe-pi-rpc.mjs` para ela. Faça os testes nela:

```powershell
New-Item -ItemType Directory -Force C:\temp\pi-rpc-prova | Out-Null
Set-Location C:\temp\pi-rpc-prova
# Copie o arquivo probe-pi-rpc.mjs do pacote para esta pasta.
```

## Teste A: comunicação local RPC (sem modelo)

```powershell
node .\probe-pi-rpc.mjs
```

O script inicia `pi --mode rpc --no-session --no-tools --no-extensions --no-skills --no-prompt-templates --no-context-files --no-approve`, envia `{"id":"state-1","type":"get_state"}` e verifica resposta correlacionada com `success:true`. Fecha stdin e aguarda encerramento. O resultado deve mostrar `RESULTADO: PASS`. Erros no `pi --help`/opções da versão instalada pedem ajuste explícito antes de avançar.

**Critério de sucesso:** `getState = true`, `status = PASS`, `environment.platform = win32`, `shutdown.exitCode = 0` e `shutdown.forced = false`. Além disso, conferir no Windows a ausência de processo Pi órfão.

## Teste B: pedido real via RPC (usa modelo e pode consumir tokens)

```powershell
node .\probe-pi-rpc.mjs --prompt
```

O teste repete `get_state`, depois envia `prompt` para o Pi responder `PONG-OPENCLAW-PI`. O comando `prompt` **não** confirma conclusão; é necessário `data.disposition = "started"`, `agent_settled`, ausência de erro e resposta final igual ao marcador.

**Critério de sucesso:** `status = PASS`, `promptAccepted = true`, `settled = true`, texto final `PONG-OPENCLAW-PI` e encerramento ordenado.

## Teste C: OpenClaw → Pi (fim a fim)

Com o Gateway **rodando nativamente no Windows**, execute:

```powershell
openclaw dashboard
```

Na conversa do OpenClaw, envie uma mensagem semelhante a:

> Use a ferramenta `exec` no host `gateway` do Windows. Execute **somente** `node C:\temp\pi-rpc-prova\probe-pi-rpc.mjs --prompt` e retorne o status PASS/FAIL, a resposta final do Pi e o caminho do JSON de resultado. Não acesse outros diretórios, não execute comandos Git e não modifique skills. Se exec estiver indisponível, informe o bloqueio.

Antes de rodar o comando com LLM, é útil pedir a `exec` que execute `node -p "process.platform"` e `where.exe pi` para verificar se está no Windows e no PATH correto. Uma chamada `exec` no host `sandbox` em Linux/WSL não satisfaz a prova do Windows nativo.

Se o OpenClaw não estiver conectado a um Gateway local, use a documentação de configuração do Gateway antes de insistir. Aprovação do comando por uma política de `exec` não é falha de RPC; é uma barreira normal de autorização.

**Critério de sucesso:** resultados dos testes B e C consistentes, com o OpenClaw comprovadamente chamando a ferramenta `exec` e recebendo o retorno. A simples resposta textual de um modelo, sem registro de execução, não comprova a integração.

## Resultados (preencher após execução)

| Evidência | Resultado observado |
|---|---|
| Data/hora local | Pendente |
| Windows (build) | Pendente |
| Node.js versão | Pendente |
| OpenClaw versão | Pendente |
| Pi versão e origem | Pendente |
| A. Handshake direto | Pendente |
| B. Prompt direto | Pendente |
| C. OpenClaw → Pi | Pendente |
| Host real utilizado por OpenClaw | Pendente |
| Eventos relevantes recebidos | Pendente |
| Término do processo e ausência de órfãos | Pendente |
| Problemas/limitações | Pendente |
| Arquivos de evidência | Pendente |

Os arquivos são salvos em `resultados\<timestamp>-resultado.json` e `resultados\<timestamp>-eventos.jsonl`. Os logs podem incluir o texto da conversa e metadados do provedor; **revise e oculte segredos antes de compartilhar**.

## Próximos testes, **somente se A–C passarem**

1. **Sessões independentes:** lançar dois processos Pi, cada um com sessionId distinto; provar ausência de compartilhamento de histórico e configuração.
2. **Eventos:** observar streaming, `message_end`, `agent_settled` e eventuais eventos de ferramentas em execução descartável.
3. **Cancelamento:** `abort` durante geração, timeout e encerramento; verificar que não sobram subprocessos.
4. **Falhas:** modelo indisponível, comando RPC inválido, término inesperado, falta de PATH e fechamento de stdin; garantir registro correto sem sucesso falso.
5. **Arquivos e isolamento:** `pi-file-permissions`/`review_inputs.py`, caminhos absolutos, symlinks/junctions, terminal, Git e permissões Windows. **Não presumir que `--no-tools`, prompts ou extensão de permissões sejam sandbox de segurança forte.**

**Fora do escopo:** implementar o orquestrador completo; mudar `plan`/`implement`; atualizar `registro.md`; criar Git Gateway; executar em repositórios reais; alterações em branches ou commits.
