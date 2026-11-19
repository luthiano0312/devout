// Trusted fixture preparation ONLY: the baseline commit predates any Pi launch.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { engineeringEnvironment, engineeringTestPolicy } from '../../engineering-workspace.mjs';

export function prepareEngineeringFixture({ expected = 1 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'devout engenharia espaço '));
  const workspace = join(root, 'workspace');
  mkdirSync(workspace); mkdirSync(join(workspace, 'test'));
  writeFileSync(join(workspace, '.devout-disposable.json'), JSON.stringify({ schemaVersion: 1, disposable: true }));
  writeFileSync(join(workspace, 'value.mjs'), 'export const value = 1;\n');
  writeFileSync(join(workspace, 'test', 'fixture.test.mjs'),
    `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from '../value.mjs';\ntest('fictional value', () => assert.equal(value, ${expected}));\n`);
  const git = args => execFileSync('git', ['--no-optional-locks', '-C', workspace, ...args], {
    shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 256 * 1024, encoding: 'utf8',
    env: engineeringEnvironment(), stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  git(['init', '--template=', '--initial-branch=fixture']);
  git(['add', '--all']);
  git(['-c', 'user.name=Fictional Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', 'Fictional baseline']);
  const engineering = { baseline: git(['rev-parse', 'HEAD']), branch: 'fixture', testPolicy: engineeringTestPolicy };
  return { root, workspace, engineering, git };
}
