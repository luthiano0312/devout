# Arquitetura de alto nível — Devout

**Situação:** desenho aprovado, ainda não implementado integralmente. Esta visão resume e aponta para o [contrato MVP v1.0](contrato-orquestracao-mvp.md), que permanece a fonte do comportamento detalhado. O [plano M01](../plano.md) limita a primeira entrega ao Slice 1.

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

As duas fases de revisão no mesmo Pi revisor e os gates de papéis fazem parte do desenho posterior ao Slice 1; não estão implementados por esta documentação.

## Processos, estado e persistência

- Execuções são sequenciais, com processo/sessão nova entre papéis e término comprovado antes de liberar exclusividade. Processo/lock incerto exige reconciliação: [ADR-0002](adr/0002-pi-sequencial-exclusivo.md).
- Estado do processo, resultado do papel e estado oficial da task são níveis distintos. A seção 6 do contrato define os valores; nenhum exit code isolado determina conclusão.
- `registro.md` é a fonte oficial do progresso; estado operacional e `runs/<runId>/` não o duplicam. Arquivos operacionais ficam fora do código e do Git, em local configurável; formatos ilustrativos e gravação recuperável estão na seção 8 do contrato.
- No Slice 1, persistem-se eventos e resultado técnico da execução, sem transições oficiais de task.

## Segurança e decisões

O Windows nativo não oferece isolamento forte apenas com instruções e extensão de permissões. A aceitação de risco é restrita ao MVP fictício/descartável: [ADR-0003](adr/0003-isolamento-forte-adiado-no-mvp.md). Credenciais amplas, produção e operações Git privilegiadas não são liberadas por essa aceitação.

Antes de propor mudanças, consultar `adr/*.md`; não carregar `adr/archive/` por padrão. Os ADRs registram decisões existentes, sem criar nova aprovação nem afirmar validação técnica inexistente.

## Validação pendente

Consultar a seção 13 do contrato e as tasks M01-T01–T06: spawn seguro de `.cmd`, identificação de árvore de processos, prazos, lock, cancelamento assíncrono e comportamento local de `exec`/`process`. A [prova de integração](../reference/01-registro-integracao-openclaw-pi-e-decisoes.md) comprova apenas os experimentos registrados, não a infraestrutura definitiva.
