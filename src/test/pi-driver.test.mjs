import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PiDriver, startPi, windowsLaunchSpec } from '../pi-driver.mjs';

const fixture = fileURLToPath(new URL('./fixtures/fake-rpc.mjs', import.meta.url));
const code = expected => error => error.code === expected;
async function deadline(promise, ms = 5000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Test child did not close')), ms);
    })]);
  } finally { clearTimeout(timer); }
}
async function driverFor(t, mode = 'normal', options = {}) {
  const child = spawn(process.execPath, [fixture, mode], { stdio: ['pipe', 'pipe', 'pipe'], shell: false });
  const driver = new PiDriver(child, options);
  t.after(async () => {
    driver.closeInput();
    try { await deadline(driver.closed); }
    catch (error) { child.kill(); await deadline(driver.closed); throw error; }
    assert.equal(child.exitCode, 0, 'fake process must be reaped with a normal exit');
  });
  await driver.ready;
  return driver;
}

test('correlates get_state, keeps stdin open and separates stderr', async t => {
  const d = await driverFor(t);
  let diagnostic = '';
  d.on('diagnostic', bytes => { diagnostic += bytes.toString(); });
  const response = await d.getState();
  assert.equal(response.command, 'get_state');
  assert.equal(typeof response.id, 'string');
  assert.equal(response.data.isStreaming, false);
  assert.equal(d.child.stdin.writableEnded, false);
  // stderr and stdout are independent streams, not ordered relative to one another.
  for (let i = 0; i < 20 && !diagnostic; i++) await delay(10);
  assert.match(diagnostic, /diagnostic-not-json/);
  d.closeInput();
  assert.equal((await d.closed).failure, null);
});

test('fragmented UTF-8, CRLF and Unicode separators survive JSONL framing', async t => {
  const d = await driverFor(t, 'fragmented');
  assert.equal((await d.getState()).data.text, 'aç😀\u2028\u2029z');
});

test('out-of-order responses and interleaved event with ID never miscorrelate', async t => {
  const d = await driverFor(t, 'reorder');
  const events = [];
  d.on('event', event => events.push(event.type));
  const [a, b] = await Promise.all([d.command('get_state', { marker: 'A' }), d.command('get_state', { marker: 'B' })]);
  assert.equal(a.data.marker, 'A');
  assert.equal(b.data.marker, 'B');
  assert.notEqual(a.id, b.id);
  assert.deepEqual(events, ['agent_start']);
});

test('accepts response requestId alias', async t => {
  const d = await driverFor(t, 'request-id');
  assert.equal((await d.getState()).success, true);
});

test('command rejection exposes response but is not a transport success/failure', async t => {
  const d = await driverFor(t, 'error');
  await assert.rejects(d.getState(), error => error.code === 'RPC_ERROR' && error.response.success === false);
  assert.equal(d.failure, null);
});

test('prompt rejection clears its settlement waiter', async t => {
  const d = await driverFor(t, 'error');
  await assert.rejects(d.promptAndWait('harmless'), code('RPC_ERROR'));
  assert.equal(d.run, null);
});

test('prompt acknowledgement and agent_end are not completion', async t => {
  const d = await driverFor(t);
  const events = [];
  let completed = false;
  d.on('event', event => {
    events.push(event.type);
    if (event.type === 'agent_end') assert.equal(completed, false);
  });
  const result = await d.promptAndWait('harmless').then(result => { completed = true; return result; });
  assert.equal(result.settled.type, 'agent_settled');
  assert.equal(result.assistantError, false);
  assert.equal(d.child.stdin.writableEnded, false);
  assert.deepEqual(events, ['agent_start', 'message_end', 'agent_end', 'agent_settled']);
  // A second run in the same child cannot reuse the first settled record.
  completed = false;
  assert.equal((await d.promptAndWait('again')).settled.type, 'agent_settled');
});

test('settlement before acknowledgement, multiple records in one block', async t => {
  const d = await driverFor(t, 'settled-first');
  const result = await d.promptAndWait('harmless');
  assert.equal(result.response.success, true);
  assert.equal(result.settled.aborted, false);
});

for (const mode of ['model-error', 'aborted']) {
  test(`${mode} remains an observed failure even after agent_settled`, async t => {
    const d = await driverFor(t, mode);
    assert.equal((await d.promptAndWait('harmless')).assistantError, true);
  });
}

test('handled prompt is not treated as a completed run', async t => {
  const d = await driverFor(t, 'handled');
  await assert.rejects(d.promptAndWait('harmless'), code('PROMPT_NOT_STARTED'));
  assert.equal(d.run, null);
});

test('refuses concurrent promptAndWait observations', async t => {
  const d = await driverFor(t);
  const running = d.promptAndWait('harmless');
  await assert.rejects(d.promptAndWait('another'), code('RUN_ACTIVE'));
  await assert.rejects(d.prompt('raw injection'), code('RUN_ACTIVE'));
  await assert.rejects(d.command('prompt', { message: 'injection' }), code('RUN_ACTIVE'));
  await running;
});

