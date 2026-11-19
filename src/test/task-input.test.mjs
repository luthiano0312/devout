import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateTaskInput, revalidateTaskInput, taskTextHash, taskGitRefsHash } from '../task-input.mjs';
import { prepareTaskFixture, fixtureTask, commitFixture } from './helpers/task-fixture.mjs';

function diskHash(root) {
  const hash = createHash('sha256');
  function walk(path) {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name), info = lstatSync(full);
      hash.update(full).update(info.isDirectory() ? 'directory' : info.isSymbolicLink() ? 'link' : 'file');
      if (info.isDirectory()) walk(full);
      else if (info.isFile()) hash.update(readFileSync(full));
    }
  }
  walk(root); return hash.digest('hex');
}
function check(f, code, inputId) {
  const before = diskHash(f.workspace), head = f.git(['rev-parse', 'HEAD']), branch = f.git(['symbolic-ref', '--short', 'HEAD']);
  const result = inputId === undefined ? validateTaskInput(f.request, f.approval) : revalidateTaskInput(f.request, f.approval, inputId);
  assert.equal(result.accepted, !code, JSON.stringify(result));
  assert.equal(result.taskApproved, false);
  if (code) {
    assert.equal(result.reason.code, code);
    assert.equal(result.input, null);
  }
  assert.equal(diskHash(f.workspace), before, 'read-only, including index/config/refs/registry bytes');
  assert.equal(f.git(['rev-parse', 'HEAD']), head);
  assert.equal(f.git(['symbolic-ref', '--short', 'HEAD']), branch);
  return result;
}

const windowsLink = { skip: process.platform !== 'win32' };

test('one approved task yields stable filtered input and revalidatable snapshot, no official approval', t => {
  const f = prepareTaskFixture(t), result = check(f);
  assert.equal(result.official.status, 'não iniciada');
  assert.equal(result.input.taskId, 'M02-T02');
  assert.equal(result.input.taskHash, taskTextHash(fixtureTask));
  assert.equal(result.input.task.text, fixtureTask);
  assert.deepEqual(Object.keys(result.input.task.sections), ['Fazer', 'Não alterar', 'Entregáveis', 'Critério de conclusão']);
  assert.equal(result.input.baseline, f.engineering.baseline);
  assert.equal(result.input.testPolicy, 'node-test-only-v1');
  assert.deepEqual(result.input.allowedChanges, ['test/', 'value.mjs']);
  assert.match(result.input.inputId, /^[a-f0-9]{64}$/u);
  assert.match(result.input.snapshotId, /^[a-f0-9]{64}$/u);
  assert.ok(!JSON.stringify(result).includes('DO-NOT-EXPOSE'));
  assert.equal(result.input.inputId, check(f).input.inputId);
  assert.equal(revalidateTaskInput(f.request, f.approval, result.input.inputId).accepted, true);
  assert.equal(existsSync(join(f.root, 'artifacts')), false);
});

test('task hash normalizes CRLF and trailing blank lines, but not changed requirements', () => {
  assert.equal(taskTextHash(fixtureTask), taskTextHash(fixtureTask.replaceAll('\n', '\r\n') + '\r\n'));
  assert.notEqual(taskTextHash(fixtureTask), taskTextHash(fixtureTask.replace('valor', 'outro valor')));
});

