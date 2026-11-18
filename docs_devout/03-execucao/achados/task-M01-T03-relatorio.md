# M01-T03 — Relatório da implementação inicial

**Natureza:** relato do implementador, não aprovação técnica nem revisão independente.  
**Data:** 2026-11-18.  
**Branch:** `feat/M01-T03-exclusividade-pi`, criada com autorização explícita do usuário.  
**HEAD de entrada:** `fbde012df9dfd069478172d431fd22503d913de3`.  
**Commits desta task:** nenhum; implementação aguarda revisão em conversa nova.

## Gates de entrada

- Task M01-T03 lida integralmente em `docs_devout/plano.md`; quatro campos presentes,
  estado inicial `não iniciada` e dependência obrigatória M01-T02.
- Baseline: `AGENTS.md`, plano e registro rastreados/commitados, sem mudanças pendentes;
  checkout inicialmente limpo. Baseline documental `c771c4b` presente no histórico.
- Dependência M01-T02 concluída: commit funcional
  `9c6e88c534e47f95c4c42c72c3797d40631710d1` e commit de metadados
  `fbde012df9dfd069478172d431fd22503d913de3`, ambos ancestrais do HEAD.
- A implementação não alterou `main`. A solicitação inicial foi interrompida antes
  de alterações para confirmar a branch; o usuário autorizou sua criação/uso.
- Fontes pertinentes: task/limites globais do plano, contrato MVP v1.0 §§5.1–5.3/T08,
  ADRs ativos 0001–0003, instruções de implementação, diagnóstico Windows e interfaces
  existentes do Driver/observador T02. Não se trata de uma avaliação independente.
- Estado atualizado exclusivamente com `update_registro.py`, após validação dos gates.

## Arquivos

| Arquivo | Alteração |
| --- | --- |
| `src/pi-lock.mjs` | Aquisição, lease com lançamento vinculado ao Driver, término verificado, inspeção e reconciliação explícita |
| `src/windows-lock-guard.mjs` | Canal privado limitado com helper Windows, timeouts/fechamento e erros sanitizados |
| `src/windows-lock-guard.ps1` | FileStream exclusivo, identidade nativa de owner e GUID de boot/máquina; nenhuma operação de kill |
| `src/test/pi-lock.test.mjs` | 15 testes determinísticos + 4 integrações Windows com processos reais |
| `src/test/fixtures/lock-worker.mjs` | Node independente para barreira de aquisição, Pi falso e crash do proprietário |
| `src/PI-LOCK.md` | Interface, escopo global, persistência, diagnóstico, procedimento/provas e limites de reconciliação |
| `src/README.md` | Link da interface/procedimento e distinção entre Driver direto e fluxo protegido |
| `docs_devout/03-execucao/registro.md` | Estados da execução manual, via script oficial |
| Este relatório | Evidências da implementação inicial |

Não alterados: Driver T01/T02 e seu observador/host, protótipos, skills/configuração
de revisão, contrato, plano, ADRs ou requisitos. Sem dependências novas.

## Implementação

- Raiz global padrão externa ao repositório, por conta/orquestrador Windows,
  compartilhada por todas as tasks/workspaces. Configuração alternativa deve ser
  fixa e confiável; não deve ser uma raiz por run nem um escape para bloqueios.
- Exclusão realmente atômica por abertura nativa `FileShare.None` do arquivo estável
  `guard`, mantida pelo helper temporário. A existência do arquivo não é prova de
  vida/término. Perda do processo libera o handle, não a lease persistida.
- `lease.json` registra token UUID, runId, PID/criação FILETIME/imagem do proprietário,
  identidade de boot/máquina, fase e identidade do host Pi quando disponível.
  Criação exclusiva `wx` + flush; atualização por temporário + flush + rename no
  mesmo diretório/volume. Truncamento/erro de observação bloqueia.
- `lease.launch` grava intenção antes de qualquer chamada de spawn do Driver,
  permite somente um lançamento e não aceita segunda sessão na mesma lease.
  Falha de criação/ready não apaga automaticamente essa intenção.
- `lease.finish` usa o Driver vinculado e exige identidade correspondente,
  `state=terminated`, `canRelease=true` e `processesGone=true`. Não recebe booleano
  avulso do consumidor. Grava recibo antes de arquivar e preserva o bloqueio em erro.
  Liberação sem lançamento registra explicitamente essa condição.
