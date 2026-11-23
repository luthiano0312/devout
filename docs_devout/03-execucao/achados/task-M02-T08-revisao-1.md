# Revisão M02-T08 — rodada 1
Estado: finalizada
Snapshot da entrega: e47025ff4fb4df825f081e950e83f62747944167eb95e2cf5e263c3751f8f1f5
Entrada: 860ef30dd8fc10481ab8649bf3890cc10fa6e10ec8b401dd77ca979b7472a916; revisão Git: cb64e89fdb9f7c9c75741dca91b1adf61d5e82ac.
Configuração: docs_devout/03-execucao/fontes-revisao.json; SHA-256: 3eaed63884697efdbf26847757291bdead1c9f240f25978d8f0a621c1809ec3e.
Entrada integral temporária fora do Git: C:/Users/User/AppData/Local/Temp/devout-M02-T08-review-input.json. Atualidade reconferida com o preparador e `--check-input` antes desta persistência.

## Avaliação independente

### Entrada, gates e escopo

Task completa e fontes selecionadas obtidas pelo preparador antes de relatos, Observações e diffs adiados. Estado permitido: `aguardando revisão`; nenhuma revisão anterior da M02-T08 no inventário: R1. Branch `feat/m02-t08`. Baseline documental `cb64e89` contém plano, registro, mapa, seleção, PI-LOCK e evidência pendente da R2 da M02-T03; mapa/plano/seleção permanecem sem alterações locais. Dependência M01-T03 concluída no metadado filtrado; commits funcional `647a8501f5b7689a1037495bdd1da5b33cbe0d85` e de registro `54d1f0f` presentes e ancestrais de HEAD. Checkpoint M02-T03 não foi tomado como aprovação.

Examinados todos os diffs filtrados e todos os dez arquivos novos permitidos, além do contexto integral de pi-lock, guard JS/PowerShell e testes pertinentes. Mudanças locais do inventário são compatíveis com M02-T08; código M02-T03 já está no checkpoint ancestral e não foi atribuído a esta manutenção. Fontes narrativas e evidência de qualificação/ensaio real ainda aguardam confronto.

### Checklist de Não alterar

1. Identidade/prova incerta: detector restrito a fonte, AMD64, build 19045, máquina e contador canônico; avanço estritamente positivo, sem GUID legado ou relógio como prova; proprietário vivo/desconhecido bloqueia. Testes próprios positivos e negativos passaram. Qualificação física depende de confronto documental posterior.
2. Não apagar lease/trocar raiz/forçar: reconciliação explícita arquiva bytes originais, mantém âncora e prova separada; aquisição não reconcilia automaticamente. Fixtures possuem raízes sintéticas próprias, não iniciam Pi para contornar bloqueio. Não foi encontrada opção force.
3. Sem reboot automático/recuperação operacional: roteiros separam operações manuais; código não reinicia Windows. Não executei reconciliação/ancoragem operacional nem reboot. Testes específicos usam guards/leases sintéticos. A suíte completa encontrou a raiz operacional bloqueada e isso não foi contornado.
4. Papéis/I1/contagens M02-T03: nenhum diff de código de papéis ou de seus achados; runner-cancel só adapta identidade da dependência fictícia. R2 M02-T03 não foi retomada.

### Entregáveis e critério

- Captura nativa, schema 2 e distinção de schema 1 implementados; collector independente concorda com identidade persistida nesta máquina.
- Âncora associa token, hash integral, máquina, kernel, autor e data; checksum e releituras sob guard detectam corrupção e alterações. Reboot anterior à âncora não serve; mesmo kernel permanece bloqueado.
- Testes cobrem legado, token/hash divergentes, prova ausente, owner vivo/incerto, corrupção/concorrência, guard perdido e colisão de arquivo histórico. Originais, âncora e provas preservados nos casos de sucesso.
- Roteiro fim a fim novo tem etapas explícitas prepare/anchor/before-reboot/after-reboot; proíbe alterações de fontes, recuperação operacional e retry cego. Não repeti reboot/S3/hibernação nesta revisão; evidências anteriores só serão examinadas depois desta persistência.
- Documento PI-LOCK e relatório ainda adiados; portanto o critério global ainda não está aprovado.