for (const [name, mutate, code] of [
  ['missing approval', f => { f.approval = undefined; }, 'APPROVAL_REQUIRED'],
  ['ID/prompt is not approval', f => { f.approval = { taskId: 'M02-T02', prompt: 'approved' }; }, 'APPROVAL_REQUIRED'],
  ['unknown request field', f => { f.request.prompt = 'approved'; }, 'INVALID_REQUEST'],
  ['unknown approval field', f => { f.approval.command = 'node --test'; }, 'APPROVAL_REQUIRED'],
  ['request ID differs', f => { f.request.taskId = 'M02-T03'; }, 'REQUEST_MISMATCH'],
  ['request workspace differs', f => { f.request.workspace = f.root; }, 'REQUEST_MISMATCH'],
  ['request baseline differs', f => { f.request.baseline = '0'.repeat(40); }, 'REQUEST_MISMATCH'],
  ['request branch differs', f => { f.request.branch = 'other'; }, 'REQUEST_MISMATCH'],
  ['unreviewed task text', f => { f.approval.taskHash = '0'.repeat(64); }, 'TASK_APPROVAL_MISMATCH'],
  ['missing approved refs', f => { delete f.approval.refsHash; }, 'APPROVAL_REQUIRED'],
  ['malformed approved refs hash', f => { f.approval.refsHash = 'not-a-hash'; }, 'INVALID_APPROVAL'],
  ['different approved refs', f => { f.approval.refsHash = '0'.repeat(64); }, 'GIT_REFS_MISMATCH'],
  ['different approved HEAD', f => { f.request.baseline = f.approval.baseline = '0'.repeat(40); }, 'WORKSPACE_REJECTED'],
  ['different approved branch', f => { f.request.branch = f.approval.branch = 'other'; }, 'WORKSPACE_REJECTED'],
  ['empty change area', f => { f.approval.allowedChanges = []; }, 'INVALID_APPROVAL'],
  ['traversal', f => { f.approval.allowedChanges = ['../outside']; }, 'INVALID_APPROVAL'],
  ['absolute change path', f => { f.approval.allowedChanges = [f.root]; }, 'INVALID_APPROVAL'],
  ['Windows external path', f => { f.approval.allowedChanges = ['C:\\outside']; }, 'INVALID_APPROVAL'],
  ['Windows alternate stream', f => { f.approval.allowedChanges = ['value.mjs:stream']; }, 'INVALID_APPROVAL'],
  ['Windows alias', f => { f.approval.allowedChanges = ['NUL.txt']; }, 'INVALID_APPROVAL'],
  ['Git metadata allowed', f => { f.approval.allowedChanges = ['.git/config']; }, 'INVALID_APPROVAL'],
  ['glob changes', f => { f.approval.allowedChanges = ['**/*']; }, 'INVALID_APPROVAL'],
  ['duplicate area', f => { f.approval.allowedChanges = ['value.mjs', 'value.mjs']; }, 'INVALID_APPROVAL'],
  ['case-insensitive duplicate area', f => { f.approval.allowedChanges = ['value.mjs', 'VALUE.mjs']; }, 'INVALID_APPROVAL'],
  ['new private credentials area', f => { f.approval.allowedChanges = ['credentials/']; }, 'INVALID_APPROVAL'],
  ['new environment file', f => { f.approval.allowedChanges = ['test/.env.local']; }, 'INVALID_APPROVAL'],
  ['new Pi history area', f => { f.approval.allowedChanges = ['.pi/']; }, 'INVALID_APPROVAL'],
  ['map case alias', f => { f.approval.allowedChanges = ['agents.md']; }, 'CHANGE_AREA_REJECTED'],
  ['new context map', f => { f.approval.allowedChanges = ['CLAUDE.md']; }, 'CHANGE_AREA_REJECTED'],
  ['register case alias', f => { f.approval.allowedChanges = ['DOCS/REGISTRO.MD']; }, 'CHANGE_AREA_REJECTED'],
  ['map allowed', f => { f.approval.allowedChanges = ['AGENTS.md']; }, 'CHANGE_AREA_REJECTED'],
  ['register allowed', f => { f.approval.allowedChanges = ['docs/registro.md']; }, 'CHANGE_AREA_REJECTED'],
  ['plan allowed via parent', f => { f.approval.allowedChanges = ['docs/']; }, 'CHANGE_AREA_REJECTED'],
  ['marker allowed', f => { f.approval.allowedChanges = ['.devout-disposable.json']; }, 'CHANGE_AREA_REJECTED'],
  ['file treated as directory', f => { f.approval.allowedChanges = ['value.mjs/']; }, 'CHANGE_AREA_REJECTED'],
  ['directory treated as file', f => { f.approval.allowedChanges = ['test']; }, 'CHANGE_AREA_REJECTED'],
  ['file as parent', f => { f.approval.allowedChanges = ['value.mjs/child']; }, 'CHANGE_AREA_REJECTED'],
]) {
  test(`rejects ${name} without writes`, t => {
    const f = prepareTaskFixture(t); mutate(f); check(f, code);
  });
}

