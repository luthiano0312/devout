# Visão e escopo — Devout

## Necessidade

Automatizar gradualmente o workflow pessoal de desenvolvimento baseado nas skills `grill-me`, `docs`, `plan` e `implement`, reduzindo intervenções rotineiras sem perder aprovação humana de escopo, revisão independente e rastreabilidade. A redução de custo por modelos distintos é hipótese a medir, não benefício já comprovado.

**Fontes:** [contexto consolidado](../explanation/contexto-projeto-automacao-workflow-atualizado.md), seções 1–5; [contrato MVP v1.0](../02-design/contrato-orquestracao-mvp.md), seções 1, 2 e 11. Este documento é um resumo de escopo, não uma segunda especificação de requisitos.

## Atores e limites de responsabilidade

- **Usuário:** aprova marco e mudanças de requisito/arquitetura, homologa o resultado e autoriza integração na `main`.
- **OpenClaw:** coordena execuções, confere gates e controla transições oficiais quando a automação correspondente existir.
- **Pi Agent:** executa programação e produz evidências; não concede aprovação nem autorização por sua própria declaração.

## Dentro do MVP incremental

Uma task aprovada por vez em repositório descartável: implementador → revisor em duas fases → correção/reauditoria quando necessária, até aprovação técnica, sem commits oficiais. O contrato divide a entrega em quatro slices; sua aprovação não autoriza antecipar a execução dos slices seguintes.

### Entrega encerrada — M01 / Slice 1

**Slice 1 implementado, revisado e encerrado:** infraestrutura OpenClaw → Role Runner temporário → Pi Driver → Pi RPC: JSONL, eventos, controle de processos, término verificado, exclusividade, cancelamento e integração Windows. Tasks e critérios originais estão preservados no [plano M01 arquivado](../03-execucao/planos/marco-M01.md); conclusões e evidências constam no [registro oficial](../03-execucao/registro.md).

**Slice 2 ainda não iniciado.** O contrato MVP completo está **parcialmente implementado**; os Slices 2, 3 e 4 permanecem futuros. Não há plano ativo; M02 ainda será planejado.

Revisão automatizada, gates de papéis, transições oficiais, correção/reauditoria e recuperação de task pertencem aos slices seguintes. No Slice 1, o Runner não atualiza o registro nem aprova tasks.

## Fora do MVP imediato

Git Gateway, commits/merge/push automáticos, integração na `main`, automação de marcos inteiros, migração completa da `plan`, execução paralela, Docker/WSL2, isolamento forte Windows, serviço de produção e framework genérico multiagente.

## Restrições e aceite

- Windows 10/11 nativo, OpenClaw, Node.js e Pi Agent RPC.
- No máximo um Pi controlado pelo workflow ativo por vez; processo incerto impede nova execução.
- Somente projetos e dados fictícios, sem segredos ou credenciais Git amplas; isolamento forte não foi comprovado.
- Saída `0`, `success=true` e prompt aceito não comprovam aprovação.
- Aceite do MVP: cenários T01–T12 e critério global na seção 10 do contrato. Aceite do M01: critérios de cada task do plano; não exigir antecipadamente T01/T02 completos.
- O baseline M01 foi conferido no Git (`c771c4b`), assim como os commits funcionais e de metadados das seis tasks concluídas. Novas implementações exigem novo plano aprovado e baseline autorizado; o plano arquivado não os substitui. Progresso real fica no [registro](../03-execucao/registro.md).
