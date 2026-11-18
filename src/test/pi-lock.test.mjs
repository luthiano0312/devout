import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { acquirePiLock, inspectPiLock, reconcilePiLock } from '../pi-lock.mjs';

const code = expected => error => error.code === expected;
const windows = { skip: process.platform !== 'win32', timeout: 90_000 };
const worker = fileURLToPath(new URL('./fixtures/lock-worker.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/lifecycle-rpc.mjs', import.meta.url));
const exec = promisify(execFile);
const owner = { pid: 123, created: '100', image: 'C:\\node.exe' };
const processIdentity = { pid: 456, created: '200', image: 'C:\\node.exe' };

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'devout lock espaço '));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
// Trusted seams test policy only; Windows tests below use real native guards,
// actual process identities and independent Node invocations.
function model() {
  const state = { held: false, ownerStatus: 'gone', boot: { machine: 'machine', id: 'boot-1' } };
  const dependencies = { openGuard: async () => {
    if (state.held) throw Object.assign(new Error(), { code: 'LOCK_BUSY' });
    state.held = true;
    return { owner, boot: structuredClone(state.boot),
      check: async () => { if (!state.held) throw Object.assign(new Error(), { code: 'LOCK_OBSERVATION_FAILED' }); },
      probe: async () => state.ownerStatus,
      close: async () => { state.held = false; } };
  } };
  return { state, dependencies };
}
function driver(result = {}) {
  const d = { ready: Promise.resolve(), processTree: { identity: processIdentity }, calls: 0,
    shutdown: async () => { d.calls++; return { state: 'terminated', canRelease: true, processesGone: true,
      identity: processIdentity, ...result }; } };
  return d;
}

test('launch intent is durable before factory; only one launch; release awaits the bound Driver', async t => {
  const root = await setup(t), { dependencies } = model();
  const lease = await acquirePiLock({ root, runId: 'a' }, dependencies);
  const d = driver();
  await lease.launch({}, () => {
    assert.equal(lease.metadata.phase, 'launching');
    assert.equal(JSON.parse(readFileSync(join(root, 'lease.json'), 'utf8')).phase, 'launching');
    return d;
  });
  const disk = JSON.parse(await readFile(join(root, 'lease.json'), 'utf8'));
  assert.equal(disk.phase, 'running');
  assert.deepEqual(disk.process, processIdentity);
  await assert.rejects(lease.launch({}, () => { throw new Error('must not run'); }), code('LOCK_ALREADY_LAUNCHED'));
  const mutated = lease.metadata; mutated.process.created = 'bad';
  const first = lease.finish();
  assert.strictEqual(lease.finish(), first);
  assert.equal((await first).released, true);
  assert.equal(d.calls, 1);
  assert.ok((await readdir(root)).includes(`retired-${lease.token}.json`));
  assert.equal((await inspectPiLock({ root }, dependencies)).canAcquire, true);
  await assert.rejects(lease.launch({}), code('LOCK_LEASE_CLOSED'));
});

test('synchronous factory failure never rolls launch intent back', async t => {
  const root = await setup(t), { dependencies } = model();
  const lease = await acquirePiLock({ root, runId: 'bad-launch' }, dependencies);
  await assert.rejects(lease.launch({}, () => { throw new Error('spawn may have occurred'); }));
  assert.equal(JSON.parse(await readFile(join(root, 'lease.json'), 'utf8')).phase, 'uncertain');
  await assert.rejects(lease.finish(), code('LOCK_PROCESS_UNCERTAIN'));
  assert.equal((await inspectPiLock({ root }, dependencies)).canReconcile, false);
  await assert.rejects(acquirePiLock({ root, runId: 'second' }, dependencies), code('LOCK_RECONCILIATION_REQUIRED'));
});

for (const [name, result] of [
  ['uncertain', { state: 'uncertain', canRelease: false }],
  ['exit success alone', { processesGone: false }],
  ['PID reused', { identity: { ...processIdentity, created: '999' } }],
  ['missing identity', { identity: null }],
]) {
  test(`${name}: release retains the blocking record`, async t => {
    const root = await setup(t), { dependencies } = model();
    const lease = await acquirePiLock({ root, runId: name }, dependencies);
    await lease.launch({}, () => driver(result));
    await assert.rejects(lease.finish(), code('LOCK_PROCESS_UNCERTAIN'));
    const assessment = await inspectPiLock({ root }, dependencies);
    assert.equal(assessment.canAcquire, false);
    assert.equal(assessment.canReconcile, false);
    await assert.rejects(reconcilePiLock({ root, expectedToken: lease.token }, dependencies), code('LOCK_RECONCILIATION_UNPROVEN'));
  });
}

