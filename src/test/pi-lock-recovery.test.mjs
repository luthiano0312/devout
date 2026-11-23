import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { acquirePiLock, inspectPiLock, anchorPiLock, reconcilePiLock } from '../pi-lock.mjs';
import { qualifiedKernelIdentity, priorKernelEnded } from '../kernel-identity.mjs';
import { observeKernelCandidate } from '../windows-kernel-candidate.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const code = expected => error => error.code === expected;
const boot = (id = '100', extra = {}) => ({ source: 'windows-kuser-shared-data-bootid-v1',
  id, machine: 'synthetic-machine', build: 19045, architecture: 'AMD64', ...extra });
const owner = { pid: 123, created: '1000', image: 'C:\\node.exe' };
async function fixture(t, legacy = true) {
  const root = await mkdtemp(join(tmpdir(), 'devout recovery policy '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = { held: false, boot: boot(), status: 'gone', onProbe: async () => {}, onCheck: async () => {} };
  const dependencies = { openGuard: async () => {
    if (state.held) throw Object.assign(new Error(), { code: 'LOCK_BUSY' });
    state.held = true;
    return { owner, boot: structuredClone(state.boot),
      probe: async () => { await state.onProbe(); return state.status; },
      check: async () => { await state.onCheck(); if (!state.held) throw Object.assign(new Error(), { code: 'LOCK_OBSERVATION_FAILED' }); },
      close: async () => { state.held = false; } };
  } };
  const lease = await acquirePiLock({ root, runId: 'synthetic-recovery' }, dependencies);
  const record = lease.metadata;
  await lease.abandon();
  record.phase = 'uncertain'; // deterministic synthetic fixture; NO Pi/Driver exists
  if (legacy) { record.schema = 1; record.boot = { machine: state.boot.machine, id: 'legacy-guid' }; }
  const original = JSON.stringify(record, null, 2) + '\n';
  await writeFile(join(root, 'lease.json'), original);
  const args = { root, expectedToken: record.token, expectedLeaseSha256: hash(original) };
  const anchorFile = join(root, `anchor-${record.token}.json`);
  return { root, state, record, original, dependencies, args, anchorFile,
    anchor: () => anchorPiLock(args, dependencies), inspect: () => inspectPiLock({ root }, dependencies),
    reconcile: () => reconcilePiLock(args, dependencies) };
}

test('Windows: persisted native identity agrees with the independent qualification collector',
  { skip: process.platform !== 'win32', timeout: 90_000 }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'devout kernel capture '));
    t.after(() => rm(root, { recursive: true, force: true }));
    const lease = await acquirePiLock({ root, runId: 'native-identity-parity' });
    try {
      const sample = await observeKernelCandidate();
      assert.equal(lease.metadata.schema, 2);
      assert.equal(qualifiedKernelIdentity(lease.metadata.boot), true);
      for (const key of ['source', 'id', 'build', 'architecture', 'machine']) {
        assert.equal(lease.metadata.boot[key], sample[key], key);
      }
    } finally { assert.equal((await lease.finish()).released, true); }
  });

test('qualified source is strict: no GUID, text flag, other build/architecture, overflow or rollback', () => {
  assert.equal(qualifiedKernelIdentity(boot()), true);
  for (const value of [null, { id: '101', machine: 'synthetic-machine', qualified: true },
    boot('001'), boot('-1'), boot('4294967296'), boot('guid'), boot('1', { build: 22631 }),
    boot('1', { architecture: 'ARM64' }), boot('1', { source: 'other' })]) {
    assert.equal(qualifiedKernelIdentity(value), false);
    assert.equal(priorKernelEnded(value, boot('101')), false);
  }
  for (const current of [boot('100'), boot('99'), boot('0'), boot('101', { machine: 'other' })]) {
    assert.equal(priorKernelEnded(boot(), current), false);
  }
  assert.equal(priorKernelEnded(boot(), boot('101')), true);
});

