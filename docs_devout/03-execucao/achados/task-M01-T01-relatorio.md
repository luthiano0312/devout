# M01-T01 — Relatório da implementação inicial

**Papel:** implementador. **Resultado declarado:** implementação preparada para revisão; não é aprovação técnica nem conclusão oficial.

## Entrada e baseline

- Task consumida: `docs_devout/plano.md`, seção completa M01-T01 e restrições/pré-condições comuns. Sem dependências obrigatórias.
- Registro inicial válido, seis colunas, M01-T01 `não iniciada`; demais tasks preservadas.
- Baseline de plano, registro e mapa confirmado no commit `c771c4b39a34716f15728c1e0d5b2596e776bc41`, ancestral de HEAD `0d1d049427d5dacbd18bbc4f41599ff032a035d9`. Três arquivos rastreados/commitados e checkout inicialmente limpo.
- Branch `feat/m01-t01-pi-driver` criada após autorização explícita do usuário; nenhuma implementação na `main`. Nenhum commit/staging feito nesta conversa.
- Início administrativo por `update_registro.py`: `em andamento` em `2026-11-17T17:07:22+00:00`.
- Não há outro plano/registro de projeto no checkout; `src/` não existia. Fontes curadas presentes nos caminhos aprovados.

## Arquivos entregues/alterados

| Arquivo | Conteúdo |
| --- | --- |
| `src/pi-driver.mjs` | Lançamento Windows, transporte JSONL, correlação, eventos, prazos, limites e observação de settlement. |
| `src/package.json` | Projeto Node sem dependências externas; scripts `test` e `test:smoke`. |
| `src/test/fixtures/fake-rpc.mjs` | Processo RPC falso com cenários determinísticos, sem ferramentas/rede. |
| `src/test/pi-driver.test.mjs` | 33 testes automatizados, incluindo launcher `.cmd` em caminho com espaços/Unicode. |
| `src/test/smoke-pi.mjs` | Smoke opt-in com Pi real em workspace temporário e evidência sanitizada; observação/limpeza dos processos de teste. |
| `src/README.md` | Interface mínima, exemplos, tratamento de erros, limites, segurança, roteiro reproduzível e referência à evidência. |
| `AGENTS.md` | Mapa de `src/` atualizado e comandos reais após validação, conforme instrução do próprio arquivo. |
| `docs_devout/03-execucao/registro.md` | Apenas estado administrativo da M01-T01, via script da skill; o Driver não lê/altera o registro. |
| Este relatório | Evidências e limites da implementação inicial para a próxima conversa. |

## Implementação

- `startPi` inicia `pi.cmd --mode rpc --no-session` por `cmd.exe` explícito com `shell:false`, `/d /s /v:off /c` e `windowsVerbatimArguments:true`. Não tenta executar `.cmd` como binário nativo, nem reaproveita o `shell:true` dos experimentos.
- Somente dois comandos CLI literais (perfis `default`/`isolated`). Caminho confiável do launcher em variável de ambiente entre aspas, validado como absoluto, existente e sem metacaracteres; nenhum argumento CLI extra. Prompts/dados variáveis trafegam apenas no stdin JSONL.
- Entrada incremental por bytes, LF/CRLF, UTF-8 dividido entre chunks, U+2028/2029 preservados e múltiplos registros por chunk. Limite aplicado antes do parse, inclusive a uma linha completa excessiva. Nenhum histórico acumulado.
- UUID por comando, resposta validada contra `id`/alias `requestId` e comando esperado; eventos, respostas desconhecidas e stderr separados. Fila limitada e escrita com espera por `drain`.
- `getState`, `prompt` (somente aceitação), `command` e `promptAndWait` documentados. Observador instalado antes de enviar o prompt; exige `started` e recebe aceitação/settlement em qualquer ordem. Não libera resultado por `agent_end`, aceitação ou código de saída. Erro/aborto do assistente permanece sinalizado no resultado observado.
- Timeout de comando/settlement, parse/UTF-8 inválido, EOF truncado/antecipado e falha de processo/pipes invalidam o transporte e rejeitam pendências, solicitando EOF ordenado. Não há retry automático ou falso sucesso silencioso.
- Resultado observado do prompt não é aprovação de task. `closed` informa o processo, separadamente de `agent_settled` e do resultado técnico.

