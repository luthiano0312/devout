# Projeto de automação de desenvolvimento — registro da prova OpenClaw + Pi Agent

**Data de consolidação:** 16/11/2026  
**Status:** prova de comunicação e controle via RPC concluída; construção do orquestrador **ainda não iniciada**.  
**Papel deste arquivo:** fonte de projeto com fatos verificados, decisões aprovadas nesta conversa, limitações e implicações para o MVP.  
**Referência anterior:** [contexto consolidado](../explanation/contexto-projeto-automacao-workflow-atualizado.md) (consolidação conceitual de 12/11/2026). Este documento o **complementa**, não o substitui. As decisões prévias sobre workflow, Git, papéis e aprovações permanecem válidas salvo mudanças explícitas aqui registradas.

## 1. Objetivo e alcance da prova

Validar que **OpenClaw** consegue controlar **Pi Agent** por **RPC** no **Windows 10/11 nativo**, sem Docker, WSL2 ou servidor remoto, antes de alterar as skills `plan` e `implement`. Verificar, em ordem: comunicação, sessão persistente, eventos, cancelamento, tratamento de erros, falhas, timeout, sessões independentes e restrições de leitura de arquivos.

Não faziam parte da prova: implementar o orquestrador completo, executar uma task real, alterar skills, criar Git Gateway, efetuar commits, integrar branches ou automatizar marcos inteiros.

**Resultado geral:** viabilidade técnica do controle OpenClaw → Pi RPC **comprovada para o protótipo**. Um problema real de isolamento de arquivos foi identificado e **aceito conscientemente como risco do MVP**, não solucionado. O próximo trabalho é especificar o contrato de orquestração e implementar incrementalmente uma task fictícia/descartável.

## 2. Contexto de arquitetura preservado