test('new schema records source and can recover only after qualified kernel advance + absent owner', async t => {
  const f = await fixture(t, false);
  assert.equal(f.record.schema, 2);
  assert.equal((await f.inspect()).canReconcile, false);
  await assert.rejects(f.anchor(), code('LOCK_ANCHOR_UNPROVEN'));
  f.state.boot = boot('101');
  assert.equal((await f.inspect()).reason, 'NATIVE_PRIOR_KERNEL_ENDED');
  assert.equal((await f.reconcile()).reconciled, true);
  assert.equal(await readFile(join(f.root, `retired-${f.record.token}.json`), 'utf8'), f.original);
});

test('legacy anchor preserves original bytes; same kernel blocked; later explicit reconciliation preserves all proof', async t => {
  const f = await fixture(t);
  assert.equal((await f.inspect()).canAnchor, true);
  const result = await f.anchor();
  assert.equal(result.anchored, true); assert.equal(result.canReconcile, false);
  assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original);
  assert.equal(result.anchor.leaseSha256, hash(f.original));
  assert.deepEqual(result.anchor.boot, boot());
  assert.equal((await f.inspect()).canReconcile, false);
  await assert.rejects(f.reconcile(), code('LOCK_RECONCILIATION_UNPROVEN'));
  await assert.rejects(f.anchor(), code('LOCK_ANCHOR_EXISTS'));
  const anchorBytes = await readFile(f.anchorFile);
  f.state.boot = boot('101');
  assert.equal((await f.inspect()).reason, 'ANCHORED_PRIOR_KERNEL_ENDED');
  assert.equal((await f.inspect()).canAcquire, false);
  await assert.rejects(acquirePiLock({ root: f.root, runId: 'no-auto-recovery' }, f.dependencies), code('LOCK_RECONCILIATION_REQUIRED'));
  assert.equal((await f.reconcile()).reconciled, true);
  assert.equal(await readFile(join(f.root, `retired-${f.record.token}.json`), 'utf8'), f.original);
  assert.deepEqual(await readFile(f.anchorFile), anchorBytes);
  const proofName = (await readdir(f.root)).find(name => name.startsWith('reconciliation-'));
  const proof = JSON.parse(await readFile(join(f.root, proofName), 'utf8'));
  assert.equal(proof.leaseSha256, hash(f.original)); assert.equal(proof.anchorSha256, hash(anchorBytes));
  assert.equal((await f.inspect()).canAcquire, true);
});

test('reboot BEFORE anchor is not proof for legacy; only later kernel advance counts', async t => {
  const f = await fixture(t);
  f.state.boot = boot('101');
  assert.equal((await f.inspect()).canReconcile, false);
  await f.anchor();
  await assert.rejects(f.reconcile(), code('LOCK_RECONCILIATION_UNPROVEN'));
  f.state.boot = boot('102');
  assert.equal((await f.reconcile()).reconciled, true);
});

for (const status of ['alive', 'unknown']) {
  test(`owner ${status} blocks anchoring and even prior-kernel recovery`, async t => {
    const f = await fixture(t); f.state.status = status;
    await assert.rejects(f.anchor(), code('LOCK_ANCHOR_UNPROVEN'));
    f.state.status = 'gone'; await f.anchor();
    f.state.boot = boot('101'); f.state.status = status;
    await assert.rejects(f.reconcile(), code('LOCK_RECONCILIATION_UNPROVEN'));
    assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original);
  });
}
for (const value of [boot('101', { machine: 'other' }), boot('101', { source: 'unknown', qualified: true }),
  boot('101', { build: 22631 }), boot('101', { architecture: 'ARM64' }),
  { machine: 'synthetic-machine', id: 'legacy-guid-changed' }]) {
  test(`missing/foreign proof blocks: ${JSON.stringify(value)}`, async t => {
    const f = await fixture(t); await f.anchor(); f.state.boot = value;
    assert.equal((await f.inspect()).canReconcile, false);
    await assert.rejects(f.reconcile(), code('LOCK_RECONCILIATION_UNPROVEN'));
  });
}

