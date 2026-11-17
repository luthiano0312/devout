# Revisão M01-T02 — rodada 1
Estado: finalizada
Snapshot da entrega: 0de5f71304ca2274dc9e4483575b995bce4f2c40ac3cba942f14db1d5ace18b1
Entrada: 56645f2a9b51adee91f0b17d98c062944e514e62ecc87dd2ecb995956f0620d1; revisão Git: eacc45687461b4d13eaac3b73ecce4b729624bc4
Configuração: `docs_devout/03-execucao/fontes-revisao.json`; SHA-256: 9c8a2a1ae246264ffb6b7c95a633d5eaa111fb041de4bf14671bd0eb5bfbd0cd

## Avaliação independente

### Entrada e gates

- Preparador executado antes de documentos mistos/diffs irrestritos; entrada integral persistida fora do repositório em `C:/Users/User/AppData/Local/Temp/devout-M01-T02-review-lKIiRR.json`. Atualidade reconfirmada com `--check-input` antes desta gravação (exit 0).
- Task completa e restrições recebidas pelo filtro. Estado `aguardando revisão`, sem revisões anteriores identificadas: rodada R1. Branch `feat/M01-T02`, coerente com a convenção de task; nenhuma troca de branch.
- Dependência M01-T01 `concluída`: commit funcional `011a984cc0b0780368386f300708506b5e545498` e commit de metadados `eacc45687461b4d13eaac3b73ecce4b729624bc4` presentes e ancestrais de HEAD. Relatório e R1 dessa dependência presentes na árvore versionada, sem leitura antecipada de seus conteúdos. Baseline `c771c4b` identificado no histórico; plano, registro e mapa rastreados.
- Examinados diffs filtrados HEAD/staged/unstaged e conteúdo dos seis arquivos novos permitidos. Index sem alterações. Não houve exposição efetiva antecipada a conclusões dos relatos. Fontes/guias adiados ainda pendentes de confronto.

### Manifesto das fontes (SHA-256 dos bytes integrais)

| Caminho | SHA-256 |
|---|---|
| `docs_devout/plano.md` | `6635ce06458f0c93569dd5e20c0ffadfd894a30285662468898510a208573e91` |
| `AGENTS.md` | `4b648d001fb31b193952ff9f5db7a7a086831b1ce6ecdf52dcca9eaf48e0578c` |
| `docs_devout/02-design/contrato-orquestracao-mvp.md` | `34845bd0154612091c44d969216e488679fcd6184958c124a73b7b14aebb63dd` |
| `docs_devout/reference/01-registro-integracao-openclaw-pi-e-decisoes.md` | `a4855eacf2083f3eed1d563507f3560baeea9facab21a52cbe349d069f18903a` |
| `docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md` | `31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6` |
| `docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md` | `8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8` |
| `docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md` | `306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018` |
| `docs_devout/how-to/diagnosticar-ambiente-windows.md` | `85d0e049136eb8ba35cb073e0c043fe29cc9eaea5979f86bbfff6bff8972b562` |
| `src/README.md` | `bd83628cb1b79b29f5d2d332ec68e5a60cfe32268258b4ad42f4d3d98b028254` |
| `prototipo/prova-integracao-openclaw-pi/probe-pi-rpc.mjs` | `47e7c81ecaab144482c976fbaabf1a1e924fc4f2b78963b4298b0350a0776d84` |
| `prototipo/prova-integracao-openclaw-pi/experimento-integracao-openclaw-pi.md` | `43d38a9c7bfe82cc72848f40a3cab619a88e0609a09a7f3ae1bc6e332aa2ba21` |
| `prototipo/prova-pi-eventos-rpc-v2/pi-rpc-eventos.mjs` | `d51acfced0bc0168540dfe9291629ab3dc859ad60270f4603228fce33b367461` |
| `prototipo/prova-pi-eventos-rpc-v2/README.md` | `1af6923df71cae73a9e96cd1e442ba92c928433ee66883b47cd1fd311d4a66d6` |
| `prototipo/teste-cancelamento-pi/pi-rpc-abort.mjs` | `f074f1752ba7c869b0a20e917305fbe5c9065b2e791d256fab700b7488580abc` |
| `prototipo/teste-cancelamento-pi/README.md` | `e4ae6ddb7177a647302c33a77934ae00578571e16a4db5a930b2609f07ad3f98` |

