import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRole, validateRequest } from '../role-runner.mjs';
import { engineeringEnvironment } from '../engineering-workspace.mjs';
import { inspectPiLock } from '../pi-lock.mjs';
import { captureImplementation, implementationEntry, validateImplementationDelivery } from '../implementation-delivery.mjs';
import { validateTaskInput } from '../task-input.mjs';
import { commitFixture } from './helpers/task-fixture.mjs';
import { prepareImplementationFixture, writeImplementationReport } from './helpers/implementation-fixture.mjs';

const windows = { skip: process.platform !== 'win32', timeout: 60_000 };
const canary = 'NEVER-PERSIST-MODEL-TOOL-PAYLOAD';
const confirmedTests = { started: 1, completed: 1, pending: 0, latestOutcome: 'passed', correlated: true };
function fixtureTestEnvironment() {
  const env = engineeringEnvironment();
  // A child launched by node:test must run its own tests, not inherit child-v8 mode.
  delete env.NODE_TEST_CONTEXT;
  return env;
}
const testStart = toolCallId => ({ type: 'tool_execution_start', toolName: 'bash', toolCallId, args: { command: 'node --test' } });
const testEnd = (toolCallId, isError = false, value) => ({ type: 'tool_execution_end', toolName: 'bash', toolCallId, isError,
  ...(value === undefined ? {} : { value }) });
function mock(f, { mutate, noReport = false, receipt = true, receiptEvents, finish = {}, promptError, overrides = {} } = {}) {
  const calls = [], receiptChecks = [], driver = new EventEmitter();
  driver.cancel = async () => { calls.push('cancel'); };
  driver.getState = async () => ({ id: 'state', command: 'get_state', success: true,
    data: { model: { id: 'configured' }, isStreaming: false } });
  driver.promptAndWait = async prompt => {
    calls.push('prompt');
    assert.match(prompt, /NOT a manual invocation/u);
    assert.match(prompt, /DO NOT update registro.md/u);
    assert.match(prompt, /No package installation/u);
    assert.ok(!prompt.includes('DO-NOT-EXPOSE'));
    assert.ok(prompt.includes(f.entry.input.task.text.replaceAll('\n', '\\n').slice(0, 30)));
    writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 2;\n');
    execFileSync(process.execPath, ['--test'], { cwd: f.workspace, shell: false, env: fixtureTestEnvironment(), stdio: 'pipe' });
    if (!noReport) writeImplementationReport(f.workspace, f.config.reportPath, f.entry.input, overrides);
    mutate?.(f);
    if (receipt) {
      for (const { value, ...event } of receiptEvents ?? [testStart('test'), testEnd('test')]) {
        if (value !== undefined) {
          writeFileSync(join(f.workspace, 'value.mjs'), `export const value = ${value};\n`);
          let failed = false;
          try { execFileSync(process.execPath, ['--test'], { cwd: f.workspace, shell: false, env: fixtureTestEnvironment(), stdio: 'pipe' }); }
          catch (error) { failed = true; receiptChecks.push({ status: error.status, output: String(error.stdout), error: String(error.stderr) }); }
          receiptChecks.push({ value, failed, expected: event.isError });
          assert.equal(failed, event.isError, JSON.stringify(receiptChecks));
        }
        driver.emit('event', { ...event, result: canary });
      }
    }
    if (promptError) throw Object.assign(new Error(canary), { code: promptError });
    driver.emit('event', { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: canary }] } });
    return { response: { success: true, data: { disposition: 'started' } }, settled: { type: 'agent_settled' }, assistantError: false };
  };
  return { calls, receiptChecks, acquire: async () => {
    calls.push('acquire');
    return { launch: async options => { calls.push('launch'); assert.equal(options.profile, 'engineering'); return driver; },
      finish: async () => { calls.push('finish'); return { released: true,
        termination: { state: 'terminated', canRelease: true, processesGone: true, workCompleted: true,
          forced: false, exitCode: 0 }, ...finish }; } };
  } };
}
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