- `OpenClaw` é o orquestrador: supervisiona processos/sessões, atribui papéis, confere pré-condições/evidências, controla transições, detecta interrupções e aciona operações privilegiadas por interfaces controladas.
- `Pi Agent` é o executor de programação acessível por RPC. Suas respostas e relatórios são **evidências**, não autorização automática para avançar o workflow.
- Skills existentes no repositório [luthiano0312/my-skills](https://github.com/luthiano0312/my-skills), em `.agents/skills/`: `grill-me` (decisões humanas), `docs` (requisitos/design/documentação), `plan` (marco e tasks pequenas, arquivos individuais e índice, ainda conceitual), `implement` (implementação, revisão independente, correção, reauditoria e evidências).
- `registro.md` permanece fonte oficial de status da task; estados atuais: `não iniciada`, `em andamento`, `aguardando revisão`, `em correção`, `pausada`, `concluída`, `substituída`. Somente o controlador autorizado pelo OpenClaw deve operar transições oficiais, com validação programática.
- Papéis de `implement`: **implementador → revisor independente → corretor (se necessário) → novo revisor**. Revisão em duas fases: primeira avaliação sem ler os relatos anteriores, persistindo-a antes de liberar a segunda fase. `review_inputs.py` e `update_registro.py` são scripts já existentes a verificar/adaptar, não reimplementados nesta prova.
- Limites atuais: até **três correções completas e quatro revisões** por task; achados `bloqueador` e `importante` impedem conclusão, `melhoria opcional` não impede; todos os achados devem ser reportados. Falha obrigatória sem solução interrompe o **marco inteiro**.
- Modelo mais barato para implementação/correção e mais capaz para revisão é **hipótese de custo/qualidade a medir**, não resultado da prova; modelos/provedores definitivos não foram escolhidos.
- Fluxo Git aprovado conceitualmente: `main` → branch `marco-01` → branch por task a partir do marco atualizado. Após aprovação técnica, **dois commits oficiais** (código e metadados), integração task → marco sem squash e sincronização remota; `main` somente após homologação e autorização humana explícita. Não publicar checkpoints parciais no MVP.
- Futuro **Git Gateway** com funções específicas, checagens de branch/ref/concorrência e credenciais protegidas. Não se confunde com o Gateway do OpenClaw, já testado aqui.
- Aprovação do marco autoriza trabalho rotineiro previsto; requisito/escopo/arquitetura novos e integração na `main` continuam decisão humana. Reprovação na homologação gera feedback → `docs` quando necessário → `plan` → novas tasks aprovadas, preservando histórico.

### Decisão nova e explícita desta conversa: **apenas um processo Pi ativo por vez**

Não é necessário testar nem oferecer sessões **simultâneas**. O MVP será **sequencial**, e cada papel inicia processo/sessão própria **após a confirmação do encerramento do anterior**. Sessões independentes ≠ sessões concorrentes. Motivos: menor complexidade, conflito de escrita reduzido, ciclo de falhas mais simples, contexto do revisor não herdado do implementador e recursos controláveis.

Contrato operacional pretendido: nunca iniciar outro Pi sem confirmar que o processo anterior terminou (inclusive após timeout/cancelamento). Se a situação do processo anterior for ambígua, **não iniciar às cegas**.

## 3. Ambiente testado e problemas de instalação

**Ambiente real:** PC Windows, PowerShell; testes realizados originalmente no computador do trabalho. O usuário chegou a preparar arquivos para eventual transferência à máquina doméstica, mas continuou os experimentos no PC do trabalho. Não assumir que instalações/credenciais/configuração foram transferidas.

- **OpenClaw CLI:** `2026.11.3 (847611d)`, instalado globalmente via `npm.cmd install -g openclaw@latest` (exemplo da instalação). O PowerShell originalmente não encontrava `openclaw.cmd` porque o pacote não estava na lista npm global.
- **PowerShell/npm:** `npm.ps1` bloqueado pela política de execução; `npm.cmd` funcionou sem mudar políticas. Evitar instruir uma redução de segurança sem necessidade.
- **OpenClaw Gateway:** `gateway.mode` estava sem valor explícito; foi configurado com `openclaw.cmd config set gateway.mode local`. Início manual por `openclaw.cmd gateway run --verbose`. Serviço automático do Windows não estava instalado/carregado, o que **não impediu** a execução manual.
- **Gateway local:** `127.0.0.1:18789`, interface `http://127.0.0.1:18789/`. Um diagnóstico inicial devolveu `ECONNREFUSED`; após iniciar o processo e repetir, `gateway status --json` mostrou `rpc.ok=true`, `server.version=2026.11.3`, processo Node escutando na porta. O campo `connected_no_operator_scope` apareceu num teste de status: não equiparar conexão RPC a permissões gerais de operação.
- **Dashboard:** `openclaw.cmd dashboard` retornou timeout de 2000 ms no acesso HTTP, mas o dashboard abriu diretamente pelo navegador em `http://127.0.0.1:18789/`. Não reabrir o incidente sem nova evidência.
- **Pi Agent CLI:** caminho real `C:\Users\User\.pi\agent\bin\pi.cmd` (`Get-Command pi.cmd`, `where.exe pi.cmd` confirmaram). Usar `$env:USERPROFILE\.pi\agent\bin\pi.cmd` ou descoberta por `Get-Command`, e não presumir `$env:APPDATA\npm\pi.cmd`. O Pi já tinha sido instalado; `pi.cmd --mode rpc` funcionava.
- **Extensão Pi:** `pi.cmd list` retornou `npm:pi-file-permissions` e a extensão foi observada carregando `file-permissions.yaml` no E14.
- **Modelo durante alguns testes de inferência:** `gpt-6.1-sol`, provedor `openai-codex`; a seleção definitiva de modelos para o MVP permanece em aberto. Testes `get_state` e RPC de controle não exigiram inferência.
- **Node.js:** instalado e funcional, mas a versão exata não foi registrada nas saídas partilhadas.

### Comandos úteis de diagnóstico (não são comandos de instalação)

```powershell
node --version
npm.cmd --version
openclaw.cmd --version
openclaw.cmd config get gateway.mode
openclaw.cmd gateway status --json
pi.cmd --version
pi.cmd list
Get-Command pi.cmd | Select-Object Source
```

## 4. Interface RPC e estratégia de processo

Protocolo Pi testado: JSONL em `stdin`/`stdout` de processo iniciado com `pi.cmd --mode rpc`. Exemplos: `get_state`, `prompt`, `abort`, `get_messages`, `bash`; respostas `type=response`, correlacionadas por `id`. Eventos de execução incluem `agent_start`, `turn_start`, `message_start`, `message_update`, `message_end`, `turn_end`, `agent_end`, `agent_settled`. A aceitação de `prompt` com `disposition=started` **não equivale** à conclusão; esperar `agent_settled` e validar resultado de acordo com o papel.

Um teste preliminar enviando JSON por pipeline PowerShell (`$payload | pi.cmd ...`) recebeu eventos iniciais, mas não a conclusão: o pipeline fecha `stdin` ao terminar. Para acompanhar geração longa, o `stdin` precisa permanecer aberto.

A ferramenta `exec` do OpenClaw, com `background=true`, `pty=false`, iniciou o Pi, mas o processo terminou antes de `process.write` (entrada fechada). Um teste independente de eco Node comprovou `STDIN_EOF` antes da escrita. Com `pty=true`, o processo ficou vivo com `stdinWritable=true`, mas o eco esperado não chegou; PTY não foi aprovado como transporte RPC confiável por potencial eco/transformação de caracteres e ausência de resultado observável.

**Solução experimental validada:** pequena ponte/driver Node.js que inicia e mantém o Pi com pipes próprios, envia JSONL e lê respostas/eventos. Na experiência de persistência, uma ponte HTTP **local** em `127.0.0.1:18790` expôs apenas operações experimentais de consulta; chamadas distintas pelo OpenClaw reutilizaram o mesmo `sessionId`. Isso **não é** o orquestrador pronto, nem serviço de rede para produção; a porta não possuía autenticação e não deve ser exposta a outras interfaces de rede.

**Pendência técnica recorrente:** Node emitiu aviso `DEP0190` pela combinação `spawn(..., { shell: true })` com argumentos. A prova funcionou, mas o mecanismo de spawn deve ser revisto antes de aceitar qualquer argumento não fixo ou controlado por modelo. Não concatenar argumentos arbitrários em shell.

## 5. Inventário dos experimentos e evidências

Status se refere **somente ao que cada experimento mediu**. `PASS` de um script não implica aprovação de requisitos mais amplos.

| Identificação/capacidade | Evidência obtida | Conclusão |
|---|---|---|
| Gateway OpenClaw | `gateway status --json` → `rpc.ok=true`, porta 18789 escutando | **Aprovado** no host de teste |
| Primeiro Pi RPC isolado | `get_state` → `success=true`, identificador de sessão | **Aprovado** |
| OpenClaw → Pi (chamada única) | `oc-pi-2`, `get_state`, `success=true`, processo saída `0` | **Aprovado** |
| Dois comandos na mesma instância | `oc-pi-3a`/`oc-pi-3b`, mesmo `sessionId` `01a1d615-a84d-7435-a948-28b22f4e0d5f`, saída `0` | **Aprovado** (não comprova persistência entre execuções) |
| Ponte persistente | `bridge-5` e `bridge-6`, mesmo `sessionId` `01a1d62d-9d52-750f-9f52-ca2ccf38b8d2`, chamadas independentes | **Aprovado**; PID estável não foi documentado nessa prova |
| Eventos RPC (primeira tentativa) | `prompt` aceito, `agent_start`, sem `agent_settled` por EOF no `stdin` | **Inconclusivo** para conclusão |
| Eventos RPC (driver corrigido) | `prompt` aceito; `message_update`: **8**; `agent_settled aborted=false`; texto `PONG-EVENTOS.`; `PI_EXIT=0`; `TEST_RESULT PASS` | **Aprovado**, também pelo OpenClaw |
| E09 — Cancelamento | `abort` respondido `success=true`; `MESSAGE_END stopReason=aborted`; `agent_settled aborted=true`; `get_state isStreaming=false`; processo saída `0`; `PASS` | **Aprovado**; saída `0` não significa task concluída |
| E10 — Erro de protocolo | JSON malformado → `command=parse`, `success=false`; comando válido `e10-state` subsequente → `success=true`; saída `0` | **Aprovado**: erro de parse recuperável |
| E11 — Falha abrupta | Pi PID `2036` morto intencionalmente (`FORCE_KILL=true`, saída `1`); novo Pi PID `11820`, novo `sessionId`; saída `0`; `PASS` | **Aprovado** no nível de processo, não de task/Git |
| E12 — Timeout | processo Node **simulado** sem resposta → `RPC_TIMEOUT`, encerrado `SIGTERM`; Pi real iniciado depois → `get_state success=true`, saída `0`; `PASS` | **Aprovado no cenário simulado**; falta validar timeout real de provedor |
| E13 — Independência sequencial | primeiro Pi concluiu resposta `PONG-EVENTOS.`; segundo começou com `messageCount=0`, `get_messages` vazio, `SECOND_EXIT=0`; `PI_PROCESSES_REMAINING=0`; `PASS` | **Aprovado**: sem herança automática de histórico conversacional |
| E14 — Leitura autorizada | com configuração carregada, chamada `read` em `./publico/codigo.txt` retornou `CODIGO_PUBLICO_E14`, `isError=false` | **Aprovado** |
| E14 — Leitura negada via modelo | modelo recusou antecipadamente, sem chamar `read` | **Inconclusivo quanto à execução do bloqueio técnico**; obediência às instruções observada |
| E14 — RPC `bash` em caminho proibido | resposta final `type=response`, `command=bash`, `success=true`, `data.exitCode=0`, `data.output=RELATORIO_PROTEGIDO_E14\n` | **Bypass confirmado** da proteção geral suposta; **não** demonstra falha do hook `tool_call` da ferramenta `read` |

### Problemas de teste corrigidos durante o processo

- Caminho errado inicial do Pi (`AppData\Roaming\npm\pi.cmd`); verdadeiro em `.pi\agent\bin\pi.cmd`.
- `gateway.mode` inicialmente indefinido; configurado explicitamente como `local`.
- `openclaw dashboard` excedia timeout embora interface abrisse pelo navegador.
- Pipeline PowerShell fechava `stdin` cedo, interrompendo prompt antes de `agent_settled`.
- Teste Node de eventos primeiro falhou ao inicializar `.cmd` pela composição de aspas/shell; corrigido e repetido até `PASS`.
- Primeira análise do E14 `bash` não esperava `type=response` e confundiu evento intermediário com retorno final; após aguardar resposta definitiva, houve leitura efetiva do arquivo supostamente protegido.

## 6. E14 — O achado de segurança e o risco aceito

Ambiente sintético, sem dados reais:

```text
C:\temp\pi-rpc-e14\
├── file-permissions.yaml
├── publico\codigo.txt            → CODIGO_PUBLICO_E14
└── privado\relatorio.txt         → RELATORIO_PROTEGIDO_E14
```

Configuração carregada pela extensão:

```yaml
domains:
  - path: ./publico
    permissions: [read]
  - path: ./privado
    permissions: []
```

O Pi obedeceu às instruções e leu o arquivo público pelo `read`. Para o arquivo privado, o modelo **não tentou** a ferramenta `read`; portanto, nunca vimos o hook negar essa chamada diretamente. Entretanto, o controlador enviou uma operação RPC `bash` que executou Node.js `fs.readFileSync('privado/relatorio.txt')`; o Pi devolveu o conteúdo proibido em `data.output` com `success=true` e `exitCode=0`.

**Interpretação correta:** `pi-file-permissions` foi carregada, mas **não constitui controle de acesso abrangente para todas as interfaces RPC e permissões da conta Windows**. O teste comprova que o **controlador** pôde contornar a restrição por uma chamada RPC; não comprova que um **modelo** já tenha contornado espontaneamente a política ou que o hook de `read` esteja defeituoso. A revisão independente por sessão nova protege o histórico de chat, mas não impede leitura de arquivos disponíveis à mesma conta do Windows.

### Decisão humana mais recente (16/11/2026)

**Adiar isolamento forte para depois do MVP**, pois o revisor já é instruído a não consultar relatos anteriores, o usuário prioriza construir e experimentar o workflow real e aceita o risco residual. **Não afirmar que o isolamento foi validado**. Caso ocorram leituras indevidas ou contaminação em execução real, reavaliar arquitetura, inclusive workspace filtrado sem material acessível, segregação por conta/permissões NTFS, container/VM ou outro isolamento verificável.

**Condições prudenciais para experimentar o MVP com esse risco aceito:**

- Usar **repositórios descartáveis e arquivos fictícios**, sem dados sensíveis, segredos reais ou credenciais Git com amplo alcance; não testar em software de produção.
- Preservar fase 1/fase 2 da revisão, `review_inputs.py` e instruções `pi-file-permissions` como **controles contra exposição acidental**, não barreiras de segurança fortes.
- Não conceder ao papel revisor acesso arbitrário à interface RPC `bash` do controlador; isso reduz superfície exposta, mas não substitui controle do SO se a ferramenta `bash` do próprio Pi estiver disponível.
- Registrar tentativa e exposição efetiva; **pausar** e tratar caso a fase independente seja contaminada, em vez de aprovar ou seguir silenciosamente.
- **Isolamento do revisor é risco aceito somente para o MVP controlado**; não é autorização para implantação em produção real com arquivos/segredos importantes sem reavaliação.

## 7. Outros limites que permanecem

- Não foi medido custo de modelos/latência/qualidade de papéis em tasks reais; os valores relatados por `get_state` são metadados do modelo, não custo agregado da automação.
- Não foi comprovado reinício seguro de **task** após perda de processo: o E11 só criou uma nova sessão. Falha após commits oficiais, alterações concorrentes ou Git remoto exige reconciliação/decisão, não reinicialização cega.
- O E12 só testou **timeout simulado**; falhas reais de serviço/modelo/cancelamento pendente ainda exigem guardrails e verificações.
- O OpenClaw Gateway e a ponte experimental estavam sem desenho de operação permanente; ao trocar/reiniciar a máquina é preciso subir novamente, verificar estado e repetir smoke tests.
- Não há contratos de chamadas/erros, persistência mínima, gates, validação de evidências ou orquestração completa já implementados.
- Não há Git Gateway nem isolamento de credenciais testados. **Wrapper na mesma conta Windows não constitui barreira de segurança forte**, mesmo que a API de Git seja restrita.
- Não foi testada simultaneidade de dois processos; isso **não é pendência** do MVP, pois foi descartada deliberadamente.

## 8. Caminhos, scripts e artefatos úteis

**No computador de teste (podem precisar ser copiados/ajustados em outro host):**

- Pasta de scripts: `C:\temp\pi-rpc-prova\`.
- Scripts usados/gerados no decorrer da conversa: `pi-rpc-bridge.mjs`, `pi-rpc-bridge-port.mjs` (variante para porta 18791 criada mas teste simultâneo não executado), `pi-rpc-eventos.mjs`, `pi-rpc-abort.mjs`, `e11-falha-processo.mjs`, `e12-timeout-rpc.mjs`, `e14-acesso-rpc.mjs`; versões efetivas precisam ser conferidas na pasta local.
- Ambiente E14: `C:\temp\pi-rpc-e14\`.
- Logs do OpenClaw em `%LOCALAPPDATA%\Temp\openclaw\` (pode haver tokens; **não versionar logs brutos**).
- Configuração local OpenClaw `%USERPROFILE%\.openclaw\openclaw.json` e diretório Pi `%USERPROFILE%\.pi\`: **não versionar pastas inteiras**, pois podem conter credenciais ou histórico.
- Relatório intermediário anterior: `relatorio-prova-integracao-openclaw-pi.md`.

Alguns links de arquivos ZIP compartilhados durante a conversa falharam; os scripts E11, E12 e E14 foram disponibilizados em código no chat e salvos localmente. **Não depender de links antigos para recuperar os arquivos.** Revisar cuidadosamente quaisquer scripts antes de enviar a GitHub, especialmente comandos com `shell:true`.

## 9. Próxima fase aprovada como direção: MVP incremental

### Etapa A — Especificar o contrato de orquestração (próxima atividade)

Especificar **sem começar por uma reescrita das skills**:

1. Operações RPC expostas pela camada de processo (exemplos a definir: `start`, `prompt`, `get_state`, `abort`, `stop`, `get_events`), garantias de correlação por ID, eventos, timeouts, exit codes, tratamento de EOF e enumerações de resultado do papel.
2. Máquina de estados **operacional** mínima do OpenClaw (processo, papel atual, task, sessão, tentativas, fases e resultado), distinta de `registro.md`.
3. Pré-condições e pós-condições de cada papel, validação das evidências em disco e regras de transição oficiais; nada avança por declaração não comprovada do modelo.
4. Regra de **um Pi ativo por vez**, encerramento verificado antes de abrir a sessão seguinte e retomada/restart seguros.
5. Gates de aprovação, interrupção, permissões e orçamento; uma falha técnica local antes dos commits pode ter **uma tentativa automática adicional**, respeitando o baseline e alterações do usuário. Ações após commits/integração não admitem rollback cego.
6. Como carregar seletivamente task e fontes pertinentes, e como produzir/habilitar fase 1 e fase 2 da revisão sem afirmar isolamento forte.
7. Interface/limites da ponte Node.js: não confundir prova HTTP local com arquitetura definitiva; avaliar API controlada, canal local e execução Windows segura sem `DEP0190`.

**Entrega:** especificação Markdown curta e verificável do contrato + critérios de aceite e casos de erro. Não implementar orquestrador genérico.

### Etapa B — Ciclo de uma task realista, em projeto descartável

OpenClaw despacha **implementador → revisor → (corretor → revisor, se necessário)** em sessões separadas e sequenciais. Preservar revisão em duas fases e avaliações persistidas. O OpenClaw confere arquivos/resultados e opera transições por regras; scripts `review_inputs.py`/`update_registro.py` devem ser auditados antes de adaptação. Testar gates de bloqueio e limites, sem manipular repositórios importantes e sem introduzir paralelismo.

### Etapa C — Git Gateway mínimo (após o ciclo de task funcionar)

Especificar e implementar operações Git restritas, validação de baseline/refs/autorizações e dois commits oficiais; integrar por fast-forward, sem squash, primeiro em repositório descartável. Sincronização remota só depois de task aprovada; `main` apenas após homologação/autorização humana. Não delegar credenciais amplas nem Git arbitrário a agentes.

### Etapas posteriores (não agora)

Automatizar várias tasks sequenciais de um marco, homologação do marco e feedback/reprovação; expansão para `plan`, `docs`, `grill-me`; orçamento/modelos; isolamento forte de arquivos/credenciais; monitoramento/operacionalização mais robusta.

## 10. Regras para não perder na retomada

- **Sem mexer em `plan` e `implement` agora**; antes auditar a versão real e formalizar contratos necessários. Adaptação posterior, mínima e testada.
- **Uma task por vez e um processo Pi por vez**; sessões novas por papel, sem compartilhar histórico de chat.
- **Não confundir saída `0`, `prompt accepted` ou `abort success` com conclusão da task.** Usar resultado estruturado + evidências + validação programática.
- **OpenClaw controla transições e permissões; Pi produz evidências.** `registro.md` não pode ser alterado por declaração do agente.
- **Duas fases de revisão; achados obrigatórios param a conclusão**; exposição efetiva de relatórios fase 1 interrompe fluxo, mesmo que o isolamento forte tenha sido adiado.
- **Requisito/escopo, homologação e integração na `main` exigem humano.**
- **Não implementar agora paralelismo, Git Gateway completo, automação de marco inteiro ou soluções de segurança que não sejam necessárias ao MVP experimental.**

## 11. Referências

- Fonte conceitual do projeto: [contexto consolidado](../explanation/contexto-projeto-automacao-workflow-atualizado.md).
- Arquivo de decisões mencionado naquela fonte: [decisões de workflow](../explanation/decisoes-workflow-automacao-2026-11-12.md) (não estava disponível como arquivo independente nesta prova; confirmar acesso antes de auditoria fina).
- Repositório das skills: <https://github.com/luthiano0312/my-skills>.
- Documentação do Pi RPC: <https://docs.pi.dev/latest/rpc>.
- Extensão `pi-file-permissions`: <https://github.com/ross-jill-ws/pi-file-permissions>.
- Documentação OpenClaw: <https://docs.openclaw.ai/>.
- Evidências detalhadas: saídas dos experimentos transcritas nesta conversa; logs e scripts locais do computador de teste.