### Validação própria

- `node --test --test-concurrency=1 src/test/pi-lock-recovery.test.mjs src/test/pi-lock.test.mjs src/test/windows-kernel-candidate.test.mjs`: **84/84 passaram**, zero skips, inclusive guards/processos fictícios reais Windows e paridade nativa. Saída temporária `devout-T08-targeted-tests.txt` fora do Git.
- `node --test --test-name-pattern='uncertain cancelled Driver' src/test/runner-cancel.test.mjs`: **1/1 passou**.
- `npm.cmd --prefix src test`: primeira tentativa interrompida por timeout de 120 s; segunda por timeout de 900 s. A segunda registrou falhas nos testes CLI que exigem raiz operacional livre, sem terminar a suíte. Não declaro suíte completa aprovada nem atribuo essas falhas à manutenção sem confronto. Saídas temporárias `devout-T08-tests.txt` e `devout-T08-tests-full.txt` fora do Git.
- `node src/test/qualify-kernel.mjs prepare`: **falhou**, exit 1, `SYNTHETIC_LEASE_NOT_BLOCKED`; comando não lança Pi nem recupera lease operacional. Preservada a fixture criada; não foi apagada nem editada.
- `git diff --check` nos arquivos de código/testes rastreados alterados: passou.

### Achado preliminar

**I1 — importante: coletor/roteiro de qualificação entregue não consegue preparar sua fixture com o detector final.** Em `src/test/qualify-kernel.mjs:82–93`, `prepareQualification` grava `schema:1` com `boot:guard.boot`. O guard final já retorna fonte nativa; `src/pi-lock.mjs:21–23` recusa schema 1 com `boot.source` definido. A inspeção retorna metadado inválido/sem record e o preparo termina em `SYNTHETIC_LEASE_NOT_BLOCKED`. O roteiro `kernel-qualification-procedure.txt` publica esse comando, mas os testes só verificam raízes inválidas e leitura de candidato, sem exercitar o preparo positivo. A entrega não oferece uma coleta reproduzível a partir do checkout final. Requisito: Fazer/Entregáveis de qualificação e roteiro opt-in Windows, sem confundir fontes/formatos. Recomenda-se tornar a fixture coerente com o formato legado explicitamente sintético, sem alterar política de produção para aceitar formatos mistos, acrescentar regressão do preparo e reconciliar o roteiro com a entrega final. Preservar observações antigas e seus hashes; não exigir novo reboot só para reproduzir esse erro de formato.

Conclusão preliminar: não aprovar antes de resolver I1 e confrontar evidências físicas/relatos. Nenhum defeito de liberação insegura demonstrado nos testes próprios.

### Manifesto SHA-256 das fontes integrais

