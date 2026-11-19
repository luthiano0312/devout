// Trusted preparation before admission; never called by the validator or a Pi.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { taskTextHash, taskGitRefsHash } from '../../task-input.mjs';
import { prepareEngineeringFixture } from './engineering-fixture.mjs';

export const fixtureTask = `### M02-T02 — Alterar valor fictício

#### Fazer

- Ajustar value.mjs e verificar o teste local.

#### Não alterar

- Preservar AGENTS.md, plano, registro e .git. Sem commits.

#### Entregáveis

- value.mjs e testes locais.

#### Critério de conclusão

- node --test passa com o valor esperado.
`;

export function commitFixture(f, message = 'Fictional prepared task baseline') {
  f.git(['add', '--all']);
  f.git(['-c', 'user.name=Fictional Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', message]);
  const baseline = f.git(['rev-parse', 'HEAD']);
  f.engineering.baseline = baseline;
  if (f.approval) {
    f.approval.baseline = baseline; f.request.baseline = baseline;
    f.approval.refsHash = taskGitRefsHash(f.workspace);
  }
  return baseline;
}

export function prepareTaskFixture(t, options = {}) {
  const f = prepareEngineeringFixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  mkdirSync(join(f.workspace, 'docs'));
  const task = options.task ?? fixtureTask;
  const dep = options.dependency ?? 'none';
  const plan = `# Plano fictício

**Status:** APROVADO em 2026-11-19

## Dependências

| Task | Dependências obrigatórias | Justificativa |
| --- | --- | --- |
| M02-T02 | ${dep === 'none' ? '—' : 'M02-T01'} | Fixture |

## Tasks

${task}

### M02-T03 — DO-NOT-EXPOSE-OTHER-TASK

#### Fazer

DO-NOT-EXPOSE-OTHER-TASK-BODY
`;
  const register = `# Registro fictício

| Task | Marco | Status | Commit | Atualizado em | Observações |
| :--- | ---: | :---: | --- | --- | --- |
${dep === 'none' ? '' : `| M02-T01 | M02 | ${dep === 'concluded' ? 'concluída' : 'não iniciada'} | ${dep === 'concluded' ? f.engineering.baseline : '-'} | 2026-11-19T08:59:20-03:00 | DO-NOT-EXPOSE-DEPENDENCY-HISTORY |\n`}| M02-T02 | M02 | ${options.status ?? 'não iniciada'} | - | 2026-11-19T08:59:20-03:00 | DO-NOT-EXPOSE-OBSERVATIONS |

DO-NOT-EXPOSE-REGISTER-HISTORY
`;
  const map = '# AGENTS.md — Fixture\n\n- **Plano ativo:** `docs/plano.md`.\n- **Registro oficial de execução:** `docs/registro.md`.\n\nDO-NOT-EXPOSE-MAP-HISTORY\n';
  writeFileSync(join(f.workspace, 'AGENTS.md'), options.mapTransform?.(map) ?? map);
  writeFileSync(join(f.workspace, 'docs', 'plano.md'), options.planTransform?.(plan) ?? plan);
  writeFileSync(join(f.workspace, 'docs', 'registro.md'), options.registerTransform?.(register) ?? register);
  options.beforeCommit?.(f);
  const baseline = commitFixture(f);
  f.request = { schemaVersion: 1, taskId: 'M02-T02', workspace: f.workspace, baseline, branch: 'fixture' };
  f.approval = { ...f.request, taskHash: taskTextHash(task), refsHash: taskGitRefsHash(f.workspace),
    allowedChanges: ['value.mjs', 'test/'] };
  return f;
}
