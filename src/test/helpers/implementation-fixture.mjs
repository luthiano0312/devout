// Trusted preparation and synthetic report writer for M02-T03 tests only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { prepareTaskFixture } from './task-fixture.mjs';
import { validateTaskInput } from '../../task-input.mjs';

export function prepareImplementationFixture(t) {
  const task = `### M02-T02 — Alterar valor fictício para 2

#### Fazer

- Ler value.mjs e test/fixture.test.mjs. Alterar apenas value.mjs para export const value = 2; e executar node --test.

#### Não alterar

- Preservar mapas, plano, registro, testes e .git. Sem commits, rede ou pacotes.

#### Entregáveis

- value.mjs e docs/achados/task-M02-T02-relatorio.md (relatório da implementação inicial, com comandos/testes e pendências).

#### Critério de conclusão

- node --test passa com o valor esperado 2 e o relatório descreve a entrega, sem alegar aprovação.
`;
  const f = prepareTaskFixture(t, { task, beforeCommit: f => {
    writeFileSync(join(f.workspace, 'test/fixture.test.mjs'),
      "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from '../value.mjs';\ntest('fictional value', () => assert.equal(value, 2));\n");
  } });
  const reportPath = 'docs/achados/task-M02-T02-relatorio.md';
  f.approval.allowedChanges = ['value.mjs', reportPath];
  f.entry = validateTaskInput(f.request, f.approval);
  if (!f.entry.accepted) throw new Error('INVALID_TEST_FIXTURE');
  const piCmd = join(f.root, 'pi.cmd'); writeFileSync(piCmd, '@echo off\r\n');
  f.config = { schemaVersion: 1, taskId: f.request.taskId, role: 'implementador',
    workspace: f.workspace, artifactsRoot: join(f.root, 'operacional'), piCmd,
    modelProfile: 'configured-engineering', engineering: { ...f.engineering },
    taskInputId: f.entry.input.inputId, reportPath,
    driver: { commandTimeoutMs: 5000, settlementTimeoutMs: 5000, normalWaitMs: 5000, pollMs: 30 } };
  return f;
}

export function writeImplementationReport(workspace, reportPath, input, overrides = {}) {
  const evidence = { schemaVersion: 1, taskId: input.taskId, baseline: input.baseline, inputId: input.inputId,
    changedFiles: ['value.mjs'], commands: [{ command: 'node --test', outcome: 'passed' }], ...overrides };
  const text = `# Relatório da implementação inicial — ${input.taskId}

## Arquivos alterados

- value.mjs (e este relatório).

## O que foi feito

Valor fictício alterado de 1 para 2.

## Comandos e testes

- node --test: passou (1 teste).

## Entregáveis

- Código e relatório presentes.

## Critério de conclusão

- Teste passou. Sem alteração do registro ou commits.

## Pendências

- Revisão independente pendente. Não é aprovação.

## Evidências estruturadas

\`\`\`json
${JSON.stringify(evidence, null, 2)}
\`\`\`
`;
  const path = join(workspace, reportPath);
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text);
  return text;
}