test('dead owner before launch needs explicit reconciliation; stale token cannot remove a new lease', async t => {
  const root = await setup(t), { dependencies } = model();
  const lease = await acquirePiLock({ root, runId: 'dead' }, dependencies);
  await lease.abandon();
  await assert.rejects(acquirePiLock({ root, runId: 'no-auto-recovery' }, dependencies), code('LOCK_RECONCILIATION_REQUIRED'));
  const assessment = await inspectPiLock({ root }, dependencies);
  assert.equal(assessment.reason, 'OWNER_GONE_BEFORE_LAUNCH');
  await assert.rejects(reconcilePiLock({ root, expectedToken: 'old-token' }, dependencies), code('LOCK_OWNER_CHANGED'));
  assert.equal((await reconcilePiLock({ root, expectedToken: lease.token }, dependencies)).reconciled, true);
  const next = await acquirePiLock({ root, runId: 'next' }, dependencies);
  await next.abandon();
  await assert.rejects(reconcilePiLock({ root, expectedToken: lease.token }, dependencies), code('LOCK_OWNER_CHANGED'));
});

for (const status of ['alive', 'unknown']) {
  test(`owner ${status} blocks even when no Pi was launched`, async t => {
    const root = await setup(t), { state, dependencies } = model();
    const lease = await acquirePiLock({ root, runId: status }, dependencies);
    await lease.abandon(); state.ownerStatus = status;
    assert.equal((await inspectPiLock({ root }, dependencies)).canReconcile, false);
  });
}

test('PID reuse proves old owner absent, not a launched tree gone', async t => {
  const root = await setup(t), { state, dependencies } = model();
  const lease = await acquirePiLock({ root, runId: 'reuse' }, dependencies);
  await lease.launch({}, () => driver());
  await lease.abandon(); state.ownerStatus = 'reused';
  assert.equal((await inspectPiLock({ root }, dependencies)).canReconcile, false);
});

test('new kernel boot of the SAME machine is explicit proof for an uncertain old tree', async t => {
  const root = await setup(t), { state, dependencies } = model();
  const lease = await acquirePiLock({ root, runId: 'crashed' }, dependencies);
  await lease.launch({}, () => driver());
  await lease.abandon();
  state.boot = { machine: 'different-machine', id: 'boot-2' };
  assert.equal((await inspectPiLock({ root }, dependencies)).canReconcile, false);
  state.boot = { machine: 'machine', id: 'boot-2' };
  const assessment = await inspectPiLock({ root }, dependencies);
  assert.equal(assessment.reason, 'PRIOR_BOOT_ENDED');
  assert.equal((await reconcilePiLock({ root, expectedToken: lease.token }, dependencies)).reconciled, true);
  assert.equal((await inspectPiLock({ root }, dependencies)).canAcquire, true);
});

test('durable termination receipt recovers a crash between termination and retirement', async t => {
  const root = await setup(t), { dependencies } = model();
  const lease = await acquirePiLock({ root, runId: 'receipt' }, dependencies);
  await lease.launch({}, () => driver());
  const record = lease.metadata;
  record.phase = 'terminated';
  record.termination = { state: 'terminated', canRelease: true, processesGone: true, identity: processIdentity };
  await lease.abandon();
  await writeFile(join(root, 'lease.json'), JSON.stringify(record)); // crash-point fixture
  assert.equal((await inspectPiLock({ root }, dependencies)).reason, 'DURABLE_TERMINATION');
  await reconcilePiLock({ root, expectedToken: lease.token }, dependencies);
});