- docs_devout/plano.md: c26a9281ce1bcb7c2d1d56019e3358e140cbc1135cdf2af49b6ada4772a3f4c3
- AGENTS.md: b2c0c6cf328a7d0458b02bc18d754be2e9a08b37417341dfe4ef3c09f13b6f80
- src/PI-LOCK.md: 035f2c4f8a4e27ca88f6b41ef5346e55f725300c14dcc8b80d79f0280e313b72
- docs_devout/02-design/contrato-orquestracao-mvp.md: 4cf19380d07012be6f67d144acb74ae3e0393e16727c3501083f8f3aa8dbdbd2
- docs_devout/02-design/arquitetura-hld.md: 194a7c6db6ec51b94b671044442e282ab98d69079f6f0fcee2143bbf09756988
- docs_devout/02-design/adr/0001-runner-temporario-windows-rpc.md: 31878be8bf646a3ffe1ffcb12f27d16c380a461f8090abd2a8d2da0cf650c3f6
- docs_devout/02-design/adr/0002-pi-sequencial-exclusivo.md: 8afab665c338bd65325cd83dd96020ca6e72d37d8daaa982e74d5a078b9654b8
- docs_devout/02-design/adr/0003-isolamento-forte-adiado-no-mvp.md: 306d456beb41fd6f05e2f3a7e1b74423cbc17078430d31c5346401db4b39e018
- docs_devout/01-requisitos/escopo.md: 8c08fe3775f1e8aef9394c8a7220e29ff9a275d461e16d3be484602a43d6f0f7
- .agents/skills/implement/SKILL.md: 7e14e2819878e14397f815b526933e4f4f08cdd62aba8261fc0fe4bd0a0f0f1a
- .agents/skills/implement/references/implementador.md: 7a58b7b61f8a09e97041b01a6841bdb125ac831c63093aaf5161d7f9e2a83695
- .agents/skills/implement/references/entradas-independentes.md: c5c1f01d69f71ab31bad74d103db09ec2d85bab33c7211f8025e7b181dfbbdea
- src/package.json: e7d7c40faf70f982429f70c6808083f3e67af1cef6b8f0537903aac601f610f9
- src/README.md: ed1f514a6eb163be04d1f6d0d1bf1fba89411fc13a86c5972da18ea6c745b493
- src/ROLE-RUNNER.md: 3f15e0ae7a5efc05faa6b7c2c754f513fa99b515677cce03a48da2957697f110
- src/OPENCLAW.md: 909705dfa67b3a0d8e9e618e6b1a26914407289c1ac485756c1126e4f3fdd7b0
- docs_devout/how-to/diagnosticar-ambiente-windows.md: 8b5792657a7f4d1565620327a4f88aed498919682a6d3e74cb60da5766b14070

## Confronto com relatos

Fase iniciada somente após persistir a avaliação independente acima; seu texto foi preservado. Lidos relatório M02-T08 integral (etapas e fechamento), Observações, diagnóstico/R2 incompleta da M02-T03 e todos os conteúdos adiados da seleção M02-T08. Examinados inventário completo, configuração pertinente e diffs HEAD/staged/unstaged adiados: PI-LOCK e registro mudaram, staged vazio; demais fontes selecionadas/configuração não mudaram. O registro só altera a linha M02-T08. O contrato corretivo foi mantido, com atualização de situação, não flexibilização dos requisitos. M02-T03 permanece intocada e não foi reavaliada como task nesta revisão.

- Histórico coerente de implementação inicial por etapas, **0 correções completas da M02-T08**. As declarações parciais foram seguidas de fechamento explícito; não foram confundidas com conclusão. A M02-T03 conserva uma correção e R2 incompleta.
- Testes pertinentes declarados pelo implementador foram reproduzidos: 84/84 e 1/1. Relato não alega suíte global verde. A execução global própria excedeu 900 s e mostrou as recusas já previstas na raiz operacional; não é achado novo de código nem autorização para liberar/trocar essa raiz. Nenhum smoke Pi real foi iniciado. Consulta posterior não encontrou processos Node de testes/fixtures remanescentes; a primeira consulta adicional teve erro de regex, corrigido na consulta seguinte, sem ações sobre processos.
- **Qualificação histórica conferida por assertions**, não só relato: fixture externa `devout-kernel-qualification-DEmTNK`, mesmo token/raiz, lease original e hash operacional intactos; hashes publicados dos três arquivos after conferem. Recalculadas comparações S3 87→87, hibernação 87→87 e reboot 87→88; coincidem com as persistidas, com pares de eventos de energia/boot e contexto correto. Collector JS/PS1, qualify-kernel e guard JS continuam com os hashes usados na coleta; pi-lock e guard PS1 foram alterados posteriormente como explicitado no relatório. Essa mudança esperada não invalida as medições do collector inalterado, mas impede reaplicar o antigo manifesto ao código novo.
- **Ensaio de recuperação conferido por assertions próprias** na fixture externa `devout-recovery-smoke-uNxFfv`, sem repetir reconciliação: oito hashes de fontes coincidem com o checkout; hashes publicados de manifest/ready/completed/observed e das duas provas conferem; comparação 88→90 recalculada. Estados antes bloqueados, depois reconciliáveis, razões esperadas; originais arquivados têm os hashes do manifesto. Cada prova é única, vincula token/hash/kernel e owner ausente. Âncora original, hash e checksum íntegros, vinculados ao kernel de ready e referenciados na prova. Inspeções nativas próprias das duas raízes sintéticas retornaram `canAcquire:true`, sem adquirir/iniciar Pi. Hash operacional igual nas duas coletas e no checkout revisado.
- Esses artefatos sustentam a qualificação no contexto limitado e o ensaio real declarado, sem generalizar a outros builds nem apresentar reboots do revisor. Não exigem novo ensaio físico para corrigir erro de formato na ferramenta de coleta.
- **I1 mantido:** o relato explica por que a coleta funcionou antes da integração do detector. Isso não torna executável o preparo no checkout final. O guia atual `src/PI-LOCK.md`, seção `Coleta de qualificação — M02-T08`, ainda anuncia que o comando cria fixture e permite novas observações; o roteiro novo continua publicando os comandos e afirma que o protocolo ainda não foi implementado. O aviso de não reutilizar uma fixture antiga após mudanças de fontes é correto, mas não explica nem resolve a falha ao criar uma fixture NOVA. A reprodução própria falha antes de qualquer ação de energia; fixture preservada em `%TEMP%/devout-kernel-qualification-czkWnM`.