- Inspeção não modifica/remove lease; reconciliação exige token esperado e nova
  prova sob o mesmo guard. Dois reconciliadores não podem retirar duas leases.
  Arquivamento preserva metadados em `retired-<token>.json`, sem retomada de task.
- Morte/PID reutilizado do owner não prova árvore encerrada. Recuperação aceita
  proprietário comprovadamente ausente antes de intenção de lançamento, recibo
  durável de término, ou novo boot de kernel da mesma máquina. Owner vivo,
  acesso incerto, registro corrompido e árvore sem prova continuam bloqueados.

## Testes e resultados

Ambiente Windows nativo: Node `v24.20.0`, npm `11.19.0`, OpenClaw
`2026.11.3 (847611d)`, Pi `1.5.2`. Versões consultadas com os comandos de diagnóstico;
nenhum Gateway, provedor, Pi real ou alteração de política foi necessário nesta task.

| Comando | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 src/test/pi-lock.test.mjs` | 18/18 na primeira execução bem-sucedida da suíte nova; posteriormente ampliada para 19 casos |
| `npm.cmd --prefix src test` | 67/67, zero falhas/skips; repetido após os ajustes finais com o mesmo resultado (~52 s) |
| `git diff --check` | Sem erros |
| `git merge-base --is-ancestor <commit-dependência> HEAD` | Funcional e metadados da T02 confirmados |

A primeira tentativa dos testes novos passou na política determinística e falhou
na integração Windows por codificação de caminhos Unicode no stdin do helper.
A causa foi isolada e corrigida configurando explicitamente Console Input/Output
como UTF-8. As execuções subsequentes, inclusive a suíte completa repetida, passaram
com raízes temporárias contendo espaços e Unicode.

### Critérios/entregáveis exercitados

- **T08, aquisição inicial concorrente:** barreira com três Node independentes;
  exatamente **1** aquisição com Pi falso e **2** recusas antes de lançamento.
  Diagnóstico: `contenders=3`, `authorized=1`, `duplicateFakePiLaunches=0`.
- **Próxima execução após prova:** vencedor chama término gerenciado da T02;
  verifica-se ausência dos PIDs fictícios via CIM, e outro Node consegue adquirir,
  lançar e encerrar seu Pi falso. `nextAfterVerifiedExit=true`.
- **Crash antes de lançar:** morte real do owner deixa lease bloqueando aquisição;
  inspeção confirma owner morto e ausência de intenção. Duas reconciliações
  concorrentes produzem uma única recuperação; não há limpeza automática.
- **Crash após lançar:** morte real do Node proprietário de Pi falso preserva
  `running`; mesmo após a saída observada dos processos conhecidos, módulo recusa
  nova sessão e reconciliação sem prova completa da árvore perdida.
- **Identidade nativa:** owner atual vivo é recusado; criação incompatível no mesmo
  PID é identificada como reutilização, sem enviar sinais ao processo atual.
- **Política determinística:** owner vivo/desconhecido, PID reutilizado com árvore
  lançada, resultado incerto, exit/success sem árvore ausente, identidade divergente,
  perda de guard, metadados truncados, crash com recibo durável, token antigo,
  boot de outra máquina, novo boot da mesma máquina, idempotência, cópia de metadados,
  intenção durável e finish sem ultrapassar lançamento pendente.
- Módulo e procedimento de reconciliação entregues em `src/pi-lock.mjs` e
  `src/PI-LOCK.md`; testes são incluídos pelo glob já existente de `npm test`.

Artefatos operacionais ficam em diretórios temporários externos ao Git. Os testes
Windows novos preservam workspace em falha para diagnóstico; em sucesso, só limpam
a fixture isolada depois de comprovar seu término/ausência. A limpeza da fixture
não representa reconciliação de produção nem autoriza outro Pi do workflow.

## Limites e pendências

- Não houve reboot real. A leitura nativa do GUID atual de boot/máquina foi usada
  nas integrações; mudança de boot e máquina foi exercitada apenas por costura
  determinística. Não declarar validação de reinicialização física do host.
- Após crash de lançamento/árvore sem recibo durável, a recuperação automatizável
  no mesmo boot permanece bloqueada. Procedimento conservador documentado: preservar
  diagnóstico, combinar reboot real com o operador e reconciliar explicitamente
  após comprovar novo boot da mesma máquina. Nenhum reboot é executado pelo módulo.
- Metadados corrompidos/identidade de máquina incompatível não têm bypass automático;
  investigação humana é obrigatória. Suportado filesystem Windows local e raiz
  confiável; não é isolamento contra manipulação hostil, compartilhamento remoto,
  corrupção ou restauração de VM.
- `finish` é operação final/idempotente. Erros preservam a lease e fecham o guard;
  consumidores devem chamar `cancel:true` se houver trabalho ainda ativo. Não há
  tentativa automática de nova sessão ou repetição de matança.
- Driver e smokes anteriores não são interceptados implicitamente. A integração
  obrigatória com o Role Runner será M01-T04; não foi antecipada nesta task.
- Sem atualização de registro/commits pelo orquestrador. As mudanças neste registro
  são do workflow manual autorizado de implementação.
- **Revisão independente pendente em conversa nova.** A configuração de fontes
  atualmente não tem seleção autorizada para M01-T03; preparar o recorte mediante
  autorização antes de iniciar o revisor, sem fallback para documentos mistos inteiros.
  Nenhuma configuração foi ampliada por iniciativa desta implementação.
- Nenhuma aprovação de revisão, commit ou liberação para M01-T04 é declarada aqui.

## Preparação posterior das entradas de revisão — autorizada pelo usuário

Em 2026-11-18, após a entrega acima, o usuário autorizou preparar a seleção de
fontes. Esta seção resolve a pendência de configuração registrada no relato inicial;
**não é avaliação independente, revisão ou autorização de commits**.

- `docs_devout/03-execucao/fontes-revisao.json`: acrescentada somente M01-T03;
  seleções M01-T01/M01-T02 preservadas semanticamente, conferidas contra HEAD.
- `docs_devout/plano.md`: os quatro rótulos da M01-T03 passaram de negrito para
  subtítulos Markdown, necessários ao preparador. Comparação automatizada confirmou
  que esse é o único delta do plano; nenhum requisito, ID ou dependência mudou.
- `AGENTS.md`: mapa e comando de entrada atualizados para incluir M01-T03, com
  adiamento integral de `src/README.md` e `src/PI-LOCK.md` nessa seleção.
- Recorte inicial: task completa, restrições comuns, decisões normativas do contrato,
  ADRs e decisão de exclusividade da referência citada pela task. As outras tasks,
  os guias da implementação, diagnósticos mistos, evidências históricas e protótipos
  ficam adiados. Código/testes novos permanecem disponíveis à avaliação inicial.
  Relato/Observações são filtrados pelo preparador; exame final de todo o material
  adiado e dos diffs continua obrigatório após persistir a avaliação inicial.
- As três seleções passaram em `review_inputs.py --sources` e `--check-input`.
  Também foram verificados adiamento dos guias (inclusive o novo `src/PI-LOCK.md`),
  disponibilidade dos cinco arquivos novos de código/teste e rejeição de uma
  entrada artificialmente desatualizada (exit 2, sem JSON).
- JSONs gerados persistidos exclusivamente fora do repositório em
  `%TEMP%\devout-preparacao-revisao-M01-T03-071uxe70\`; não versionados. A entrada
  da T03 é `M01-T03-entrada.json`, com 16 fontes e 19 seções adiadas.
- Identificação da validação da preparação (não usar como avaliação do revisor):
  - `input_id`: `7e879609d6d98ed47fdf23b14cd8b36ee8c0c69c36e7cf20505af0a3a3420006`
  - `git_revision`: `fbde012df9dfd069478172d431fd22503d913de3`
  - `snapshot`: `28ea038284d563b7e181c67ded32e6aa0dc7d3e1fa5eddfdba03e5b891c5c38d`
  - configuração SHA-256: `9c4480836f635653895007d853d6fc63b58fb1adfe42f32acfada2644a73700b`

A próxima conversa deve assumir o papel de revisor e gerar sua própria entrada
atualizada antes de ler relatos, Observações ou materiais adiados. O status continua
`aguardando revisão`; nenhum código foi alterado por esta preparação e nenhum
commit foi feito.