for (const status of ['em andamento', 'aguardando revisão', 'em correção', 'pausada', 'concluída', 'substituída']) {
  test(`initial admission does not infer resume from status ${status}`, t => {
    check(prepareTaskFixture(t, { status }), 'INITIAL_STATE_REJECTED');
  });
}

for (const [name, options, code] of [
  ['unapproved plan', { planTransform: text => text.replace('APROVADO', 'RASCUNHO') }, 'PLAN_NOT_APPROVED'],
  ['approval only in example', { planTransform: text => text.replace('**Status:** APROVADO em 2026-11-19', '```md\n**Status:** APROVADO em 2026-11-19\n```') }, 'PLAN_NOT_APPROVED'],
  ['absent task', { planTransform: text => text.replace('### M02-T02 —', '### M02-T99 —') }, 'TASK_NOT_FOUND'],
  ['duplicate task', { planTransform: text => text + '\n' + fixtureTask }, 'INVALID_TASK'],
  ['missing field', { task: fixtureTask.replace('#### Fazer', '#### Outro') }, 'INVALID_TASK_FIELDS'],
  ['duplicate field', { task: fixtureTask + '\n#### Fazer\nDuplicado\n' }, 'INVALID_TASK_FIELDS'],
  ['empty field', { task: fixtureTask.replace('- Ajustar value.mjs e verificar o teste local.', '') }, 'INVALID_TASK_FIELDS'],
  ['headings only in example', { task: fixtureTask.replace('#### Fazer', '```md\n#### Fazer\n```') }, 'INVALID_TASK_FIELDS'],
  ['missing registry row', { registerTransform: text => text.replace('M02-T02', 'M02-T99') }, 'TASK_NOT_REGISTERED'],
  ['reordered register columns', { registerTransform: text => text.replace('Task | Marco', 'Marco | Task') }, 'INVALID_REGISTER'],
  ['register seven columns', { registerTransform: text => text.replace('Observações |', 'Observações | Extra |') }, 'INVALID_REGISTER'],
  ['register extra pipe', { registerTransform: text => text.replace('DO-NOT-EXPOSE-OBSERVATIONS', 'text | more') }, 'INVALID_REGISTER'],
  ['duplicate registry row', { registerTransform: text => text.replace('\n\nDO-NOT-EXPOSE-REGISTER-HISTORY', '\n| M02-T02 | M02 | não iniciada | - | 2026-11-19T08:59:20-03:00 | - |\n') }, 'INVALID_REGISTER'],
  ['unknown registry status', { status: 'approved' }, 'INVALID_REGISTER'],
  ['timestamp without timezone', { registerTransform: text => text.replaceAll('2026-11-19T08:59:20-03:00', '2026-11-19T08:59:20') }, 'INVALID_REGISTER'],
  ['different milestone', { registerTransform: text => text.replace('| M02 |', '| M01 |') }, 'INVALID_REGISTER'],
  ['impossible timestamp date', { registerTransform: text => text.replaceAll('2026-11-19T08:59:20-03:00', '2026-02-30T08:59:20-03:00') }, 'INVALID_REGISTER'],
  ['impossible timestamp hour', { registerTransform: text => text.replaceAll('2026-11-19T08:59:20-03:00', '2026-11-19T24:00:00-03:00') }, 'INVALID_REGISTER'],
  ['self dependency', { planTransform: text => text.replace('| M02-T02 | — |', '| M02-T02 | M02-T02 |') }, 'INVALID_DEPENDENCIES'],
  ['unknown dependency', { planTransform: text => text.replace('| M02-T02 | — |', '| M02-T02 | M02-T99 |') }, 'DEPENDENCY_PENDING'],
  ['missing dependency table', { planTransform: text => text.replace('Dependências obrigatórias', 'Dependências') }, 'INVALID_DEPENDENCIES'],
  ['missing map labels', { mapTransform: text => text.replace('Plano ativo', 'Plano antigo') }, 'INVALID_MAP'],
  ['duplicate map entry', { mapTransform: text => text + '- **Plano ativo:** `docs/plano.md`.\n' }, 'INVALID_MAP'],
  ['external map path', { mapTransform: text => text.replace('docs/plano.md', '../plano.md') }, 'INVALID_MAP'],
  ['map missing plan', { mapTransform: text => text.replace('docs/plano.md', 'missing/plano.md') }, 'MISSING_ARTIFACT'],
  ['map missing register', { mapTransform: text => text.replace('docs/registro.md', 'missing/registro.md') }, 'MISSING_ARTIFACT'],
  ['no AGENTS or CLAUDE', { beforeCommit: f => rmSync(join(f.workspace, 'AGENTS.md')) }, 'MISSING_ARTIFACT'],
  ['divergent maps', { beforeCommit: f => writeFileSync(join(f.workspace, 'CLAUDE.md'), readFileSync(join(f.workspace, 'AGENTS.md'), 'utf8').replace('docs/plano.md', 'other/plano.md')) }, 'AMBIGUOUS_MAP'],
]) {
  test(`blocks committed invalid fixture: ${name}`, t => { check(prepareTaskFixture(t, options), code); });
}

