# Arquitetura de alto nível — Devout

**Situação:** **Slice 1 implementado, revisado e encerrado no M01**; **Slice 2 ainda não iniciado**. O contrato MVP completo permanece **parcialmente implementado**, sem os fluxos dos Slices 2, 3 e 4. Esta visão resume e aponta para o [contrato MVP v1.0](contrato-orquestracao-mvp.md), fonte do comportamento detalhado. O [plano M01 arquivado](../03-execucao/planos/marco-M01.md) preserva o recorte da entrega concluída; o [plano M02 ativo](../plano.md), aprovado em 2026-11-19, delimita o Slice 2, com execução condicionada à confirmação do baseline e dos gates da task. Consultar o [registro oficial](../03-execucao/registro.md) para o progresso.

## Contexto e topologia

```text
Usuário — decisões de produto, escopo e autorizações
   |
OpenClaw — orquestração, gates e transições
   | exec assíncrono + acompanhamento por process.* / arquivos
Role Runner — processo Node.js temporário, um papel/execução
   | exclusividade + eventos/resultado por runId
Pi Driver — subprocesso, transporte JSONL e ciclo de vida
   | stdin/stdout RPC; stderr separado
Pi Agent — código e evidências, sem autoridade de aprovação
```

Não há supervisor Node residente, serviço HTTP permanente ou Named Pipe no MVP. A ponte HTTP dos protótipos é evidência experimental, não topologia definitiva. Ver [ADR-0001](adr/0001-runner-temporario-windows-rpc.md).

## Fronteiras dos componentes

| Componente | Responsabilidade | Detalhamento normativo |
| --- | --- | --- |
| OpenClaw | Autorizar despacho, validar gates e controlar transições oficiais | Contrato, seções 3, 6 e 7 |
| Role Runner | Validar solicitação, adquirir lock, executar um papel e entregar evidências; não editar registro oficial | Seções 3–5 e 7 |
| Pi Driver | Spawn seguro Windows, JSONL incremental, correlação, eventos, timeout, cancelamento e término | Seções 4–5 |
| Pi Agent | Produzir artefatos e avaliações; resultado declarado é candidato | Seções 3 e 6 |
| Validadores | Conferir condições objetivas; não substituir revisão técnica independente | Seções 3 e 7–8 |

A topologia e a tabela descrevem o desenho aprovado completo, não apenas funcionalidades prontas. No Slice 1, o OpenClaw dispara e acompanha o Runner para execução técnica com papel de teste. As duas fases de revisão no mesmo Pi revisor, os gates de papéis, os validadores de workflow e as transições oficiais pertencem aos slices seguintes e ainda não foram implementados.

## Processos, estado e persistência

- Execuções são sequenciais, com processo/sessão nova entre papéis e término comprovado antes de liberar exclusividade. Processo/lock incerto exige reconciliação: [ADR-0002](adr/0002-pi-sequencial-exclusivo.md).
- Estado do processo, resultado do papel e estado oficial da task são níveis distintos. A seção 6 do contrato define os valores; nenhum exit code isolado determina conclusão.
- `registro.md` é a fonte oficial do progresso; estado operacional e `runs/<runId>/` não o duplicam. Arquivos operacionais ficam fora do código e do Git, em local configurável; formatos ilustrativos e gravação recuperável estão na seção 8 do contrato.
- No Slice 1, persistem-se eventos e resultado técnico da execução, sem transições oficiais de task.

## Segurança e decisões

O Windows nativo não oferece isolamento forte apenas com instruções e extensão de permissões. A aceitação de risco é restrita ao MVP fictício/descartável: [ADR-0003](adr/0003-isolamento-forte-adiado-no-mvp.md). Credenciais amplas, produção e operações Git privilegiadas não são liberadas por essa aceitação.

Antes de propor mudanças, consultar `adr/*.md`; não carregar `adr/archive/` por padrão. Os ADRs registram decisões existentes, sem criar nova aprovação nem afirmar validação técnica inexistente.

## Validação realizada e limites pendentes

As seis tasks M01-T01–T06 estão concluídas no [registro oficial](../03-execucao/registro.md), com commits funcionais, relatórios e revisões associados. Essas evidências documentam spawn seguro, transporte RPC, ciclo de vida e identificação de processos, exclusividade, cancelamento assíncrono e disparo/acompanhamento real pelo OpenClaw no Windows. A [prova de integração](../reference/01-registro-integracao-openclaw-pi-e-decisoes.md) continua sendo evidência dos experimentos anteriores, não substituto das evidências do M01.

O aceite completo do MVP, incluindo T01/T02 de workflow de papéis, permanece pendente nos slices seguintes. A seção 13 do contrato registra pontos de detalhamento do desenho; não implica que toda a infraestrutura continue por implementar. Testes controlados não garantem produção, execução prolongada irrestrita ou retomada durável após reinício do Gateway; preservar os limites registrados na revisão M01-T06.
