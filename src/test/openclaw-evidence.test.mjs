import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRunEvidence, checkScenarioOrder, checkOpenClawTrace } from './helpers/openclaw-evidence.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
const at = n => new Date(Date.UTC(2026, 10, 18) + n * 100).toISOString();
function fixture(kind = 'normal') {
  const runId = 'run-00000000-0000-4000-8000-000000000001';
  const duplicate = kind === 'duplicate', cancelled = kind === 'cancel';
  const rows = duplicate ? [{ type: 'state', state: 'starting' }, { type: 'failure', code: 'LOCK_BUSY' }] : [
    { type: 'state', state: 'starting' }, { type: 'lock_acquired' }, { type: 'state', state: 'running' },
    { type: 'state_observed' }, { type: 'response_started' },
    ...(cancelled ? [{ type: 'cancel_observed' }] : []),
    { type: 'pi_event', event: 'agent_settled' },
    { type: 'prompt_observed', accepted: true, settled: true, aborted: cancelled, assistantError: cancelled },
  ];
  rows.push({ type: 'state', state: 'stopping' }, { type: 'control_closed' }, { type: 'state', state: 'terminated' });
  const events = rows.map((e, i) => ({ ...e, runId, seq: i + 1, at: at(i + 1) }));
  const result = { schemaVersion: 1, runId, taskId: 'TEST-T06', role: 'test', runnerPid: 123,
    state: 'terminated', taskApproved: false, startedAt: at(0), finishedAt: at(20),
    technicalOutcome: kind === 'normal' ? 'succeeded' : cancelled ? 'interrupted' : 'failed',
    lock: { acquired: !duplicate, released: !duplicate }, errorCodes: duplicate ? ['LOCK_BUSY'] : cancelled ? ['CANCELLED'] : kind === 'mismatch' ? ['RESPONSE_MISMATCH'] : [],
    observed: { stateCorrelated: !duplicate, modelAvailable: !duplicate, promptAccepted: !duplicate, settled: !duplicate,
      aborted: cancelled, assistantError: cancelled, markerMatched: kind === 'normal', responseStarted: !duplicate },
    cancellation: { requested: cancelled },
    termination: duplicate ? null : { state: 'terminated', processesGone: true, canRelease: true, workCompleted: kind === 'normal',
      exitCode: 0, forced: false, abortAccepted: cancelled, identity: { pid: 124, created: 'creation-id' }, observed: [{ pid: 124, created: 'creation-id' }] } };
  return { result, events, state: { schemaVersion: 1, role: 'test', runId, taskId: 'TEST-T06', runnerPid: 123, state: 'terminated' },
    control: { schemaVersion: 1, runId, runnerPid: 123, status: 'closed', finalState: 'terminated', requestedAt: cancelled ? at(5.5) : null } };
}
for (const kind of ['normal', 'cancel', 'duplicate', 'mismatch']) test(`T06 evidence accepts ${kind}, never task approval`, () => {
  const output = checkRunEvidence(fixture(kind), kind);
  assert.equal(output.taskApproved, false);
});
const mutations = [
  ['missing result', x => { x.result = null; }],
  ['exit zero without settlement', x => { x.result.observed.settled = false; }],
  ['task approval', x => { x.result.taskApproved = true; }],
  ['uncertain release', x => { x.result.lock.released = false; }],
  ['survivors', x => { x.result.termination.processesGone = false; }],
  ['missing journal settlement', x => { x.events[5].event = 'agent_start'; }],
  ['wrong runId in event', x => { x.events[2].runId = 'other'; }],
  ['wrong runner in state', x => { x.state.runnerPid++; }],
  ['broken sequence', x => { x.events[2].seq++; }],
  ['wrong control identity', x => { x.control.runId = 'other'; }],
  ['open control', x => { x.control.status = 'open'; }],
  ['forced success', x => { x.result.termination.forced = true; }],
  ['missing cancellation status', x => { delete x.result.cancellation; }],
  ['wrong state schema', x => { x.state.schemaVersion = 2; }],
  ['wrong control schema', x => { x.control.schemaVersion = 2; }],
  ['truthy termination flag', x => { x.result.termination.processesGone = 'true'; }],
  ['journal outside execution interval', x => { x.events[3].at = at(30); }],
  ['unbound native identity', x => { x.result.termination.identity.pid = 125; }],
];
for (const [name, mutate] of mutations) test(`T06 evidence rejects ${name}`, () => {
  const x = fixture(); mutate(x); assert.throws(() => checkRunEvidence(x, 'normal'));
});
test('T06 evidence refuses accepted cancellation after settlement', () => {
  const x = fixture('cancel'); x.control.requestedAt = at(15);
  assert.throws(() => checkRunEvidence(x, 'cancel'), { code: 'ACTIVE_CANCEL_ORDER_INVALID' });
});
test('T06 duplicate must not have acquired a lock or launched', () => {
  const x = fixture('duplicate'); x.result.lock.acquired = true;
  assert.throws(() => checkRunEvidence(x, 'duplicate'));
});
test('T06 mismatch is failure even with persisted exit zero', () => {
  const x = fixture('mismatch'); x.result.technicalOutcome = 'succeeded';
  assert.throws(() => checkRunEvidence(x, 'mismatch'));
});
test('T06 scenario requires duplication after Pi ready and next run after previous ended', () => {
  const cases = { cancel: { runId: 'a', finishedAt: at(20), piReadyAt: at(3), activeCancellation: { responseStartedAt: at(5), requestedAt: at(10) } },
    duplicate: { runId: 'b', startedAt: at(6), finishedAt: at(8) },
    normal: { runId: 'c', startedAt: at(21), finishedAt: at(30) }, mismatch: { runId: 'd', startedAt: at(31) } };
  assert.equal(checkScenarioOrder(cases), true);
  cases.normal.startedAt = at(19); assert.throws(() => checkScenarioOrder(cases));
  cases.normal.startedAt = at(21); cases.duplicate.startedAt = at(4);
  assert.equal(checkScenarioOrder(cases), true, 'Pi ready, before first response, is a valid duplicate window');
  cases.duplicate.startedAt = at(2); assert.throws(() => checkScenarioOrder(cases));
  cases.duplicate.startedAt = at(6); cases.duplicate.finishedAt = at(11); assert.throws(() => checkScenarioOrder(cases));
});