test('CLAUDE fallback and matching dual maps locate the same committed inputs', t => {
  const f = prepareTaskFixture(t, { beforeCommit: f => {
    writeFileSync(join(f.workspace, 'CLAUDE.md'), readFileSync(join(f.workspace, 'AGENTS.md')));
    rmSync(join(f.workspace, 'AGENTS.md'));
  } });
  check(f);
  writeFileSync(join(f.workspace, 'AGENTS.md'), readFileSync(join(f.workspace, 'CLAUDE.md')));
  commitFixture(f); check(f);
});

test('approved future file/directory and fenced example headings do not widen task selection', t => {
  const task = fixtureTask.replace('- Ajustar value.mjs e verificar o teste local.', '- Ajustar value.mjs.\n\n```md\n### M99-T99 — Example\n#### Fazer\nExample only\n```');
  const f = prepareTaskFixture(t, { task });
  f.approval.allowedChanges = ['future/file.mjs', 'new-tests/'];
  check(f);
});

for (const [name, mutate, code] of [
  ['unstaged change', f => writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 2;\n'), 'WORKSPACE_REJECTED'],
  ['staged change', f => { writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 2;\n'); f.git(['add', 'value.mjs']); }, 'WORKSPACE_REJECTED'],
  ['untracked map', f => { f.git(['rm', '--cached', 'AGENTS.md']); }, 'WORKSPACE_REJECTED'],
  ['untracked file', f => writeFileSync(join(f.workspace, 'concurrent.txt'), 'fictional'), 'WORKSPACE_REJECTED'],
  ['deleted plan', f => rmSync(join(f.workspace, 'docs', 'plano.md')), 'WORKSPACE_REJECTED'],
  ['remote', f => f.git(['remote', 'add', 'origin', 'https://example.invalid/fake']), 'WORKSPACE_REJECTED'],
  ['credential helper', f => f.git(['config', 'credential.helper', 'manager']), 'WORKSPACE_REJECTED'],
  ['credential file', f => writeFileSync(join(f.workspace, '.env'), 'FICTIONAL=1'), 'WORKSPACE_REJECTED'],
  ['skip worktree', f => f.git(['update-index', '--skip-worktree', 'value.mjs']), 'WORKSPACE_REJECTED'],
  ['missing marker', f => rmSync(join(f.workspace, '.devout-disposable.json')), 'WORKSPACE_REJECTED'],
  ['missing test policy artifact', f => rmSync(join(f.workspace, 'test', 'fixture.test.mjs')), 'WORKSPACE_REJECTED'],
  ['Git operation lock', f => writeFileSync(join(f.workspace, '.git', 'index.lock'), ''), 'GIT_OPERATION_IN_PROGRESS'],
  ['merge in progress', f => writeFileSync(join(f.workspace, '.git', 'MERGE_HEAD'), f.engineering.baseline), 'GIT_OPERATION_IN_PROGRESS'],
  ['rebase in progress', f => mkdirSync(join(f.workspace, '.git', 'rebase-merge')), 'GIT_OPERATION_IN_PROGRESS'],
  ['new unapproved commit', f => { writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 2;\n'); f.git(['add', '--all']); f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Unapproved fictional commit']); }, 'WORKSPACE_REJECTED'],
  ['different checked-out branch', f => f.git(['switch', '-c', 'different']), 'WORKSPACE_REJECTED'],
]) {
  test(`blocks Git integrity violation: ${name}`, t => {
    const f = prepareTaskFixture(t); mutate(f); check(f, code);
  });
}

test('rejects a linked path outside fixture before any input is returned', windowsLink, t => {
  const f = prepareTaskFixture(t);
  symlinkSync(f.root, join(f.workspace, 'external'), 'junction');
  check(f, 'WORKSPACE_REJECTED');
});

test('a request to an external/non-disposable workspace cannot self-authorize', t => {
  const f = prepareTaskFixture(t);
  f.request.workspace = f.approval.workspace = f.root;
  const result = validateTaskInput(f.request, f.approval);
  assert.equal(result.reason.code, 'WORKSPACE_REJECTED');
});

test('dependency pending blocks; versioned functional + conclusion commits pass without narratives', t => {
  check(prepareTaskFixture(t, { dependency: 'pending' }), 'DEPENDENCY_PENDING');
  const result = check(prepareTaskFixture(t, { dependency: 'concluded' }));
  assert.equal(result.dependencies[0].evidence, 'two-commits');
  assert.match(result.dependencies[0].metadata, /^[a-f0-9]{40}$/u);
  assert.ok(!JSON.stringify(result).includes('DO-NOT-EXPOSE'));
});

test('a concluded dependency with absent/unrelated Git evidence blocks', t => {
  check(prepareTaskFixture(t, { dependency: 'concluded', registerTransform: text => text.replace(/concluída \| [a-f0-9]{40}/u, 'concluída | ' + '0'.repeat(40)) }), 'DEPENDENCY_EVIDENCE_MISSING');
});

test('versioned integration link is accepted without requiring original rewritten object', t => {
  const f = prepareTaskFixture(t, { dependency: 'concluded', registerTransform: text => text.replace(/concluída \| [a-f0-9]{40}/u, 'concluída | ' + '0'.repeat(40)) });
  const integration = f.engineering.baseline;
  const path = join(f.workspace, 'docs', 'registro.md');
  writeFileSync(path, readFileSync(path, 'utf8').replace('DO-NOT-EXPOSE-DEPENDENCY-HISTORY', `DO-NOT-EXPOSE-DEPENDENCY-HISTORY; Integração: ${integration}`));
  commitFixture(f);
  const result = check(f);
  assert.equal(result.dependencies[0].evidence, 'integration');
  assert.equal(result.dependencies[0].commit, integration);
});

for (const link of ['Integração: not-a-hash', 'Integração: ' + '0'.repeat(40), 'Integração: ' + '1'.repeat(40) + '; Integração: ' + '2'.repeat(40)]) {
  test(`invalid dependency integration evidence blocks: ${link.slice(0, 24)}`, t => {
    check(prepareTaskFixture(t, { dependency: 'concluded', registerTransform: text => text.replace('DO-NOT-EXPOSE-DEPENDENCY-HISTORY', link) }), 'DEPENDENCY_EVIDENCE_MISSING');
  });
}

test('same-HEAD dirty edits and clean later commits both invalidate captured entry', t => {
  const f = prepareTaskFixture(t), previous = check(f).input;
  writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 2;\n');
  assert.equal(revalidateTaskInput(f.request, f.approval, previous.inputId).accepted, false);
  commitFixture(f); // Even explicitly approved new baseline must not reuse the old input.
  assert.equal(revalidateTaskInput(f.request, f.approval, previous.inputId).reason.code, 'SNAPSHOT_MISMATCH');
  assert.equal(revalidateTaskInput(f.request, f.approval, 'not-a-hash').reason.code, 'INVALID_INPUT_ID');
});

function sideCommit(f) {
  return f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit-tree', f.git(['rev-parse', 'HEAD^{tree}']),
    '-p', f.request.baseline, '-m', 'Unapproved side commit']);
}