## Fontes e experimentos consultados

- Contrato MVP v1.0, especialmente responsabilidades e inicialização RPC (seções 1–4); ADRs ativos 0001–0003; registro curado da integração, seções de RPC, segurança/E14 e caminhos.
- Inventário de todos os scripts `.mjs` de `prototipo/`: identificados `shell:true`, caminhos locais e ponte HTTP/portas históricas. Leitura seletiva de `prova-integracao-openclaw-pi/probe-pi-rpc.mjs` e `prova-pi-eventos-rpc-v2/pi-rpc-eventos.mjs`.
- Reaproveitados conceitos de correlação JSONL, stdin persistente até settlement e separação de diagnóstico. Não copiado o servidor HTTP, o lançamento problemático ou o encerramento do protótipo como código definitivo.
- Documentação instalada do Pi 1.5.2: `docs/rpc.md` e seções pertinentes de `docs/rpc-commands.md`/`docs/json.md`, além de `pi.cmd --help`. Launcher local `pi.cmd`/`pi-launcher.js` inspecionado para compreender o wrapper e seus descendentes. Não se presumiu que `latest` descrevesse a instalação local.
- Protótipos, skills, contrato, plano e arquivos `.pi` existentes não foram modificados.

## Comandos e resultados

Executados em Windows nativo, a partir da raiz do repositório:

| Comando | Resultado |
| --- | --- |
| `node --version` | `v24.20.0` |
| `npm.cmd --version` | `11.19.0` |
| `openclaw.cmd --version` | `2026.11.3 (847611d)`; Gateway não necessário nesta task. |
| `pi.cmd --version` | `1.5.2` |
| `Get-Command pi.cmd` em PowerShell | Launcher encontrado em `%USERPROFILE%\.pi\agent\bin\pi.cmd`. |
| `npm.cmd --prefix src test` | Última execução: **33/33 passaram**, zero falhas/cancelamentos/skips, aproximadamente 4,66 s. |
| `npm.cmd --prefix src run test:smoke` | Última execução em `2026-11-17T17:18:31.629Z`: **PASS**, resumo abaixo. |
| `node --check src/pi-driver.mjs` | Passou. |
| `node --check src/test/smoke-pi.mjs` | Passou. |
| `node --check src/test/fixtures/fake-rpc.mjs` | Passou. |
| `git diff --check` | Sem erros de whitespace; Git avisa somente sobre futura normalização LF/CRLF. |

A suíte cobre: correlação fora de ordem; eventos intercalados até com ID de comando; alias `requestId`; fragmentação UTF-8/CRLF; múltiplas mensagens no mesmo bloco; separação stderr; erro RPC e de assistente; aborto; disposição `handled`; observadores/prompts concorrentes recusados; JSON/UTF-8/forma/resposta inválidos; IDs conflitantes/ausentes/desconhecidos; comando incompatível com ID; EOF ocioso, antecipado ou truncado; linha excessiva completa/incompleta; timeout de comando/settlement; `exitCode=0` sem settlement; saída anormal; limites de fila/pendências; backpressure com quatro comandos grandes; erro de spawn; launcher Windows com espaços/Unicode e metacaracteres de prompt apenas no pipe. Filhos fictícios aguardados até `close`.

Na primeira execução intermediária houve 27/28 passes: a asserção do teste de duas execuções reutilizava o booleano de conclusão da primeira na segunda. Foi corrigido o reset da própria asserção; a suíte passou e foi expandida para os 33 cenários finais. Nenhuma falha pendente na suíte final. Três execuções do novo smoke passaram durante a implementação, sequenciais, para validar a primeira versão e as alterações posteriores; nenhum experimento histórico foi reexecutado.

