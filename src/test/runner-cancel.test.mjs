import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRole } from '../role-runner.mjs';
import { controlTransaction, initializeControl, requestCancellation } from '../run-control.mjs';
import { acquirePiLock, inspectPiLock } from '../pi-lock.mjs';
import { activeCancellationEvidence } from './helpers/active-cancellation.mjs';

const windows = { skip: process.platform !== 'win32', timeout: 90_000 };
const runner = fileURLToPath(new URL('../role-runner.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/runner-cancel-rpc.mjs', import.meta.url));
const code = expected => error => error.code === expected;
const read = path => JSON.parse(readFileSync(path, 'utf8'));
function setup(t, mode = 'stream') {
  const root = mkdtempSync(join(tmpdir(), 'devout-cancel-T05-'));
  const workspace = join(root, 'workspace'), artifactsRoot = join(root, 'operacional');
  mkdirSync(workspace);
  writeFileSync(join(workspace, '.devout-disposable.json'), '{"schemaVersion":1,"disposable":true}');
  const piCmd = join(root, 'pi.cmd');
  writeFileSync(piCmd, `@echo off\r\n"${process.execPath}" "${fixture}" ${mode}\r\n`);
  const context = { root, preserve: false, config: { schemaVersion: 1, taskId: 'M01-T05-TEST', role: 'test',
    workspace, artifactsRoot, piCmd, modelProfile: 'configured-isolated', prompt: 'Teste fictício.', expectedText: 'PONG',
    driver: { commandTimeoutMs: 5000, settlementTimeoutMs: 15000, normalWaitMs: 1500,
      forceWaitMs: 5000, abortTimeoutMs: 500, pollMs: 30 } } };
  t.after(() => { if (!context.preserve) rmSync(root, { recursive: true, force: true }); });
  return context;
}
function mailbox(t) {
  const { config } = setup(t), runId = `run-${randomUUID()}`;
  const directory = join(config.artifactsRoot, 'runs', runId);
  mkdirSync(directory, { recursive: true }); initializeControl(directory, runId);
  return { directory, target: { artifactsRoot: config.artifactsRoot, runId } };
}
async function cancelCli(target) {
  const child = spawn(process.execPath, [runner, 'cancel', '--artifacts-root', target.artifactsRoot, '--run-id', target.runId],
    { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
  const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  return { exitCode, stdout, stderr, receipt: stdout ? JSON.parse(stdout) : null };
}
function successfulDriver() {
  const d = new EventEmitter(), calls = [];
  d.getState = async () => { calls.push('get_state'); return { id: 'state-id', command: 'get_state', success: true,
    data: { model: { id: 'fictional' }, isStreaming: false } }; };
  d.promptAndWait = async () => {
    calls.push('prompt');
    d.emit('event', { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'PONG' }] } });
    d.emit('event', { type: 'agent_settled', aborted: false });
    return { response: { success: true, data: { disposition: 'started' } }, settled: { type: 'agent_settled', aborted: false }, assistantError: false };
  };
  d.cancel = async () => { calls.push('cancel'); };
  const termination = { state: 'terminated', canRelease: true, processesGone: true, workCompleted: true, forced: false, exitCode: 0 };
  const acquire = async () => { calls.push('acquire'); return {
    launch: async () => { calls.push('launch'); return d; },
    finish: async ({ cancel }) => { calls.push(cancel ? 'finish_cancel' : 'finish'); return { released: true, termination }; },
  }; };
  return { d, calls, acquire, termination };
}
function interrupted(outcome) {
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.result.technicalOutcome, 'interrupted');
  assert.equal(outcome.result.taskApproved, false);
  assert.equal(outcome.result.cancellation.requested, true);
  assert.ok(outcome.result.errorCodes.includes('CANCELLED'));
  assert.equal(read(join(outcome.runDir, 'result.json')).technicalOutcome, 'interrupted');
}