for (const kind of ['heads', 'tags']) {
  for (const action of ['create', 'move', 'remove']) {
    test(`unapproved ${kind} ${action} invalidates admission and old input with HEAD stable`, t => {
      const f = prepareTaskFixture(t), ref = `refs/${kind}/other`;
      if (action !== 'create') f.git(['update-ref', ref, f.request.baseline]);
      f.approval.refsHash = taskGitRefsHash(f.workspace); // Explicit trusted approval of preexisting refs.
      const previous = check(f).input;
      if (action === 'remove') f.git(['update-ref', '-d', ref]);
      else f.git(['update-ref', ref, sideCommit(f)]);
      assert.equal(f.git(['rev-parse', 'HEAD']), f.request.baseline);
      assert.equal(f.git(['status', '--porcelain']), '');
      check(f, 'GIT_REFS_MISMATCH');
      check(f, 'GIT_REFS_MISMATCH', previous.inputId);
    });
  }
}

test('explicitly reapproved refs produce new IDs, never revive an old input', t => {
  const f = prepareTaskFixture(t), previous = check(f).input;
  f.git(['update-ref', 'refs/heads/unapproved', sideCommit(f)]);
  check(f, 'GIT_REFS_MISMATCH', previous.inputId);
  f.approval.refsHash = taskGitRefsHash(f.workspace); // A new human/controller approval, not validator behavior.
  const current = check(f).input;
  assert.notEqual(current.snapshotId, previous.snapshotId);
  assert.notEqual(current.inputId, previous.inputId);
  check(f, 'SNAPSHOT_MISMATCH', previous.inputId);
  check(f, undefined, current.inputId);
});

