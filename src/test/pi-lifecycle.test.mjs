import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PiDriver, startPi } from '../pi-driver.mjs';
const fixture = fileURLToPath(new URL('./fixtures/lifecycle-rpc.mjs', import.meta.url));
const transportFixture = fileURLToPath(new URL('./fixtures/fake-rpc.mjs', import.meta.url));
const exec = promisify(execFile);
const windows = { skip: process.platform !== 'win32' };
const code = expected => error => error.code === expected;

async function fake(t, snapshot, force = async () => ({ exitCode: 0 })) {
  const child = spawn(process.execPath, [transportFixture, 'normal'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const observer = { ready: Promise.resolve(), identity: { pid: child.pid, created: 'test-identity' },
    snapshot, force, dispose: async () => {} };
  const driver = new PiDriver(child, { processTree: observer, normalWaitMs: 20, forceWaitMs: 20, pollMs: 5 });
  t.after(async () => { driver.closeInput(); await driver.closed; await driver.cancel(); });
  await driver.ready;
  return driver;
}

test('no trusted observer means uncertain, never permission to start another run', async () => {
  const child = spawn(process.execPath, [transportFixture, 'normal'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const d = new PiDriver(child);
  await d.ready;
  const result = await d.shutdown();
  await d.closed;
  assert.equal(result.state, 'uncertain');
  assert.equal(result.canRelease, false);
  assert.equal(result.reason, 'NO_PROCESS_OBSERVER');
});

test('unavailable identity fails closed without a force attempt', async t => {
  let forces = 0;
  const d = await fake(t, async () => { throw Object.assign(new Error(), { code: 'AMBIGUOUS_IDENTITY' }); },
    async () => { forces++; });
  let reentrant;
  d.on('lifecycle', state => { if (state === 'stopping') reentrant = d.cancel(); });
  const stopping = d.cancel();
  assert.strictEqual(reentrant, stopping);
  const result = await stopping;
  assert.equal(result.state, 'uncertain');
  assert.equal(result.canRelease, false);
  assert.equal(result.reason, 'AMBIGUOUS_IDENTITY');
  assert.equal(forces, 0);
  assert.strictEqual(d.cancel(), d.shutdown());
  await assert.rejects(d.getState(), /closed/);
});

test('root gone with a surviving descendant never targets its old PID', async t => {
  let forces = 0;
  const d = await fake(t, async () => ({ rootAlive: false, members: [{ pid: 12345, created: 'child' }] }),
    async () => { forces++; });
  const result = await d.shutdown();
  assert.equal(result.reason, 'ROOT_GONE_WITH_DESCENDANTS');
  assert.equal(result.canRelease, false);
  assert.equal(forces, 0);
});

test('identity changed at force boundary refuses killing and stays uncertain', async t => {
  const d = await fake(t, async () => ({ rootAlive: true, members: [{ pid: 12345, created: 'old' }] }),
    async () => { throw Object.assign(new Error(), { code: 'IDENTITY_CHANGED' }); /* no kill */ });
  const result = await d.shutdown();
  assert.equal(result.reason, 'IDENTITY_CHANGED');
  assert.equal(result.canRelease, false);
});

test('taskkill exit 0 alone never proves termination', async t => {
  let forces = 0;
  const d = await fake(t, async () => ({ rootAlive: true, members: [{ pid: 12345, created: 'still-alive' }] }),
    async () => { forces++; return { exitCode: 0 }; });
  const result = await d.shutdown();
  assert.equal(result.taskkillExitCode, 0);
  assert.equal(result.reason, 'PROCESS_SURVIVED');
  assert.equal(result.processesGone, false);
  assert.equal(result.canRelease, false);
  await d.cancel();
  assert.equal(forces, 1);
});

async function real(t, mode, options = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'devout lifecycle espaço '));
  const piCmd = join(workspace, 'pi.cmd');
  await writeFile(piCmd, `@echo off\r\n"${process.execPath}" "${fixture}" ${mode}\r\n`);
  const normalWaitMs = ['resistant', 'silent', 'invalid-resistant', 'abort-silent'].includes(mode) ? 400 : 2000;
  const d = startPi({ piCmd, cwd: workspace, normalWaitMs, forceWaitMs: 5000, pollMs: 30,
    abortTimeoutMs: 200, ...options });
  t.after(async () => {
    const result = await d.cancel();
    if (!result.canRelease) console.error(JSON.stringify({ reconciliationRequired: true, workspace, ...result }));
    assert.equal(result.canRelease, true, `Reconcile owned process ${d.child.pid} in ${workspace}: ${result.reason}`);
    await rm(workspace, { recursive: true, force: true });
  });
  await d.ready;
  return d;
}

async function independentGone(t, result) {
  // Independent CIM inspection, in addition to the persistent kernel Job proof.
  const ids = [...new Set(result.observed.map(item => item.pid))];
  assert.ok(ids.length > 0);
  const script = `$ids=@(${ids.join(',')}); @((Get-CimInstance Win32_Process) | Where-Object { $ids -contains [int]$_.ProcessId }).Count`;
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15_000, windowsHide: true });
  assert.equal(Number(stdout.trim()), 0, 'Observed disposable PIDs must be absent');
  t.diagnostic(JSON.stringify({ identity: { pid: result.identity.pid, created: result.identity.created },
    observed: result.observed, forced: result.forced, taskkillExitCode: result.taskkillExitCode,
    independentRemainingPids: 0, canRelease: result.canRelease, workCompleted: result.workCompleted,
    failureCode: result.failureCode }));
}