function activeEvidence() {
  const runId = `run-${randomUUID()}`;
  const events = [
    { seq: 1, at: '2026-11-18T12:00:00.000Z', type: 'response_started' },
    { seq: 2, at: '2026-11-18T12:00:00.100Z', type: 'cancel_observed' },
    { seq: 3, at: '2026-11-18T12:00:00.200Z', type: 'pi_event', event: 'agent_settled' },
    { seq: 4, at: '2026-11-18T12:00:00.201Z', type: 'prompt_observed', accepted: true, settled: true, aborted: true },
  ].map(event => ({ runId, ...event }));
  return { events, control: { runId, requestedAt: '2026-11-18T12:00:00.050Z' }, result: {
    runId, technicalOutcome: 'interrupted', cancellation: { requested: true },
    observed: { promptAccepted: true, responseStarted: true, settled: true, aborted: true, assistantError: false },
    termination: { abortAccepted: true, forced: false, workCompleted: false },
  } };
}

test('active smoke evidence requires request AND consumption before interrupted settlement', () => {
  assert.equal(activeCancellationEvidence(activeEvidence()).interruptionObserved, true);
  const assistantAbort = activeEvidence();
  assistantAbort.result.observed.aborted = false; assistantAbort.result.observed.assistantError = true;
  assistantAbort.events[3].aborted = false; assistantAbort.events[3].assistantError = true;
  assert.equal(activeCancellationEvidence(assistantAbort).interruptionObserved, true);
  const rejectedPrompt = activeEvidence(); rejectedPrompt.events.pop();
  assert.equal(activeCancellationEvidence(rejectedPrompt).interruptionObserved, true);
});

for (const scenario of ['late-request', 'late-consumption', 'same-millisecond', 'already-stopping', 'abort-receipt-only', 'missing-settlement']) {
  test(`active smoke rejects false/inconclusive evidence: ${scenario}`, () => {
    const evidence = activeEvidence();
    let expected = 'ACTIVE_CANCEL_ORDER_INVALID';
    if (scenario === 'late-request') evidence.control.requestedAt = '2026-11-18T12:00:00.300Z';
    if (scenario === 'late-consumption') evidence.events[1].seq = 5;
    if (scenario === 'same-millisecond') evidence.events[2].at = evidence.events[1].at;
    if (scenario === 'already-stopping') {
      evidence.events.unshift({ runId: evidence.result.runId, seq: 1.5, type: 'state', state: 'stopping' });
      expected = 'ACTIVE_CANCEL_ALREADY_STOPPING';
    }
    if (scenario === 'abort-receipt-only') {
      evidence.result.observed.aborted = false; evidence.events[3].aborted = false;
      expected = 'ACTIVE_CANCEL_INTERRUPTION_UNPROVEN';
    }
    if (scenario === 'missing-settlement') {
      evidence.events.splice(2, 1); expected = 'ACTIVE_CANCEL_EVIDENCE_MISSING';
    }
    assert.throws(() => activeCancellationEvidence(evidence), code(expected));
  });
}