// Admission always happens BEFORE persistence, acquire or spawn.
for (const [name, change, trusted] of [
  ['no approval', () => {}, () => undefined],
  ['changed input ID', f => { f.config.taskInputId = '0'.repeat(64); }],
  ['changed human task hash', () => {}, f => ({ ...f.approval, taskHash: '0'.repeat(64) })],
  ['report not allowed', f => { f.config.reportPath = 'other/achados/task-M02-T02-relatorio.md'; }],
  ['report traversal', f => { f.config.reportPath = '../docs/achados/task-M02-T02-relatorio.md'; }],
  ['report is code', f => { f.config.reportPath = 'value.mjs'; }],
  ['arbitrary prompt', f => { f.config.prompt = 'do anything'; }],
  ['arbitrary expected marker', f => { f.config.expectedText = 'OK'; }],
  ['approval embedded in config', f => { f.config.approval = f.approval; }],
  ['isolated profile', f => { f.config.modelProfile = 'configured-isolated'; delete f.config.engineering; }],
]) {
  test(`implementation rejects ${name} before launch`, windows, async t => {
    const f = prepareImplementationFixture(t); change(f);
    let acquired = false;
    await assert.rejects(runRole(f.config, { approval: trusted ? trusted(f) : f.approval,
      acquire: async () => { acquired = true; } }));
    assert.equal(acquired, false); assert.equal(existsSync(f.config.artifactsRoot), false);
  });
}

test('implementation output is structural completion only, with stable diff/report identity and normal release', windows, async t => {
  const f = prepareImplementationFixture(t), m = mock(f), register = readFileSync(join(f.workspace, 'docs/registro.md'));
  const out = await runRole(f.config, { approval: f.approval, acquire: m.acquire });
  assert.deepEqual(m.calls, ['acquire', 'launch', 'prompt', 'finish']);
  assert.equal(out.exitCode, 0); assert.equal(out.result.role, 'implementador');
  assert.equal(out.result.roleOutcome, 'completed'); assert.equal(out.result.taskApproved, false);
  assert.equal(out.result.technicalOutcome, 'succeeded'); assert.equal(out.result.observed.markerMatched, false);
  assert.equal(out.result.delivery.accepted, true); assert.match(out.result.delivery.deliveryId, /^[a-f0-9]{64}$/u);
  assert.deepEqual(out.result.delivery.changedFiles, [f.config.reportPath, 'value.mjs']);
  assert.deepEqual(readJson(join(out.runDir, 'delivery.json')), out.result.delivery);
  assert.deepEqual(readJson(join(out.runDir, 'result.json')), out.result);
  assert.equal(readJson(join(out.runDir, 'implementation-input.json')).input.inputId, f.entry.input.inputId);
  assert.ok(register.equals(readFileSync(join(f.workspace, 'docs/registro.md'))));
  assert.equal(f.git(['rev-parse', 'HEAD']), f.engineering.baseline);
  assert.equal(f.git(['diff', '--cached', '--name-only']), '');
  assert.ok(!readFileSync(join(out.runDir, 'events.jsonl'), 'utf8').includes(canary));
  assert.ok(!JSON.stringify(out.result).includes(canary));
});