Entrada/snapshot/fontes reconferidos com o mesmo preparador e `--check-input` após o confronto, sem divergência de entrega. `git diff --check` passou. Nenhum código da task ou arquivo de evidência anterior foi editado pelo revisor.

## Decisão final

**Solicitar correção: 0 bloqueadores, 1 importante (I1), 0 correções completas da M02-T08. R1 finalizada, sem aprovação técnica ou autorização de commits.**

### I1 — importante — preparo de qualificação incompatível com o formato final

- **Local:** `src/test/qualify-kernel.mjs:82–93`, combinado com `src/pi-lock.mjs:21–23`; instruções em `src/test/kernel-qualification-procedure.txt` e `src/PI-LOCK.md#Coleta de qualificação — M02-T08`.
- **Reprodução:** no Windows 10 AMD64 build 19045, `node src/test/qualify-kernel.mjs prepare` retorna exit 1 / `SYNTHETIC_LEASE_NOT_BLOCKED`, sem ações manuais de energia. O guard novo retorna `boot.source` nativo, mas a fixture grava esse objeto como schema 1. A inspeção recusa esse formato misto como `LOCK_METADATA_INVALID`, não retorna o record e o roteiro não pode começar. Não se trata de falha do candidato nativo ou prova de reboot ausente.
- **Impacto/requisito:** ferramenta e roteiro de qualificação novos não são reproduzíveis a partir da entrega final, apesar de publicados como utilizáveis. Viola a entrega de qualificação/roteiro opt-in e a distinção explícita dos formatos exigidas em Fazer/Entregáveis. A suíte específica não detecta isso porque não testa o preparo positivo. Não foi demonstrada liberação insegura do protocolo de produção; evidência física histórica foi conferida e permanece válida nos limites descritos.
- **Correção recomendada:** gerar fixture legada explicitamente sintética e válida, sem copiar fonte nativa para schema 1 e sem relaxar o validador de produção; adicionar regressão do preparo positivo seguida de observação no mesmo kernel, que confirme record/estado bloqueado e preservação operacional. Atualizar o roteiro/guia para distinguir histórico de qualificação e uso atual, retirando afirmações correntes de que o protocolo ainda não existe. Preservar os manifestos/observações antigos imutáveis e documentar a mudança de hashes; não editar dados históricos nem solicitar novo reboot apenas por esse ajuste de preparo. A correção deve comprovar os passos sem energia e repetir testes pertinentes; qualquer necessidade de nova ação manual exige preparação/autorização própria.

**Encaminhamento:** atualizar somente M02-T08 para `em correção` pelo script oficial, preservando Observações; próxima conversa no papel corretor para I1, seguida de reauditoria independente R2. Não corrigir nesta conversa, não recuperar lease operacional, não retomar R2 da M02-T03 e não fazer commits. O bloqueio da suíte global fica registrado como limite ambiental, não como obrigação de contorná-lo para obter passes.