test('approved branches and annotated tags survive ref packing with stable semantic IDs', t => {
  const f = prepareTaskFixture(t);
  f.git(['update-ref', 'refs/heads/reviewed', sideCommit(f)]);
  f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    'tag', '-a', 'reviewed', '-m', 'Reviewed tag', f.request.baseline]);
  f.approval.refsHash = taskGitRefsHash(f.workspace);
  const previous = check(f).input;
  f.git(['pack-refs', '--all', '--prune']);
  assert.equal(check(f).input.inputId, previous.inputId);
  check(f, undefined, previous.inputId);
  f.git(['update-ref', 'refs/tags/reviewed', f.request.baseline]); // Peels to same commit, different tag object.
  check(f, 'GIT_REFS_MISMATCH', previous.inputId);
});

test('symbolic ref targets are bound even when they resolve to the same commit', t => {
  const f = prepareTaskFixture(t);
  f.git(['update-ref', 'refs/heads/equivalent', f.request.baseline]);
  f.git(['symbolic-ref', 'refs/heads/alias', 'refs/heads/fixture']);
  f.approval.refsHash = taskGitRefsHash(f.workspace);
  const previous = check(f).input;
  f.git(['symbolic-ref', 'refs/heads/alias', 'refs/heads/equivalent']);
  check(f, 'GIT_REFS_MISMATCH', previous.inputId);
});

test('HEAD symbolic target is bound even when resolved branch and commit remain unchanged', t => {
  const f = prepareTaskFixture(t);
  f.git(['symbolic-ref', 'refs/heads/alias', 'refs/heads/fixture']);
  f.approval.refsHash = taskGitRefsHash(f.workspace);
  const previous = check(f).input;
  f.git(['symbolic-ref', 'HEAD', 'refs/heads/alias']);
  assert.equal(f.git(['symbolic-ref', '--short', 'HEAD']), 'fixture');
  assert.equal(f.git(['rev-parse', 'HEAD']), f.request.baseline);
  check(f, 'GIT_REFS_MISMATCH', previous.inputId);
});