for (const [name, receiptEvents, accepted, pending, latestOutcome] of [
  ['pass then real failure', [testStart('a'), testEnd('a', false, 2), testStart('b'), testEnd('b', true, 3)], false, 0, 'failed'],
  ['real failure then corrected pass', [testStart('a'), testEnd('a', true, 3), testStart('b'), testEnd('b', false, 2)], true, 0, 'passed'],
  ['pass then pending test', [testStart('a'), testEnd('a', false, 2), testStart('b')], false, 1, 'pending'],
  ['earlier pending test despite final pass', [testStart('a'), testStart('b'), testEnd('b', false, 2)], false, 1, 'passed'],
  ['late older pass cannot hide newer failure', [testStart('a'), testStart('b'), testEnd('b', true), testEnd('a')], false, 0, 'failed'],
  ['late older failure cannot replace newer pass', [testStart('a'), testStart('b'), testEnd('b'), testEnd('a', true)], true, 0, 'passed'],
  ['pending test with unrelated end', [testStart('a'), testEnd('a'), testStart('b'), testEnd('other')], false, 1, 'pending'],
  ['pending test with wrong tool end', [testStart('a'), testEnd('a'), testStart('b'), { ...testEnd('b'), toolName: 'read' }], false, 1, 'pending'],
  ['end without explicit success', [testStart('a'), testEnd('a'), testStart('b'), { type: 'tool_execution_end', toolName: 'bash', toolCallId: 'b' }], false, 0, 'failed'],
  ['duplicate end is untrustworthy', [testStart('a'), testEnd('a'), testEnd('a')], false, 0, 'passed'],
  ['reused call ID is untrustworthy', [testStart('a'), testEnd('a'), testStart('a'), testEnd('a')], false, 1, 'pending'],
  ['test without call ID remains unconfirmed', [testStart('a'), testEnd('a'), testStart(undefined)], false, 1, 'pending'],
]) {
  test(`implementation test evidence: ${name}`, windows, async t => {
    const f = prepareImplementationFixture(t), m = mock(f, { receiptEvents });
    const out = await runRole(f.config, { approval: f.approval, acquire: m.acquire });
    assert.equal(out.exitCode, accepted ? 0 : 1, JSON.stringify({ result: out.result, checks: m.receiptChecks }));
    assert.equal(out.result.delivery.accepted, accepted, JSON.stringify(out.result));
    assert.equal(out.result.roleOutcome, accepted ? 'completed' : 'blocked', JSON.stringify({ result: out.result, checks: m.receiptChecks }));
    assert.equal(out.result.taskApproved, false);
    assert.equal(out.result.observed.engineering.harmlessTestSucceeded, accepted);
    const evidence = out.result.observed.engineering.testEvidence;
    assert.equal(evidence.pending, pending); assert.equal(evidence.latestOutcome, latestOutcome);
    assert.equal(evidence.started, evidence.completed + pending);
    if (!accepted) assert.equal(out.result.delivery.reason.code, 'IMPLEMENTATION_TEST_UNCONFIRMED');
    assert.deepEqual(readJson(join(out.runDir, 'result.json')), out.result);
    assert.ok(!JSON.stringify(out.result).includes(canary));
    assert.equal(f.git(['rev-parse', 'HEAD']), f.engineering.baseline);
    assert.equal(m.calls.at(-1), 'finish');
  });
}

test('delivery gate does not accept a stale success boolean without final test evidence', windows, t => {
  const f = prepareImplementationFixture(t), entry = implementationEntry(f.config, f.approval);
  const before = captureImplementation(f.config, entry);
  writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 2;\n');
  writeImplementationReport(f.workspace, f.config.reportPath, entry.input);
  for (const testEvidence of [undefined, { ...confirmedTests, latestOutcome: 'failed' },
    { ...confirmedTests, pending: 1 }, { ...confirmedTests, completed: 0 }, { ...confirmedTests, correlated: false }]) {
    const gate = validateImplementationDelivery(f.config, entry, before, {
      terminated: true, released: true, processSucceeded: true, testSucceeded: true, testEvidence,
    });
    assert.equal(gate.accepted, false); assert.equal(gate.reason.code, 'IMPLEMENTATION_TEST_UNCONFIRMED');
  }
});