test('token and inspected digest mismatch cannot anchor/reconcile a different snapshot', async t => {
  const f = await fixture(t);
  for (const action of [anchorPiLock, reconcilePiLock]) {
    await assert.rejects(action({ ...f.args, expectedToken: 'old-token' }, f.dependencies), code('LOCK_OWNER_CHANGED'));
    await assert.rejects(action({ ...f.args, expectedLeaseSha256: '0'.repeat(64) }, f.dependencies), code('LOCK_INTEGRITY_CHANGED'));
  }
  assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original);
});
for (const field of ['token', 'leaseSha256', 'boot', 'at', 'by', 'integritySha256']) {
  test(`altered anchor ${field} is invalid, never silently replaced`, async t => {
    const f = await fixture(t); await f.anchor();
    const anchor = JSON.parse(await readFile(f.anchorFile));
    anchor[field] = field === 'boot' ? boot('99') : field === 'by' ? { ...owner, created: '999' } : 'changed';
    const bytes = JSON.stringify(anchor); await writeFile(f.anchorFile, bytes);
    f.state.boot = boot('101');
    assert.equal((await f.inspect()).reason, 'LOCK_ANCHOR_INVALID');
    await assert.rejects(f.reconcile(), code('LOCK_ANCHOR_INVALID'));
    await assert.rejects(f.anchor(), code('LOCK_ANCHOR_INVALID'));
    assert.equal(await readFile(f.anchorFile, 'utf8'), bytes);
  });
}
test('partial/corrupt anchor fails closed and preserves lease', async t => {
  const f = await fixture(t); await writeFile(f.anchorFile, '{');
  assert.equal((await f.inspect()).reason, 'LOCK_ANCHOR_INVALID');
  await assert.rejects(f.reconcile(), code('LOCK_ANCHOR_INVALID'));
  assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original);
});
test('lease byte change after anchor invalidates its hash, even when JSON semantics are unchanged', async t => {
  const f = await fixture(t); await f.anchor();
  await writeFile(join(f.root, 'lease.json'), f.original + '\n'); f.state.boot = boot('101');
  assert.equal((await f.inspect()).reason, 'LOCK_ANCHOR_INVALID');
  await assert.rejects(f.reconcile(), code('LOCK_ANCHOR_INVALID'));
});
for (const action of ['anchor', 'reconcile']) {
  test(`concurrent lease change during ${action} cannot retire it`, async t => {
    const f = await fixture(t);
    if (action === 'reconcile') { await f.anchor(); f.state.boot = boot('101'); }
    f.state.onProbe = async () => { await writeFile(join(f.root, 'lease.json'), f.original + ' '); };
    await assert.rejects(f[action]());
    assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original + ' ');
    assert.equal((await readdir(f.root)).some(name => name.startsWith('retired-')), false);
  });
}
test('concurrent anchor alteration during final guard check prevents retirement', async t => {
  const f = await fixture(t); await f.anchor(); f.state.boot = boot('101');
  let checks = 0;
  f.state.onCheck = async () => { if (++checks === 2) await writeFile(f.anchorFile, '{'); };
  await assert.rejects(f.reconcile(), code('LOCK_ANCHOR_INVALID'));
  assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original);
});
test('guard failure prevents reconciliation', async t => {
  const f = await fixture(t); await f.anchor(); f.state.boot = boot('101');
  f.state.onCheck = async () => { f.state.held = false; };
  await assert.rejects(f.reconcile(), code('LOCK_OBSERVATION_FAILED'));
  assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original);
});
test('concurrent anchoring serializes contenders, without changing the lease', async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled([f.anchor(), f.anchor()]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original);
});
test('archive collision preserves existing evidence and the active lease', async t => {
  const f = await fixture(t, false); f.state.boot = boot('101');
  const target = join(f.root, `retired-${f.record.token}.json`);
  await writeFile(target, 'previous evidence');
  await assert.rejects(f.reconcile(), code('LOCK_ARCHIVE_EXISTS'));
  assert.equal(await readFile(target, 'utf8'), 'previous evidence');
  assert.equal(await readFile(join(f.root, 'lease.json'), 'utf8'), f.original);
});
test('unqualified current identity cannot be persisted as a new lease', async t => {
  const f = await fixture(t);
  f.state.boot = { machine: 'synthetic-machine', id: 'GUID', qualified: true };
  await assert.rejects(acquirePiLock({ root: join(f.root, 'new-acquisition'), runId: 'unqualified' }, f.dependencies), code('LOCK_BOOT_UNQUALIFIED'));
});