Hashes dos diffs das fontes: HEAD/unstaged `184ced5b4f9af2f4c049a0c03fc0c5f9a41088f51780ae83b2da830c694446c7`; staged `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

### Inspeção técnica e checklist

- `src/pi-driver.mjs`: estados starting/running/stopping/terminated/uncertain; `shutdown()` e `cancel()` idempotentes; recusa término normal com trabalho ativo; bloqueio de novos comandos durante stopping; abort com prazo; EOF; fallback; verificação conjunta de Job vazio, raiz encerrada e eventos exit/close. `canRelease` é separado de `workCompleted` e falhas de transporte/modelo.
- `src/pi-host.mjs`, `src/windows-process-tree.mjs` e `.ps1`: gate de lançamento sem Pi antes da vinculação; Job Object sem breakaway/kill-on-close; handle da raiz retido; imagem, criação, pai e IPC conferidos na preparação; inventário kernel acompanha gerações intermediárias. Fallback revalida raiz viva e membros da árvore de parent PIDs pertencentes ao Job, mantendo handles durante taskkill; resultado textual/exit code não substitui consulta posterior. Raiz morta com sobreviventes e observação/identidade ambígua resultam em uncertain, sem force inseguro.
- Entregável 1: interface e diagnóstico reutilizáveis presentes; nenhum Runner ou gate oficial antecipado.
- Entregável 2: fixtures, testes de lifecycle e smoke de abort real presentes. Evidência própria abaixo cobre encerramento normal, abort, rejeição/silêncio de abort, timeout, EOF, JSON inválido, saída anormal, fallback multigeração, repetição e sentinela alheia preservada. Documentação e evidências anteriores serão confrontadas na fase 2.
- Não alterar — nunca matar por PID antigo/alvo não verificado: atendido pela retenção de handles, Job, validação antes do taskkill e recusa de raiz desaparecida/identidade incerta. Testes negativos simulados não chamam force; teste Windows comprova sentinela preservada.
- Não alterar — sem reinício automático, recuperação Git ou avanço por exitCode=0: atendido. Código não contém essas operações; testes distinguem término físico de resultado funcional e incerteza mantém `canRelease=false`. Exclusividade global continua sendo M01-T03, não promessa desta entrega.
- Limites comuns: implementação em `src/`, sem Docker/WSL/HTTP permanente/framework, sem argumentos variáveis em shell:true; helpers são privados e temporários. Testes reais em workspaces descartáveis, perfil isolated e sem ferramentas. Não foram modificados código, index ou protótipos pelo revisor.

### Validação própria em Windows nativo (2026-11-17; Node v24.20.0)

1. `npm.cmd --prefix src test`: **48/48 passaram**, zero skips/falhas; cerca de 25 s. Inclui regressão do transporte.
   - Normal: raiz PID 10404, criação `134394131394494369`, 4 identidades observadas; `forced=false`, `workCompleted=true`, inspeção CIM sem remanescentes.
   - Abort ativo: raiz 1388; `abortAccepted=true`, sem force, `workCompleted=false`, término comprovado.
   - Resistente multigeração: raiz 6272, criação `134394131429856046`; PIDs observados 6272, 3712, 10520, 6284, 12732, 3876; `forced=true`, taskkill exit 0, CIM independente 0, `canRelease=true`; chamadas repetidas não atingiram sentinela. `failureCode=PROCESS_EXIT` não foi confundido com conclusão funcional.
   - JSON inválido resistente: taskkill exit 255, porém Job vazio + exit/close + CIM independente 0 comprovaram término; `workCompleted=false`, falha preservada. Confirma separação entre exit do comando e prova de ausência.
2. `npm.cmd --prefix src run test:cancel`: **pass=true** às 18:19:46Z. Pi real: prompt aceito, ativo no cancelamento, abort aceito, settled observado, sem force, exit 0, `terminated`, `canRelease=true`. Raiz 13896/criação `134394131860415963`; PIDs observados 13896, 13268, 12180, 13844, 3876; CIM independente: 0 remanescentes.
3. `npm.cmd --prefix src run test:smoke`: **pass=true** às 18:19:49Z; get_state correlacionado, marker correto, settled não abortado, stdin aberto até settled; sem erro de assistente/DEP0190, término normal, exit 0, ausência comprovada (5 processos observados).
4. `review_inputs.py ... --check-input <entrada>`: **exit 0**, identidade e snapshot inalterados após testes.

### Achados e conclusão preliminar

**Nenhum bloqueador ou importante identificado na inspeção independente.** Critério técnico reproduzido no Windows: Pi real abortado e encerrado; árvore descartável resistente terminada com fallback; repetição segura e falha fechada quando identidade/árvore é ambígua. Cobertura parcial T07 apenas; não comprova Runner assíncrono, trava global nem workflow completo. Aprovação permanece condicionada ao confronto documental/narrativo e à atualidade da entrega.

## Confronto com relatos

Fase 2 iniciada somente após persistir a avaliação independente acima, que permanece intacta.

- Lidos integralmente o relatório M01-T02 (incluindo a atualização preparatória autorizada), o README, registro/Observações, configuração e todos os 17 recortes adiados. Incluídas as seis fontes de protótipos, referência de integração, contexto/consequências dos ADRs, trechos adiados do contrato/plano e guia de diagnóstico. Protótipos apenas consultados, sem execução ou alteração.
- Conferidos todos os caminhos de inventory/deferred_changed e os diffs HEAD/staged/unstaged das fontes/configuração/registro. Staged vazio; demais fontes e protótipos sem diff. Arquivos novos de produção/testes e relatório foram lidos pelo conteúdo, sem staging. A revisão ora criada é a única narrativa adicional do revisor.
- Relatório da implementação e revisão finalizada da dependência M01-T01 consultados agora: entrega aprovada e commits confirmados no histórico. Não existem revisões anteriores da M01-T02 nem seções de correção: **zero correções completas**. Iterações de diagnóstico da implementação não são correções do workflow.
- As alegações técnicas da M01-T02 correspondem ao código e às provas próprias: suíte 48/48, Pi real abortado enquanto ativo, encerramento normal, fallback seguro da árvore resistente, sentinela preservada e inspeção independente sem remanescentes. Não se reutilizaram PIDs históricos para agir sobre processos.
- O relatório explicita falhas intermediárias de acesso/conhost e execuções diagnósticas que não comprovaram término. Não são usadas como evidência positiva: a aprovação se apoia na inspeção atual e nos testes reproduzidos nesta revisão. As provas finais posteriores são compatíveis com o tratamento conservador hoje implementado.
- README examinado integralmente: interface/resultado, prazos configuráveis e limites adicionais de 15/25/30 s documentados; `closeInput` e `closed` não prometem prova de árvore; não há promessa de sandbox, trava global ou Runner pronto. O uso de helper/host privados e temporários não introduz serviço residente ou IPC genérico de workflow.
- Preparação separada identificada pelo relato autorizado: AGENTS atualiza apenas o mapa da revisão; o plano troca somente os quatro rótulos Markdown da M01-T02; JSON adiciona M01-T02 e preserva integralmente o objeto M01-T01. Comparações automatizadas com HEAD confirmaram ambos os últimos pontos. Uma comparação auxiliar inicialmente usou a codificação padrão do Windows e falhou; refeita com UTF-8 explícito, passou, sem qualquer alteração nos arquivos. A partição das fontes e a classificação initial/deferred foram confrontadas com os conteúdos, sem achado de exposição antecipada.
- Registro mantém as seis colunas e somente a linha da M01-T02 mudou. A nota histórica de revisão pendente será preservada e complementada pelo resultado atual, sem apagar o handoff. Preparação de seleção está no pacote auditado, mas não houve decisão de staging/commit nesta revisão.
- Dívida documental preexistente **O1 da revisão M01-T01** continua: `docs_devout/how-to/diagnosticar-ambiente-windows.md` ainda afirma baseline/testes pendentes. O Git, AGENTS e `src/README.md` permitem verificar as condições reais. Melhoria opcional já registrada, sem novo bloqueio ou obrigação de correção nesta task; o documento não foi alterado pela M01-T02.
- Ferramentas reconferidas: npm 11.19.0, Pi 1.5.2, OpenClaw 2026.11.3 (847611d). Consulta CIM posterior dos hosts/fixtures/smokes desta entrega: `DisposableDriverProcessesRemaining=0`.
- `git diff --check` passou. `--check-input` passou novamente após a avaliação persistida e a inspeção narrativa, com a mesma entrada/snapshot/HEAD/hashes/index.

O confronto confirma a conclusão preliminar; nenhum bloqueador/importante adicional ou violação dos limites da task encontrado.

## Decisão final

**APROVAÇÃO TÉCNICA da M01-T02 — R1.**

- Bloqueadores: **0**. Importantes: **0**. Nenhuma melhoria opcional nova; permanece a dívida documental O1 herdada da M01-T01, descrita acima.
- Correções completas: **0**. Não abrir correção.
- Fazer, Não alterar, ambos os Entregáveis e Critério de conclusão atendidos para a camada Driver: lifecycle/interface/diagnóstico e prazos documentados; **48/48 testes sem skips**, smoke normal real e **abort real com término verificado** reproduzidos no Windows; fallback da árvore resistente confirmado por Job/CIM; idempotência e incerteza sem liberação indevida.
- Aprovação limitada ao snapshot/fontes identificados no cabeçalho. T07 é parcial: não aprova trava global, Role Runner assíncrono, transições oficiais, reinício/Git automático ou isolamento forte.
- Manter `aguardando revisão` e acrescentar aprovação/vínculo desta R1 às Observações via `update_registro.py`, preservando notas e timestamp da última mudança de status.
- **Aguardando autorização explícita dos dois commits** (funcional e metadados). Não houve staging, commit, merge, push, troca de branch ou modificação do código pelo revisor. A task não está oficialmente concluída e M01-T03 não está liberada.

### Autorização posterior e preparação dos commits

Após a publicação da aprovação e do pedido de autorização dos dois commits, o usuário respondeu “autorizo”. Serão realizados o commit funcional da entrega auditada (incluindo preparação documental/seleção, relatório e esta revisão) e, em seguida, o commit exclusivo do registro. Isso não autoriza merge, push, troca de branch nem execução da próxima task.

Antes de staging, `--check-input` confirmou novamente a entrada e o snapshot originais. Relatório, revisão e registro foram relidos; inventário, branch e whitespace reconferidos. Não houve mudança técnica ou de requisitos após a aprovação. A avaliação independente permanece intacta; esta nota é documental posterior.

Após staging explícito dos 16 arquivos da entrega (sem `registro.md`), a entrada passou a `325ecec27a17e9e07485ff1d3abee61a531e5e19b2aafc35950ad5a7d8e51dd1`, snapshot `a772fca8da26bfdf3242be17c56e4368bb1c5f5b3080a15fa03b7592d7bcd5cb`. A mudança foi reconciliada: arquivos novos passaram a adições no index e os hunks rastreados passaram de unstaged a staged. HEAD, configuração e hashes integrais das fontes permaneceram iguais. Cada blob staged foi comparado ao worktree já auditado, com normalização LF/CRLF, e a lista exata de arquivos foi validada. Nenhuma mudança técnica ou de requisito; apenas esta anotação narrativa adicional antes do commit.