### Evidência sanitizada do smoke final

```json
{
  "at": "2026-11-17T17:18:31.629Z",
  "platform": "win32",
  "node": "v24.20.0",
  "getStateCorrelated": true,
  "promptAccepted": true,
  "settled": true,
  "stdinOpenAtSettled": true,
  "markerMatched": true,
  "assistantError": false,
  "eventCounts": {
    "agent_start": 1,
    "turn_start": 1,
    "message_start": 3,
    "message_end": 3,
    "message_update": 9,
    "turn_end": 1,
    "agent_end": 1,
    "agent_settled": 1
  },
  "diagnosticBytes": 0,
  "dep0190": false,
  "exitCode": 0,
  "forced": false,
  "processesGone": true,
  "observedProcessCount": 4,
  "pass": true
}
```

Quatro identidades observadas na árvore do launcher, conferidas por PID + criação e ausentes após término. Nenhum processo do smoke permaneceu sem diagnóstico; workspace temporário removido após a conferência. Sem ferramentas/MCP/extensões/contexto de projeto; somente estado e prompt inofensivo do marcador. Sem persistência de eventos brutos, mensagens do provedor, credenciais ou histórico de sessão.

## Entregáveis e critério de conclusão

- **Módulo reutilizável/interface mínima:** entregue em `src/pi-driver.mjs`, documentado em `src/README.md`.
- **Testes de parser/transporte:** entregues e executados; resultados acima.
- **Roteiro Pi real/evidência sanitizada:** script opt-in + README + resumo persistido neste relatório.
- **Windows real/get_state correlacionado:** observado no smoke final.
- **Prompt até agent_settled com stdin aberto:** observado, sem erro/aborto, texto conferido em memória; não é declaração de aprovação de uma task.
- **Falhas simuladas sem falso sucesso:** asserções de rejeição/estado e encerramento exercitadas na suíte.
- **Sem processo de teste abandonado sem diagnóstico:** filhos falsos aguardados e árvore real observada ausente ao final; encerramento robusto reutilizável não antecipado.
- **Consulta aos experimentos preservados:** realizada seletivamente, sem edição/cópia integral.

## Limites e pendências

- Encerramento robusto, abort/cancelamento, árvore de processos em produção e timeouts de desligamento pertencem à M01-T02. Aqui o Driver solicita EOF em falha, mas não garante que um Pi ativo termine em prazo limitado. O consumidor precisa supervisionar e reconciliar; `failure` não prova saída. O fallback/observação de árvore existente é apenas proteção do smoke.
- Exclusividade global (T03), Role Runner (T04), solicitação assíncrona de cancelamento (T05) e integração OpenClaw (T06) não implementados. Não iniciar smokes em paralelo ou após processo incerto.
- Não há isolamento forte do Windows; perfis/flags não são sandbox. Uso experimental apenas com dados fictícios; launcher/configuração da conta permanecem confiáveis.
- API de baixo nível permite ao controlador enviar comandos; não deve ser exposta ao modelo como shell/RPC arbitrário. Eventos de execução não têm correlação por prompt: não misturar prompts manuais com `promptAndWait`.
- Sem novos gates de lint/framework/dependências, serviço HTTP/daemon/Named Pipe, lógica de papéis, Git Gateway ou automação do registro no código entregue.
- Revisão independente ainda obrigatória em **conversa nova**, sem herdar este contexto. O mapa atual não aponta uma configuração de fontes para o preparador independente; esta task não cria seleção fora do escopo. O revisor deve obter configuração/recorte explícito conforme a skill antes de ler relatos/documentos mistos.
- Sem commits nesta etapa e sem liberação da próxima task. Os dois commits só após revisão e autorização humana que cubra ambos.