for (const [name, options, reason] of [
  ['absent report', { noReport: true }, 'IMPLEMENTATION_REPORT_MISSING'],
  ['report without sections', { mutate: f => writeFileSync(join(f.workspace, f.config.reportPath), '# completed') }, 'INVALID_IMPLEMENTATION_REPORT'],
  ['wrong report baseline', { overrides: { baseline: '0'.repeat(40) } }, 'REPORT_DIFF_MISMATCH'],
  ['wrong report input', { overrides: { inputId: '0'.repeat(64) } }, 'REPORT_DIFF_MISMATCH'],
  ['report inconsistent with diff', { overrides: { changedFiles: ['test/fixture.test.mjs'] } }, 'REPORT_DIFF_MISMATCH'],
  ['unidentified artifact', { overrides: { changedFiles: [] } }, 'REPORT_DIFF_MISMATCH'],
  ['duplicate artifact', { overrides: { changedFiles: ['value.mjs', 'value.mjs'] } }, 'INVALID_IMPLEMENTATION_REPORT'],
  ['failed test recorded', { overrides: { commands: [{ command: 'node --test', outcome: 'failed' }] } }, 'INVALID_IMPLEMENTATION_REPORT'],
  ['test without tool receipt', { receipt: false }, 'IMPLEMENTATION_TEST_UNCONFIRMED'],
  ['report only', { mutate: f => writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 1;\n') }, 'REPORT_DIFF_MISMATCH'],
  ['register mutation', { mutate: f => writeFileSync(join(f.workspace, 'docs/registro.md'), 'forbidden') }, 'PROHIBITED_CHANGE'],
  ['plan mutation', { mutate: f => writeFileSync(join(f.workspace, 'docs/plano.md'), 'forbidden') }, 'PROHIBITED_CHANGE'],
  ['test mutation', { mutate: f => writeFileSync(join(f.workspace, 'test/fixture.test.mjs'), 'forbidden') }, 'PROHIBITED_CHANGE'],
  ['new forbidden file', { mutate: f => writeFileSync(join(f.workspace, 'extra.mjs'), 'forbidden') }, 'PROHIBITED_CHANGE'],
  ['new forbidden empty directory', { mutate: f => mkdirSync(join(f.workspace, 'extra')) }, 'PROHIBITED_CHANGE'],
  ['protected file deletion', { mutate: f => rmSync(join(f.workspace, 'AGENTS.md')) }, 'PROHIBITED_CHANGE'],
  ['staging', { mutate: f => f.git(['add', 'value.mjs']) }, 'GIT_METADATA_CHANGED'],
  ['commit', { mutate: f => { f.git(['add', 'value.mjs']); f.git(['-c', 'user.name=Fake', '-c', 'user.email=fake@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Forbidden']); } }, 'GIT_REFS_CHANGED'],
  ['new ref', { mutate: f => f.git(['branch', 'forbidden']) }, 'GIT_REFS_CHANGED'],
  ['commit followed by reset', { mutate: f => { f.git(['add', 'value.mjs']); f.git(['-c', 'user.name=Fake', '-c', 'user.email=fake@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Forbidden']); f.git(['reset', '--mixed', f.engineering.baseline]); } }, 'GIT_METADATA_CHANGED'],
  ['new Git hook', { mutate: f => { mkdirSync(join(f.workspace, '.git/hooks')); writeFileSync(join(f.workspace, '.git/hooks/pre-commit'), 'fake'); } }, 'GIT_METADATA_CHANGED'],
  ['credentials', { mutate: f => writeFileSync(join(f.workspace, '.env'), 'FICTIONAL=1') }, 'UNSAFE_DELIVERY'],
  ['hard link', { mutate: f => linkSync(join(f.workspace, 'value.mjs'), join(f.workspace, 'copy.mjs')) }, 'UNSAFE_DELIVERY'],
  ['junction', { mutate: f => symlinkSync(f.root, join(f.workspace, 'external'), 'junction') }, 'UNSAFE_DELIVERY'],
  ['uncertain process', { finish: { released: false, termination: { state: 'uncertain' } } }, 'IMPLEMENTATION_PROCESS_UNCONFIRMED'],
  ['lease not released', { finish: { released: false } }, 'IMPLEMENTATION_PROCESS_UNCONFIRMED'],
  ['forced shutdown', { finish: { termination: { state: 'terminated', canRelease: true, processesGone: true, forced: true, workCompleted: true, exitCode: 0 } } }, 'IMPLEMENTATION_PROCESS_FAILED'],
  ['RPC failure despite valid files', { promptError: 'SETTLED_TIMEOUT' }, 'IMPLEMENTATION_PROCESS_FAILED'],
]) {
  test(`implementation blocks ${name}, never approves or repairs`, windows, async t => {
    const f = prepareImplementationFixture(t), m = mock(f, options);
    const out = await runRole(f.config, { approval: f.approval, acquire: m.acquire });
    assert.equal(out.exitCode, 1); assert.equal(out.result.delivery.accepted, false);
    assert.equal(out.result.delivery.reason.code, reason, JSON.stringify(out.result));
    assert.notEqual(out.result.roleOutcome, 'completed'); assert.equal(out.result.taskApproved, false);
    assert.equal(m.calls.at(-1), 'finish');
  });
}

test('revalidation under lease rejects stale clean entry without spawning Pi', windows, async t => {
  const f = prepareImplementationFixture(t), m = mock(f);
  const out = await runRole(f.config, { approval: f.approval, acquire: async () => {
    const lease = await m.acquire(); f.git(['branch', 'late-ref']); return lease;
  } });
  assert.deepEqual(m.calls, ['acquire', 'finish']); assert.equal(out.exitCode, 1);
  assert.ok(out.result.errorCodes.includes('IMPLEMENTATION_ENTRY_REJECTED'));
});

test('raw byte diff inconsistent with Git is blocked (checkout normalization)', windows, t => {
  const f = prepareImplementationFixture(t);
  writeFileSync(join(f.workspace, '.gitattributes'), 'value.mjs text eol=lf\n');
  commitFixture(f); f.config.engineering = { ...f.engineering };
  f.entry = validateTaskInput(f.request, f.approval); f.config.taskInputId = f.entry.input.inputId;
  const entry = implementationEntry(f.config, f.approval), before = captureImplementation(f.config, entry);
  writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 1;\r\n');
  writeImplementationReport(f.workspace, f.config.reportPath, entry.input);
  const gate = validateImplementationDelivery(f.config, entry, before, {
    terminated: true, released: true, processSucceeded: true, testEvidence: confirmedTests,
  });
  assert.equal(gate.accepted, false); assert.equal(gate.reason.code, 'DIFF_MISMATCH');
});

test('mutation during final report inspection invalidates the handoff snapshot', windows, t => {
  const f = prepareImplementationFixture(t), entry = implementationEntry(f.config, f.approval);
  const before = captureImplementation(f.config, entry);
  writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 2;\n');
  writeImplementationReport(f.workspace, f.config.reportPath, entry.input);
  const original = fs.readFileSync; let reportReads = 0;
  try {
    fs.readFileSync = function(path, ...args) {
      const bytes = original.call(this, path, ...args);
      if (String(path) === join(f.workspace, f.config.reportPath) && ++reportReads === 2) {
        writeFileSync(join(f.workspace, 'value.mjs'), 'export const value = 3;\n');
      }
      return bytes;
    };
    syncBuiltinESMExports();
    const gate = validateImplementationDelivery(f.config, entry, before, {
      terminated: true, released: true, processSucceeded: true, testEvidence: confirmedTests,
    });
    assert.equal(gate.accepted, false); assert.equal(gate.reason.code, 'DELIVERY_CONCURRENT_CHANGE');
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('literal fake RPC process exercises CLI, Driver, global lease and actual fixture tests', windows, async t => {
  const f = prepareImplementationFixture(t);
  const rpc = fileURLToPath(new URL('./fixtures/implementation-rpc.mjs', import.meta.url));
  writeFileSync(f.config.piCmd, `@echo off\r\n"${process.execPath}" "${rpc}"\r\n`);
  const requestPath = join(f.root, 'request.json'), approvalPath = join(f.root, 'approval.json');
  writeFileSync(requestPath, JSON.stringify(f.config)); writeFileSync(approvalPath, JSON.stringify(f.approval));
  assert.equal((await inspectPiLock()).canAcquire, true);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../role-runner.mjs', import.meta.url)),
    'run', '--config', requestPath, '--approval', approvalPath], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', errors = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { errors += b; });
  const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  const resultLine = JSON.parse(output.trim().split('\n').at(-1));
  const result = readJson(join(f.config.artifactsRoot, 'runs', resultLine.runId, 'result.json'));
  assert.equal(exitCode, 0, JSON.stringify(result) + errors);
  assert.equal(result.roleOutcome, 'completed'); assert.ok(result.termination.processesGone && result.lock.released);
  assert.equal((await inspectPiLock()).canAcquire, true); assert.equal(result.taskApproved, false);
});