for (const [mode, expected] of [
  ['invalid', 'INVALID_JSON'], ['invalid-utf8', 'INVALID_JSON'],
  ['invalid-shape', 'INVALID_RECORD'], ['mismatch', 'COMMAND_MISMATCH'],
  ['no-id', 'UNCORRELATED_RESPONSE'], ['eof', 'EARLY_EOF'],
  ['conflicting-id', 'INVALID_RESPONSE'], ['invalid-success', 'INVALID_RESPONSE'],
  ['truncated', 'TRUNCATED_RECORD'], ['oversize', 'RECORD_LIMIT'],
  ['oversize-line', 'RECORD_LIMIT'],
]) {
  test(`${mode}: fails closed and rejects pending commands`, async t => {
    const d = await driverFor(t, mode, { maxRecordBytes: 4096 });
    await assert.rejects(d.getState(), code(expected));
    assert.equal(d.failure.code, expected);
    await assert.rejects(d.getState(), code(expected));
    assert.equal((await d.closed).failure.code, expected);
  });
}

test('unknown response ID is observable, never accepted as the pending response', async t => {
  const d = await driverFor(t, 'unmatched');
  let unknown = false;
  d.on('unmatchedResponse', () => { unknown = true; });
  await assert.rejects(d.getState({ timeoutMs: 300 }), code('COMMAND_TIMEOUT'));
  assert.equal(unknown, true);
});

test('unexpected idle EOF is failure even with no pending commands', async t => {
  const d = await driverFor(t, 'idle-eof');
  assert.equal((await d.closed).failure.code, 'EARLY_EOF');
});

test('abnormal exit after requested shutdown is not success', async () => {
  const d = new PiDriver(spawn(process.execPath, [fixture, 'bad-exit'], { stdio: ['pipe', 'pipe', 'pipe'] }));
  await d.ready;
  await d.getState();
  d.closeInput();
  const result = await deadline(d.closed);
  assert.equal(result.exitCode, 7);
  assert.equal(result.failure.code, 'PROCESS_EXIT');
});

test('command timeout fails closed; no command or child left pending', async t => {
  const d = await driverFor(t, 'silent', { commandTimeoutMs: 200 });
  await assert.rejects(d.getState(), code('COMMAND_TIMEOUT'));
  assert.equal(d.pending.size, 0);
  assert.equal((await d.closed).failure.code, 'COMMAND_TIMEOUT');
});

test('no settled record times out despite acknowledgement/agent_end', async t => {
  const d = await driverFor(t, 'no-settled');
  await assert.rejects(d.promptAndWait('harmless', { timeoutMs: 300 }), code('SETTLED_TIMEOUT'));
});

test('exitCode=0 without agent_settled never resolves the run', async t => {
  const d = await driverFor(t, 'exit-after-end');
  await assert.rejects(d.promptAndWait('harmless'), code('EARLY_EOF'));
  assert.equal((await d.closed).exitCode, 0);
});

test('pending command and outgoing byte limits, reserved fields, timeout validation', async t => {
  const d = await driverFor(t, 'silent', { maxPending: 1, maxRecordBytes: 1024, maxQueuedBytes: 1024 });
  assert.throws(() => d.getState({ timeoutMs: 0 }), TypeError);
  assert.throws(() => d.command('get_state', { id: 'override' }), TypeError);
  await assert.rejects(d.prompt('x'.repeat(2048)), code('QUEUE_LIMIT'));
  const pending = d.getState({ timeoutMs: 200 });
  await assert.rejects(d.getState(), code('QUEUE_LIMIT'));
  await assert.rejects(pending, code('COMMAND_TIMEOUT'));
});

test('stdin backpressure: large command is drained and answered', async t => {
  const d = await driverFor(t);
  const responses = await Promise.all(Array.from({ length: 4 }, () =>
    d.command('get_state', { padding: 'x'.repeat(512 * 1024) })));
  assert.ok(responses.every(response => response.success));
  assert.equal(d.failure, null);
});

test('spawn failure is reported by ready and closed, not unhandled', async () => {
  const d = new PiDriver(spawn(join(tmpdir(), 'devout-nonexistent-executable-74a6'), [], { shell: false }));
  await assert.rejects(d.ready, code('SPAWN_ERROR'));
  assert.equal((await deadline(d.closed)).failure.code, 'SPAWN_ERROR');
});

test('Windows launcher uses fixed command, shell:false, and rejects shell syntax', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'devout launcher espaço '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const piCmd = join(root, 'pi.cmd');
  // A launcher fixture forwarding fixed arguments to Node, no dynamic shell input.
  await writeFile(piCmd, `@echo off\r\n"${process.execPath}" "${fixture}" normal %*\r\n`);
  const spec = windowsLaunchSpec({ piCmd, cwd: root, profile: 'isolated' });
  assert.equal(spec.options.shell, false);
  assert.equal(spec.options.windowsVerbatimArguments, true);
  assert.equal(spec.options.env.DEVOUT_PI_CMD, piCmd);
  assert.equal(spec.args.at(-1).includes(piCmd), false);
  for (const bad of ['a&b', 'a%b', 'a!b', 'a"b', 'a\nb', 'a(b)']) {
    assert.throws(() => windowsLaunchSpec({ piCmd: `C:\\${bad}\\pi.cmd`, cwd: root }), TypeError);
  }
  assert.throws(() => startPi({ piCmd, cwd: root, maxPending: 0 }), TypeError);
  const d = startPi({ piCmd, cwd: root, profile: 'isolated' });
  t.after(async () => {
    const result = await d.cancel();
    assert.equal(result.canRelease, true, 'Windows launcher tree must be verified gone');
  });
  await d.ready;
  // Metacharacters in a prompt are data only, never arguments for cmd.exe.
  const result = await d.promptAndWait('harmless & | %PATH% ! " \n ç 😀');
  assert.equal(result.assistantError, false);
  d.closeInput();
  const closed = await deadline(d.closed);
  assert.equal(closed.exitCode, 0);
  assert.equal(closed.failure, null);
});