for (const configRead of [1, 2]) {
  test(`concurrent side commit after refs capture ${configRead} is refused without rollback`, t => {
    const f = prepareTaskFixture(t), original = fs.readFileSync;
    const registry = readFileSync(join(f.workspace, 'docs', 'registro.md'));
    let count = 0, mutated = false, expectedDisk;
    t.mock.method(fs, 'readFileSync', function (path, ...args) {
      const bytes = original.call(this, path, ...args);
      if (path === join(f.workspace, '.git', 'config') && ++count === configRead) {
        mutated = true;
        f.git(['update-ref', 'refs/heads/concurrent', sideCommit(f)]);
        expectedDisk = diskHash(f.workspace);
      }
      return bytes;
    });
    syncBuiltinESMExports();
    let result;
    try { result = validateTaskInput(f.request, f.approval); }
    finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
    assert.equal(mutated, true);
    assert.equal(result.accepted, false);
    assert.equal(result.reason.code, 'CONCURRENT_CHANGE');
    assert.equal(result.input, null);
    assert.equal(diskHash(f.workspace), expectedDisk, 'only the injected writer changes any bytes');
    assert.deepEqual(readFileSync(join(f.workspace, 'docs', 'registro.md')), registry);
    assert.equal(f.git(['rev-parse', 'HEAD']), f.request.baseline);
    assert.equal(f.git(['symbolic-ref', '--short', 'HEAD']), f.request.branch);
    assert.notEqual(f.git(['rev-parse', 'refs/heads/concurrent']), f.request.baseline);
  });
}

test('revalidation binds the approved change area as well as Git bytes', t => {
  const f = prepareTaskFixture(t), previous = check(f).input;
  f.approval.allowedChanges = ['value.mjs'];
  assert.equal(revalidateTaskInput(f.request, f.approval, previous.inputId).reason.code, 'SNAPSHOT_MISMATCH');
});

for (const phase of ['before-selected-read', 'during-final-snapshot', 'before-final-admission']) {
  test(`concurrent mutation ${phase} is refused and preserved, never rolled back`, t => {
    const f = prepareTaskFixture(t), original = fs.readFileSync;
    const registry = readFileSync(join(f.workspace, 'docs', 'registro.md'));
    const watched = join(f.workspace, phase === 'before-final-admission' ? '.git/config' : phase === 'before-selected-read' ? 'AGENTS.md' : 'docs/plano.md');
    const changed = join(f.workspace, phase === 'before-selected-read' ? 'docs/plano.md' : 'value.mjs');
    let count = 0, mutated = false;
    t.mock.method(fs, 'readFileSync', function (path, ...args) {
      const bytes = original.call(this, path, ...args);
      if (path === watched && ++count === 2) {
        mutated = true;
        if (phase === 'before-final-admission') f.git(['remote', 'add', 'origin', 'https://example.invalid/concurrent']);
        else writeFileSync(changed, original(changed, 'utf8') + '\n// concurrent fictional edit\n');
      }
      return bytes;
    });
    syncBuiltinESMExports();
    let result;
    try { result = validateTaskInput(f.request, f.approval); }
    finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
    assert.equal(mutated, true);
    assert.equal(result.accepted, false);
    assert.equal(result.reason.code, 'CONCURRENT_CHANGE');
    assert.deepEqual(readFileSync(join(f.workspace, 'docs', 'registro.md')), registry);
    if (phase === 'before-final-admission') assert.equal(f.git(['remote']), 'origin');
    else assert.match(readFileSync(changed, 'utf8'), /concurrent fictional edit/u);
  });
}

test('public refusals never echo caller secrets, paths, exception text or Git stderr', t => {
  const f = prepareTaskFixture(t);
  f.request.secret = 'DO-NOT-EXPOSE-SECRET';
  const result = check(f, 'INVALID_REQUEST');
  assert.deepEqual(Object.keys(result.reason), ['code']);
  assert.ok(!JSON.stringify(result).includes(f.workspace));
  assert.ok(!JSON.stringify(result).includes('DO-NOT-EXPOSE'));
});