test('Windows: normal work then verified tree exit; starting/running/stopping/terminated', windows, async t => {
  const d = await real(t, 'normal');
  assert.equal(d.lifecycle, 'running');
  await d.promptAndWait('harmless');
  const states = [];
  d.on('lifecycle', state => states.push(state));
  const result = await d.shutdown();
  assert.deepEqual(states, ['stopping', 'terminated']);
  assert.equal(result.forced, false);
  assert.equal(result.workCompleted, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.canRelease, true);
  assert.equal(typeof result.identity.created, 'string');
  await independentGone(t, result);
});

test('Windows: normal shutdown refuses active work, abort acknowledgement is not exit', windows, async t => {
  const d = await real(t, 'waiting');
  const run = d.promptAndWait('harmless');
  const rejected = assert.rejects(run, code('CANCELLED'));
  // get_state is correlated after the prompt, so the run has started.
  assert.equal((await d.getState()).data.isStreaming, true);
  await assert.rejects(d.shutdown(), code('WORK_ACTIVE'));
  const stop = d.cancel();
  assert.strictEqual(d.cancel(), stop);
  await assert.rejects(d.getState(), code('STOPPING'));
  const result = await stop;
  await rejected;
  assert.equal(result.abortAccepted, true);
  assert.equal(result.forced, false);
  assert.equal(result.workCompleted, false);
  assert.equal(result.canRelease, true);
  await independentGone(t, result);
});

test('Windows: resistant multigeneration tree, verified taskkill, repetition leaves unrelated process alone', windows, async t => {
  const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  t.after(() => sentinel.kill()); // Owned test handle only; never taskkill this sentinel.
  const d = await real(t, 'resistant');
  await d.getState();
  // Ensure even the grandchild exists before inspection; no race-dependent count.
  let snapshot;
  for (let i = 0; i < 100; i++) {
    snapshot = await d.processTree.snapshot();
    if (snapshot.members.length >= 5) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(snapshot.members.length >= 5);
  const result = await d.cancel();
  assert.equal(result.abortAccepted, true);
  assert.equal(result.forced, true);
  assert.equal(result.taskkillExitCode, 0);
  assert.equal(result.canRelease, true);
  assert.equal(result.workCompleted, false);
  assert.strictEqual(await d.shutdown(), result);
  assert.strictEqual(await d.cancel(), result);
  assert.equal(sentinel.exitCode, null);
  await independentGone(t, result);
});

for (const [mode, expected] of [['silent', 'COMMAND_TIMEOUT'], ['invalid-resistant', 'INVALID_JSON'], ['eof', 'EARLY_EOF']]) {
  test(`Windows: ${mode} is a failure, but bounded cleanup proves tree exit`, windows, async t => {
    // ready acknowledges the launcher, not the Node fixture's RPC readiness.
    const d = await real(t, mode, { commandTimeoutMs: mode === 'silent' ? 500 : 5000 });
    await assert.rejects(d.getState(), code(expected));
    const result = await d.cancel();
    assert.equal(result.failureCode, expected);
    assert.equal(result.canRelease, true);
    assert.equal(result.workCompleted, false);
    assert.equal(result.forced, mode !== 'eof');
    await independentGone(t, result);
  });
}

test('Windows: abort deadline escalates, without accepting acknowledgement as exit', windows, async t => {
  const d = await real(t, 'abort-silent');
  await d.getState();
  const result = await d.cancel();
  assert.equal(result.abortAccepted, false);
  assert.equal(result.failureCode, 'COMMAND_TIMEOUT');
  assert.equal(result.forced, true);
  assert.equal(result.canRelease, true);
  await independentGone(t, result);
});

test('Windows: rejected abort still requests EOF and verifies exit', windows, async t => {
  const d = await real(t, 'abort-reject');
  await d.getState();
  const result = await d.cancel();
  assert.equal(result.abortAccepted, false);
  assert.equal(result.forced, false);
  assert.equal(result.canRelease, true);
  assert.equal(result.workCompleted, false);
  await independentGone(t, result);
});

test('Windows: abnormal orderly exit is not functional completion', windows, async t => {
  const d = await real(t, 'bad-exit');
  await d.getState();
  const result = await d.shutdown();
  assert.equal(result.exitCode, 7);
  assert.equal(result.failureCode, 'PROCESS_EXIT');
  assert.equal(result.canRelease, true);
  assert.equal(result.workCompleted, false);
  await independentGone(t, result);
});

test('validates lifecycle deadlines before creating a process', windows, () => {
  for (const key of ['abortTimeoutMs', 'normalWaitMs', 'forceWaitMs', 'forceCommandMs', 'pollMs']) {
    assert.throws(() => startPi({ [key]: 0 }), TypeError);
    assert.throws(() => startPi({ [key]: Infinity }), TypeError);
  }
});
