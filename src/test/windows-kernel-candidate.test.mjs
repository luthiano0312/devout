import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defaultPiLockRoot, inspectPiLock } from '../pi-lock.mjs';
import { tmpdir } from 'node:os';
import { kernelCandidateSource, validateKernelCandidate, observeKernelCandidate,
  compareKernelCandidates } from '../windows-kernel-candidate.mjs';
import { recordQualification } from './qualify-kernel.mjs';

const code = expected => error => error.code === expected;
function sample(overrides = {}) {
  return { source: kernelCandidateSource, qualified: false, id: '22', machine: 'synthetic-machine',
    build: 19045, architecture: 'AMD64', lastBootUpTime: '2026-11-23T10:00:00Z',
    kernelStart: { recordId: '100', at: '2026-11-23T10:00:00Z' }, powerEvents: [], ...overrides };
}
const sleeping = (id, target = '4', effective = target) => ({ id: 42, recordId: String(id),
  at: '2026-11-23T10:30:00Z', states: { TargetState: target, EffectiveState: effective } });
const resumed = id => ({ id: 107, recordId: String(id), at: '2026-11-23T10:40:00Z', states: {} });

for (const id of ['0', '1', '4294967295']) {
  test(`valid uint32 candidate ${id} remains UNQUALIFIED`, () => {
    assert.equal(validateKernelCandidate(sample({ id })).qualified, false);
  });
}
for (const [name, overrides] of [
  ['missing identity', { id: undefined }], ['numeric identity', { id: 22 }],
  ['GUID', { id: 'abcdef00-0000-0000-0000-000000000000' }], ['overflow', { id: '4294967296' }],
  ['negative', { id: '-1' }], ['noncanonical identity', { id: '022' }],
  ['source absent', { source: undefined }], ['legacy source', { source: 'BootIdentifier' }],
  ['textual qualification', { qualified: true }], ['foreign architecture', { architecture: 'ARM64' }],
  ['unsupported build', { build: 7601 }], ['missing machine', { machine: '' }],
  ['missing CIM', { lastBootUpTime: null }], ['missing event', { kernelStart: {} }],
  ['missing power observations', { powerEvents: undefined }], ['null event', { powerEvents: [null] }],
  ['full event payload', { powerEvents: [sleeping(102, '4'), { ...resumed(103), states: { Message: 'not allowed' } }] }],
]) {
  test(`reject ${name}`, () => assert.throws(() => validateKernelCandidate(sample(overrides)), code('KERNEL_CANDIDATE_INVALID')));
}