test('lost native guard prevents launch and preserves the durable intent', async t => {
  const root = await setup(t), { state, dependencies } = model();
  const lease = await acquirePiLock({ root, runId: 'lost-guard' }, dependencies);
  state.held = false;
  let launches = 0;
  await assert.rejects(lease.launch({}, () => { launches++; return driver(); }), code('LOCK_OBSERVATION_FAILED'));
  assert.equal(launches, 0);
  await assert.rejects(lease.finish(), code('LOCK_OBSERVATION_FAILED'));
  state.ownerStatus = 'alive';
  assert.equal((await inspectPiLock({ root }, dependencies)).reason, 'OWNER_ALIVE');
});

test('truncated metadata fails closed and is never overwritten', async t => {
  const root = await setup(t), { dependencies } = model();
  await writeFile(join(root, 'lease.json'), '{"schema":');
  await assert.rejects(acquirePiLock({ root, runId: 'corrupt' }, dependencies), code('LOCK_METADATA_INVALID'));
  assert.equal((await inspectPiLock({ root }, dependencies)).canAcquire, false);
  await assert.rejects(reconcilePiLock({ root, expectedToken: 'anything' }, dependencies), code('LOCK_METADATA_INVALID'));
  assert.equal(await readFile(join(root, 'lease.json'), 'utf8'), '{"schema":');
});

test('finish without a launch is safe, and finishing cannot overtake a pending launch', async t => {
  const root = await setup(t), { dependencies } = model();
  const empty = await acquirePiLock({ root, runId: 'empty' }, dependencies);
  assert.equal((await empty.finish()).released, true);
  const lease = await acquirePiLock({ root, runId: 'pending' }, dependencies);
  const d = driver(); let ready;
  d.ready = new Promise(resolve => { ready = resolve; });
  const launching = lease.launch({}, () => d);
  await assert.rejects(lease.abandon(), code('LOCK_OPERATION_PENDING'));
  const finished = lease.finish();
  await assert.rejects(lease.launch({}, () => d), code('LOCK_LEASE_CLOSED'));
  ready(); await launching;
  assert.equal((await finished).released, true);
});

async function spawnWorker(t) {
  const child = spawn(process.execPath, [worker], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const messages = [], waiters = [];
  child.stdout.resume(); child.stderr.resume();
  child.on('message', value => {
    if (waiters.length) waiters.shift()(value); else messages.push(value);
  });
  const closed = new Promise(resolve => child.once('close', resolve));
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await closed; });
  const next = () => messages.length ? Promise.resolve(messages.shift()) : new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('worker message timeout')), 40_000);
    waiters.push(value => { clearTimeout(timeout); resolve(value); });
  });
  assert.equal((await next()).type, 'ready');
  return { child, next, closed };
}
async function windowsRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'devout lock integração '));
  let verified = false;
  t.after(async () => {
    if (verified) await rm(root, { recursive: true, force: true });
    else t.diagnostic(JSON.stringify({ reconciliationRequired: true, preservedWorkspace: root }));
  });
  return { root, complete: () => { verified = true; } };
}
async function disposablePi(root) {
  const piCmd = join(root, 'pi.cmd');
  await writeFile(piCmd, `@echo off\r\n"${process.execPath}" "${fixture}" normal\r\n`);
  return { piCmd, cwd: root, launch: true };
}
async function inspected(root) {
  for (let i = 0; i < 20; i++) {
    const result = await inspectPiLock({ root });
    if (result.reason !== 'LOCK_BUSY') return result;
    await delay(50);
  }
  throw new Error('guard did not close after worker exit');
}
async function pidsGone(identities) {
  const ids = [...new Set(identities.map(item => item.pid))];
  for (let i = 0; i < 20; i++) {
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `$ids=@(${ids.join(',')}); @((Get-CimInstance Win32_Process) | Where-Object { $ids -contains [int]$_.ProcessId }).Count`],
    { windowsHide: true, timeout: 15_000 });
    if (Number(stdout.trim()) === 0) return;
    await delay(100);
  }
  assert.fail('Disposable fake Pi processes survived; reconcile test workspace');
}