test('quick natural completion followed by delayed independent request cannot pass the active smoke', windows, async t => {
  const { config } = setup(t), mock = successfulDriver(); let runId, receipt;
  const prompt = mock.d.promptAndWait;
  mock.d.promptAndWait = async () => {
    mock.d.emit('event', { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'PONG' } });
    return prompt(); // Natural settlement synchronously, no timer-dependent race.
  };
  const outcome = await runRole(config, { acquire: async () => ({ launch: async () => mock.d, finish: async () => {
    // Same accepted late request as I01, after settlement but before cutoff.
    receipt = await cancelCli({ artifactsRoot: config.artifactsRoot, runId });
    return { released: true, termination: { ...mock.termination, abortAccepted: true } };
  } }), notify: event => { runId = event.runId; } });
  assert.equal(receipt.receipt.status, 'requested'); interrupted(outcome);
  assert.equal(outcome.result.termination.abortAccepted, true); // Old smoke would pass.
  const events = readFileSync(join(outcome.runDir, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.throws(() => activeCancellationEvidence({ events,
    control: read(join(outcome.runDir, 'control.json')), result: outcome.result }), code('ACTIVE_CANCEL_ORDER_INVALID'));
});

test('independent concurrent controllers publish one durable request, without overwriting identities', async t => {
  const { directory, target } = mailbox(t), before = read(join(directory, 'control.json'));
  const receipts = await Promise.all(Array.from({ length: 8 }, () => cancelCli(target)));
  assert.ok(receipts.every(item => item.exitCode === 0 && item.stderr === ''));
  assert.equal(receipts.filter(item => item.receipt.status === 'requested').length, 1);
  assert.equal(receipts.filter(item => item.receipt.status === 'already_requested').length, 7);
  const control = read(join(directory, 'control.json'));
  assert.equal(control.runId, before.runId); assert.equal(control.runnerPid, before.runnerPid);
  assert.ok(control.requestedAt); assert.equal(control.finalState, null);
  assert.equal((await requestCancellation(target)).status, 'already_requested');
  assert.deepEqual(read(join(directory, 'control.json')), control);
});

test('unknown/path-traversal/foreign identities and malformed mailboxes cannot select another run', async t => {
  const { directory, target } = mailbox(t), original = readFileSync(join(directory, 'control.json'));
  for (const runId of ['../lease', 'run-other', `run-${randomUUID()}`, target.runId.toUpperCase()]) {
    await assert.rejects(requestCancellation({ ...target, runId }), code('INVALID_REQUEST'));
  }
  writeFileSync(join(directory, 'control.json'), JSON.stringify({ ...JSON.parse(original), runId: `run-${randomUUID()}` }));
  await assert.rejects(requestCancellation(target), code('CONTROL_INVALID'));
  writeFileSync(join(directory, 'control.json'), '{');
  await assert.rejects(requestCancellation(target), code('CONTROL_INVALID'));
  writeFileSync(join(directory, 'control.json'), original);
  const siblingId = `run-${randomUUID()}`, link = join(target.artifactsRoot, 'runs', siblingId);
  symlinkSync(directory, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(requestCancellation({ ...target, runId: siblingId }), code('INVALID_REQUEST'));
  assert.deepEqual(readFileSync(join(directory, 'control.json')), original);
});

test('abandoned guard fails closed within a bounded wait and is never removed by the contender', { timeout: 10000 }, async t => {
  const { directory, target } = mailbox(t), before = readFileSync(join(directory, 'control.json'));
  mkdirSync(join(directory, 'control.guard'));
  await assert.rejects(requestCancellation(target), code('CONTROL_BUSY'));
  assert.deepEqual(readFileSync(join(directory, 'control.json')), before);
  assert.throws(() => mkdirSync(join(directory, 'control.guard')), code('EEXIST'));
});

for (const order of ['request-first', 'close-first']) {
  test(`terminal arbitration: ${order}, no accepted request is silently lost`, async t => {
    const { directory, target } = mailbox(t);
    let captured;
    const close = () => controlTransaction(directory, target.runId, (record, save) => {
      captured = record.requestedAt !== null;
      record.status = 'closed'; record.finalState = 'terminated'; save();
    });
    const operations = order === 'request-first' ? [requestCancellation(target), close()] : [close(), requestCancellation(target)];
    const results = await Promise.all(operations);
    const receipt = results.find(item => item?.status);
    assert.equal(receipt.status, order === 'request-first' ? 'requested' : 'too_late');
    assert.equal(captured, order === 'request-first');
    const final = readFileSync(join(directory, 'control.json'));
    assert.equal((await cancelCli(target)).receipt.status, 'too_late');
    assert.deepEqual(readFileSync(join(directory, 'control.json')), final);
  });
}

for (const point of ['starting', 'lock_acquired', 'running', 'state_observed']) {
  test(`request at ${point} prevents subsequent phases/prompts`, windows, async t => {
    const { config } = setup(t), mock = successfulDriver(); let receipt;
    const outcome = await runRole(config, { acquire: mock.acquire, notify: event => {
      if (event.type === point || event.type === 'state' && event.state === point) {
        receipt = requestCancellation({ artifactsRoot: config.artifactsRoot, runId: event.runId });
      }
    } });
    assert.equal((await receipt).status, 'requested'); interrupted(outcome);
    assert.ok(!mock.calls.includes('prompt'));
    if (point === 'starting') assert.ok(!mock.calls.includes('acquire'));
    if (point === 'lock_acquired') assert.ok(!mock.calls.includes('launch'));
    if (point === 'running') assert.ok(!mock.calls.includes('get_state'));
    assert.equal(outcome.result.state, 'terminated');
    assert.equal(outcome.result.lock.released, point !== 'starting');
  });
}

test('invalid live control stops phases, cancels the owned Driver and never publishes success', windows, async t => {
  const { config } = setup(t), mock = successfulDriver();
  const outcome = await runRole(config, { acquire: mock.acquire, notify: event => {
    if (event.type === 'state_observed') {
      writeFileSync(join(config.artifactsRoot, 'runs', event.runId, 'control.json'), '{');
    }
  } });
  assert.equal(outcome.exitCode, 1); assert.equal(outcome.result.technicalOutcome, 'failed');
  assert.ok(outcome.result.errorCodes.includes('CONTROL_INVALID'));
  assert.ok(!mock.calls.includes('prompt')); assert.ok(mock.calls.includes('finish_cancel'));
  assert.equal(outcome.result.taskApproved, false);
  await assert.rejects(requestCancellation({ artifactsRoot: config.artifactsRoot, runId: outcome.result.runId }), code('CONTROL_INVALID'));
});

test('request during asynchronous Pi bootstrap is consumed before get_state or prompt', windows, async t => {
  const { config } = setup(t), mock = successfulDriver(); let runId;
  const acquire = async () => ({
    launch: async () => {
      assert.equal((await cancelCli({ artifactsRoot: config.artifactsRoot, runId })).receipt.status, 'requested');
      return mock.d;
    },
    finish: async () => ({ released: true, termination: mock.termination }),
  });
  const outcome = await runRole(config, { acquire, notify: event => { runId = event.runId; } });
  interrupted(outcome); assert.ok(!mock.calls.includes('get_state')); assert.ok(!mock.calls.includes('prompt'));
  assert.ok(mock.calls.includes('cancel'));
});

test('independent controller immediately before shutdown completion wins over a successful observation', windows, async t => {
  const { config } = setup(t), mock = successfulDriver(); let runId;
  const acquire = async () => ({ launch: async () => mock.d, finish: async () => {
    const receipt = await cancelCli({ artifactsRoot: config.artifactsRoot, runId });
    assert.equal(receipt.receipt.status, 'requested');
    return { released: true, termination: mock.termination };
  } });
  const outcome = await runRole(config, { acquire, notify: event => { runId = event.runId; } });
  interrupted(outcome);
  assert.equal(outcome.result.observed.markerMatched, true);
  assert.equal(outcome.result.termination.workCompleted, true); // cancellation still dominates
  assert.equal(outcome.result.state, 'terminated');
});

test('request after the cutoff is explicitly too late; it cannot change a result or touch a new run', windows, async t => {
  const { config } = setup(t), mock = successfulDriver(); let receipt;
  const outcome = await runRole(config, { acquire: mock.acquire, notify: event => {
    if (event.type === 'control_closed') receipt = cancelCli({ artifactsRoot: config.artifactsRoot, runId: event.runId });
  } });
  assert.equal((await receipt).receipt.status, 'too_late');
  assert.equal(outcome.result.technicalOutcome, 'succeeded');
  const before = readFileSync(join(outcome.runDir, 'result.json'));
  const next = await runRole(config, { acquire: successfulDriver().acquire });
  await cancelCli({ artifactsRoot: config.artifactsRoot, runId: outcome.result.runId });
  assert.equal(read(join(next.runDir, 'control.json')).requestedAt, null);
  assert.deepEqual(readFileSync(join(outcome.runDir, 'result.json')), before);
});

test('uncertain cancelled Driver keeps the real lease policy blocking further launches', windows, async t => {
  const { root, config } = setup(t), mock = successfulDriver();
  const lockRoot = join(root, 'policy-lock'); // simulated guard, no OS processes
  let held = false, runId;
  const owner = { pid: process.pid, created: '1', image: process.execPath };
  const identity = { pid: 12345, created: '2', image: process.execPath };
  const dependencies = { openGuard: async () => {
    if (held) throw Object.assign(new Error(), { code: 'LOCK_BUSY' });
    held = true;
    return { owner, boot: { machine: 'test', id: '1', source: 'windows-kuser-shared-data-bootid-v1',
      architecture: 'AMD64', build: 19045 }, check: async () => {}, probe: async () => 'gone',
      close: async () => { held = false; } };
  } };
  mock.d.ready = Promise.resolve(); mock.d.processTree = { identity };
  mock.d.shutdown = async () => ({ state: 'uncertain', canRelease: false, processesGone: false, identity });
  const acquire = async () => {
    const lease = await acquirePiLock({ root: lockRoot, runId }, dependencies);
    return { launch: options => lease.launch(options, () => mock.d), finish: options => lease.finish(options) };
  };
  const outcome = await runRole(config, { acquire, notify: event => {
    runId = event.runId;
    if (event.type === 'state_observed') void requestCancellation({ artifactsRoot: config.artifactsRoot, runId });
  } });
  interrupted(outcome);
  assert.equal(outcome.result.state, 'uncertain'); assert.equal(outcome.result.lock.released, false);
  assert.equal((await cancelCli({ artifactsRoot: config.artifactsRoot, runId })).receipt.status, 'blocked');
  assert.equal((await inspectPiLock({ root: lockRoot }, dependencies)).canAcquire, false);
  await assert.rejects(acquirePiLock({ root: lockRoot, runId: 'another' }, dependencies), code('LOCK_RECONCILIATION_REQUIRED'));
});

for (const mode of ['stream', 'force']) {
  test(`independent cancel CLI -> active Runner -> identified fake Pi: ${mode}`, windows, async t => {
    const context = setup(t, mode), { root, config } = context;
    assert.equal((await inspectPiLock()).canAcquire, true);
    const path = join(root, 'request.json'); writeFileSync(path, JSON.stringify(config));
    const witness = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { shell: false, windowsHide: true, stdio: 'ignore' });
    const witnessClosed = new Promise(resolve => witness.once('close', resolve));
    t.after(async () => { witness.kill(); await witnessClosed; });
    const oldId = `run-${randomUUID()}`, oldDirectory = join(config.artifactsRoot, 'runs', oldId);
    mkdirSync(oldDirectory, { recursive: true }); initializeControl(oldDirectory, oldId);
    // A historical/reused PID is intentionally irrelevant to cancellation.
    writeFileSync(join(oldDirectory, 'control.json'), JSON.stringify({ ...read(join(oldDirectory, 'control.json')),
      runnerPid: witness.pid, status: 'closed', finalState: 'terminated' }));
    const child = spawn(process.execPath, [runner, 'run', '--config', path], { shell: false, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '', stderr = '', request, runId, oldReceipt;
    child.stderr.on('data', bytes => { stderr += bytes; });
    child.stdout.on('data', bytes => {
      buffer += bytes;
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        const event = JSON.parse(line); runId = event.runId;
        if (event.type === 'response_started' && !request) {
          request = (async () => {
            oldReceipt = await cancelCli({ artifactsRoot: config.artifactsRoot, runId: oldId });
            return Promise.all([cancelCli({ artifactsRoot: config.artifactsRoot, runId }), cancelCli({ artifactsRoot: config.artifactsRoot, runId })]);
          })();
        }
      }
    });
    const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    const runDir = join(config.artifactsRoot, 'runs', runId), result = read(join(runDir, 'result.json'));
    if (!result.lock.released) context.preserve = true;
    assert.ok(request); assert.equal(exitCode, 1, stderr); assert.equal(stderr, '');
    interrupted({ exitCode, runDir, result });
    const receipts = await request;
    assert.equal(oldReceipt.receipt.status, 'too_late');
    assert.equal(process.kill(witness.pid, 0), true, 'Unrelated live process must not be killed by an old/reused PID');
    assert.notEqual(result.termination.identity.pid, witness.pid);
    assert.ok(receipts.every(item => item.exitCode === 0));
    assert.ok(receipts.some(item => item.receipt.status === 'requested'));
    assert.equal(result.state, 'terminated'); assert.equal(result.lock.released, true);
    assert.equal(result.termination.processesGone, true);
    assert.ok(result.termination.identity.pid > 0); assert.ok(result.termination.identity.created);
    assert.equal(result.termination.forced, mode === 'force');
    assert.equal(result.termination.abortAccepted, mode !== 'force');
    assert.ok(result.observed.promptAccepted && result.observed.responseStarted); assert.ok(result.observed.eventCount > 1);
    const late = await cancelCli({ artifactsRoot: config.artifactsRoot, runId });
    assert.equal(late.receipt.status, 'too_late');
    assert.equal((await inspectPiLock()).canAcquire, true);
    const next = await acquirePiLock({ runId: 'T05-prove-reacquisition' });
    assert.equal((await next.finish()).released, true);
  });
}