function traceFixture() {
  const root = join(tmpdir(), 'trace-fixture'), runner = join(root, 'role-runner.mjs'), cases = {}, messages = [];
  function nested(details) { messages.push({ customType: 'openclaw.nested-tool.v1', details }); }
  for (const [i, kind] of ['cancel', 'duplicate', 'normal', 'mismatch'].entries()) {
    const r = { runId: `run-${i}`, state: 'terminated', taskApproved: false,
      technicalOutcome: kind === 'normal' ? 'succeeded' : kind === 'cancel' ? 'interrupted' : 'failed' };
    cases[kind] = r;
    nested({ toolName: 'exec', startedAt: 1000 + i * 10000,
      input: { command: `node "${runner}" run --config "${join(root, `${kind}.json`)}"`,
        yieldMs: 1000, awaitResults: false, pty: false, timeoutSeconds: 240 },
      result: { details: { status: 'running', sessionId: `exec-${i}`, secretCanary: 'SECRET-CANARY' } } });
    nested({ toolName: 'process', input: { action: 'poll', sessionId: `exec-${i}` }, timestamp: 2000 + i * 10000,
      result: { details: { status: 'completed', exitCode: kind === 'normal' ? 0 : 1,
        aggregated: JSON.stringify({ type: 'result', ...r }) + '\n(Process exited)' } } });
    nested({ toolName: 'process', input: { action: 'log', sessionId: `exec-${i}` }, result: { details: { status: 'completed' } } });
  }
  nested({ toolName: 'exec', input: { command: `node "${runner}" cancel --artifacts-root "${join(root, 'operacional')}" --run-id "${cases.cancel.runId}"` },
    result: { details: { exitCode: 0, aggregated: JSON.stringify({ type: 'cancel_request', runId: cases.cancel.runId, status: 'requested' }) } } });
  messages.push({ role: 'user', content: 'SECRET-CANARY' });
  messages.push({ role: 'toolResult', isError: true, content: 'SECRET-CANARY' });
  return { transcript: { messages }, options: { root, runner, cases } };
}
test('T06 Gateway trace binds actual async handles, terminal collection and persisted run IDs; whitelist only', () => {
  const { transcript, options } = traceFixture();
  const result = checkOpenClawTrace(transcript, options);
  assert.equal(result.pass, true); assert.equal(result.taskApproved, false); assert.equal(result.controllerToolErrors, 1);
  assert.equal(result.cases.normal.execSessionId, 'exec-2');
  assert.equal(JSON.stringify(result).includes('SECRET-CANARY'), false);
});
const traceMutations = [
  ['missing trace', x => { x.transcript.messages = []; }],
  ['repeated dispatch', x => { x.transcript.messages.push(x.transcript.messages[0]); }],
  ['required cell exec', x => { x.transcript.messages[0].details.input.awaitResults = true; }],
  ['synchronous result', x => { x.transcript.messages[0].details.result.details.status = 'completed'; }],
  ['no process log', x => { x.transcript.messages[2].details.input.action = 'list'; }],
  ['foreign run ID', x => { x.options.cases.cancel.runId = 'foreign'; }],
  ['no terminal collection', x => { x.transcript.messages[1].details.result.details.status = 'running'; }],
  ['different command', x => { x.transcript.messages[0].details.input.command += ' --extra'; }],
  ['detached service', x => { x.transcript.messages[0].details.input.background = true; }],
  ['next Pi before collection', x => { x.transcript.messages[6].details.startedAt = 1500; }],
];
for (const [name, mutate] of traceMutations) test(`T06 Gateway trace rejects ${name}`, () => {
  const x = traceFixture(); mutate(x); assert.throws(() => checkOpenClawTrace(x.transcript, x.options));
});
test('T06 procedure explicitly preserves async handles through Code Mode', () => {
  const procedure = readFileSync(new URL('./openclaw-procedure.txt', import.meta.url), 'utf8');
  assert.ok(procedure.includes('awaitResults:false') && procedure.includes('yieldMs:1000'));
  assert.ok(procedure.includes('process.poll') && procedure.includes('process.log'));
});