test('same kernel is stable but never a recovery/qualification decision', () => {
  const result = compareKernelCandidates(sample(), sample(), 'same-kernel');
  assert.deepEqual(result, { action: 'same-kernel', candidateExpectationMet: true, idChanged: false,
    bootEventChanged: false, cimChanged: false, powerTransitionObserved: false, qualified: false });
  assert.equal('canReconcile' in result, false);
});
for (const action of ['same-kernel', 'after-suspend', 'after-hibernate']) {
  test(`${action}: changed candidate fails, not proof of a reboot`, () => {
    assert.throws(() => compareKernelCandidates(sample(), sample({ id: '23' }), action), code('KERNEL_CANDIDATE_EXPECTATION_FAILED'));
  });
}
for (const [field, value] of [['machine', 'foreign'], ['build', 22631], ['architecture', 'ARM64']]) {
  test(`reject changed context ${field}`, () => assert.throws(() => compareKernelCandidates(sample(), sample({ [field]: value }),
    'after-reboot')));
}
test('reboot observation needs candidate AND independent corroboration, never PID/clock alone', () => {
  const boot = { id: '23', kernelStart: { recordId: '200', at: '2026-11-23T11:00:00Z' }, lastBootUpTime: '2026-11-23T11:00:00Z' };
  for (const overrides of [{}, { id: '23' }, { ...boot, id: '22' },
    { ...boot, lastBootUpTime: sample().lastBootUpTime }, { ...boot, kernelStart: sample().kernelStart }]) {
    assert.throws(() => compareKernelCandidates(sample(), sample(overrides), 'after-reboot'), code('KERNEL_CANDIDATE_EXPECTATION_FAILED'));
  }
  assert.equal(compareKernelCandidates(sample(), sample(boot), 'after-reboot').qualified, false);
});
for (const [action, target] of [['after-suspend', '4'], ['after-hibernate', '5']]) {
  test(`${action}: fresh ordered native sleep/resume events required`, () => {
    const before = sample({ powerEvents: [sleeping(102, target), resumed(103)] });
    for (const events of [[], before.powerEvents, [sleeping(104, target)], [resumed(104)],
      [resumed(104), sleeping(105, target)], [sleeping(104, target, '1'), resumed(105)]]) {
      assert.throws(() => compareKernelCandidates(before, sample({ powerEvents: events }), action), code('KERNEL_POWER_TRANSITION_UNPROVEN'));
    }
    const result = compareKernelCandidates(before, sample({ powerEvents: [sleeping(104, target), resumed(105)] }), action);
    assert.equal(result.powerTransitionObserved, true);
    assert.equal(result.qualified, false);
  });
}
test('unknown/manual textual action never qualifies an identity', () => {
  assert.throws(() => compareKernelCandidates(sample(), sample(), 'force'), code('KERNEL_CANDIDATE_ACTION_INVALID'));
});
test('qualification refuses roots outside its generated synthetic directory', async () => {
  await assert.rejects(recordQualification('same-kernel', join(tmpdir())), code('QUALIFICATION_PATH_INVALID'));
  await assert.rejects(recordQualification('force', tmpdir()), code('QUALIFICATION_ACTION_INVALID'));
});
test('Windows: qualification prepare and independent same-kernel observation preserve valid blocked legacy fixture',
  { skip: process.platform !== 'win32', timeout: 180_000 }, async t => {
    const operationalPath = join(defaultPiLockRoot(), 'lease.json');
    const operationalBytes = async () => {
      try { return await readFile(operationalPath); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    };
    const originalOperational = await operationalBytes();
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const script = fileURLToPath(new URL('./qualify-kernel.mjs', import.meta.url));
    const exec = promisify(execFile);
    const run = async (...args) => {
      const { stdout, stderr } = await exec(process.execPath, [script, ...args], { timeout: 90_000, windowsHide: true });
      assert.equal(stderr, '');
      return JSON.parse(stdout);
    };
    const prepared = await run('prepare');
    const root = prepared.root;
    // Immutable evidence stays outside Git, including on assertion failure.
    t.diagnostic(`Qualification fixture preserved: ${root}`);
    assert.equal(prepared.syntheticBlocked, true);
    assert.equal(prepared.candidateStable, true);
    assert.equal(prepared.operationalPreserved, true);
    assert.equal(prepared.qualified, false);
    const manifestBytes = await readFile(join(root, 'manifest.json'));
    const manifest = JSON.parse(manifestBytes);
    const leaseBytes = await readFile(join(root, 'lease.json'));
    const lease = JSON.parse(leaseBytes);
    assert.equal(lease.schema, 1);
    assert.deepEqual(Object.keys(lease.boot).sort(), ['id', 'machine']);
    assert.match(lease.boot.id, /^[a-f0-9-]{36}$/u);
    assert.equal(lease.boot.machine, manifest.before.machine);
    assert.equal(lease.token, manifest.token);
    assert.equal(lease.phase, 'uncertain');
    assert.equal(lease.process, null);
    assert.equal(manifest.leaseSha256, hash(leaseBytes));
    assert.equal(manifest.operationalSha256, originalOperational === null ? 'absent' : hash(originalOperational));
    const observed = await run('same-kernel', root);
    assert.equal(observed.observationSaved, true);
    assert.equal(observed.comparison.candidateExpectationMet, true);
    assert.equal(observed.comparison.idChanged, false);
    assert.equal(observed.qualified, false);
    assert.equal(observed.automaticRecoveryPerformed, false);
    const evidence = JSON.parse(await readFile(join(root, 'same-kernel.json')));
    assert.equal(evidence.token, manifest.token);
    assert.equal(evidence.syntheticCanAcquire, false);
    assert.equal(evidence.legacyCanReconcile, false);
    assert.equal(evidence.operationalPreserved, true);
    const state = await inspectPiLock({ root });
    assert.deepEqual(state.record, lease);
    assert.equal(state.status, 'blocked');
    assert.equal(state.canAcquire, false);
    assert.equal(state.canReconcile, false);
    assert.deepEqual(await readFile(join(root, 'lease.json')), leaseBytes);
    assert.deepEqual(await readFile(join(root, 'manifest.json')), manifestBytes);
    assert.deepEqual(await operationalBytes(), originalOperational);
    assert.deepEqual((await readdir(root)).sort(), ['guard', 'lease.json', 'manifest.json', 'same-kernel.json']);
  });
test('Windows: independent native reads are stable and stay unqualified', { skip: process.platform !== 'win32', timeout: 90_000 }, async () => {
  const before = await observeKernelCandidate(), after = await observeKernelCandidate();
  assert.equal(compareKernelCandidates(before, after, 'same-kernel').qualified, false);
});