test('Windows T08: independent simultaneous Node invocations authorize only one fake Pi; verified exit admits next', windows, async t => {
  const { root, complete } = await windowsRoot(t), config = await disposablePi(root);
  const workers = await Promise.all([spawnWorker(t), spawnWorker(t), spawnWorker(t)]);
  // Barrier: all independent processes are ready before any attempts acquisition.
  workers.forEach((w, i) => w.child.send({ root, runId: `race-${i}`, ...config }));
  const results = await Promise.all(workers.map(w => w.next()));
  assert.equal(results.filter(value => value.type === 'acquired').length, 1);
  assert.equal(results.filter(value => value.type === 'blocked' && ['LOCK_BUSY', 'LOCK_RECONCILIATION_REQUIRED'].includes(value.code)).length, 2);
  assert.equal((await inspectPiLock({ root })).canAcquire, false);
  const index = results.findIndex(value => value.type === 'acquired');
  workers[index].child.send('finish');
  assert.deepEqual(await workers[index].next(), { type: 'released', canRelease: true });
  await pidsGone(results[index].observed);
  const next = await spawnWorker(t);
  next.child.send({ root, runId: 'after-confirmed-exit', ...config });
  assert.equal((await next.next()).type, 'acquired');
  next.child.send('finish');
  assert.equal((await next.next()).type, 'released');
  t.diagnostic(JSON.stringify({ contenders: 3, authorized: 1, duplicateFakePiLaunches: 0, nextAfterVerifiedExit: true }));
  complete();
});

test('Windows: dead owner before launch is not silently removed; explicit reconciliation serializes contenders', windows, async t => {
  const { root, complete } = await windowsRoot(t), w = await spawnWorker(t);
  w.child.send({ root, runId: 'crash-before-launch', launch: false });
  const acquired = await w.next(); assert.equal(acquired.type, 'acquired');
  w.child.kill(); await w.closed;
  const assessment = await inspected(root);
  assert.equal(assessment.ownerStatus, 'gone');
  assert.equal(assessment.canReconcile, true);
  await assert.rejects(acquirePiLock({ root, runId: 'must-not-auto-clear' }), code('LOCK_RECONCILIATION_REQUIRED'));
  const results = await Promise.allSettled([1, 2].map(() => reconcilePiLock({ root, expectedToken: acquired.token })));
  assert.equal(results.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal((await inspectPiLock({ root })).canAcquire, true);
  complete();
});

test('Windows: live original owner and a recycled PID are distinguished by native creation identity', windows, async t => {
  const { root, complete } = await windowsRoot(t);
  const lease = await acquirePiLock({ root, runId: 'identity' });
  const record = lease.metadata;
  await lease.abandon();
  assert.equal((await inspectPiLock({ root })).reason, 'OWNER_ALIVE');
  record.owner.created = '1'; // PID is still alive, but is NOT this recorded owner.
  await writeFile(join(root, 'lease.json'), JSON.stringify(record));
  const assessment = await inspectPiLock({ root });
  assert.equal(assessment.ownerStatus, 'reused');
  assert.equal(assessment.canReconcile, true); // no launch intent ever existed
  await reconcilePiLock({ root, expectedToken: lease.token });
  assert.equal(process.pid, record.owner.pid); // no signal is sent to recycled PIDs
  complete();
});

test('Windows T08: crash after fake Pi launch leaves uncertainty blocking all new sessions', windows, async t => {
  const { root, complete } = await windowsRoot(t), config = await disposablePi(root), w = await spawnWorker(t);
  w.child.send({ root, runId: 'crash-after-launch', ...config });
  const acquired = await w.next(); assert.equal(acquired.type, 'acquired');
  w.child.kill(); await w.closed;
  // Test fixture honors EOF. Even observed PIDs disappearing cannot prove the
  // lost kernel Job had no unobserved descendants: production remains blocked.
  await pidsGone(acquired.observed);
  const assessment = await inspected(root);
  assert.equal(assessment.ownerStatus, 'gone');
  assert.equal(assessment.canAcquire, false);
  assert.equal(assessment.canReconcile, false);
  const next = await spawnWorker(t);
  next.child.send({ root, runId: 'blocked-after-crash', ...config });
  assert.equal((await next.next()).type, 'blocked');
  await assert.rejects(reconcilePiLock({ root, expectedToken: acquired.token }), code('LOCK_RECONCILIATION_UNPROVEN'));
  assert.equal(JSON.parse(await readFile(join(root, 'lease.json'), 'utf8')).token, acquired.token);
  // Isolated fixture only: its known finite tree is gone. This test teardown
  // is not production reconciliation and never authorizes another Pi.
  complete();
});
