import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJson, loadRequest, runRole, validateRequest } from '../role-runner.mjs';
import { acquirePiLock, inspectPiLock } from '../pi-lock.mjs';

const windows = { skip: process.platform !== 'win32', timeout: 90_000 };
const runner = fileURLToPath(new URL('../role-runner.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/runner-rpc.mjs', import.meta.url));
const registry = fileURLToPath(new URL('../../docs_devout/03-execucao/registro.md', import.meta.url));
const canary = 'CANARY-DO-NOT-PERSIST-T04';
const code = name => error => error.code === name;
function setup(t, mode = 'normal') {
  const root = mkdtempSync(join(tmpdir(), 'devout runner espaço '));
  const workspace = join(root, 'workspace'), artifactsRoot = join(root, 'operacional');
  mkdirSync(workspace);
  writeFileSync(join(workspace, '.devout-disposable.json'), JSON.stringify({ schemaVersion: 1, disposable: true }));
  const piCmd = join(root, 'pi.cmd');
  writeFileSync(piCmd, `@echo off\r\n"${process.execPath}" "${fixture}" ${mode}\r\n`);
  const config = { schemaVersion: 1, taskId: 'M01-T04-TEST', role: 'test', workspace, artifactsRoot, piCmd,
    modelProfile: 'configured-isolated', prompt: `Responda PONG-DEVOUT-T04. ${canary}`,
    expectedText: 'PONG-DEVOUT-T04', driver: { commandTimeoutMs: 3000, settlementTimeoutMs: 3000,
      normalWaitMs: 3000, forceWaitMs: 5000, pollMs: 30, abortTimeoutMs: 500 } };
  const context = { root, config, preserve: false };
  t.after(() => { if (!context.preserve) rmSync(root, { recursive: true, force: true }); });
  return context;
}
function mock({ uncertain = false, failPrompt = false, failState = false, stateModel = true, aborted = false } = {}) {
  const calls = [];
  const d = new EventEmitter();
  d.getState = async () => {
    calls.push('get_state');
    if (failState) throw Object.assign(new Error(canary), { code: canary });
    return { id: 'rpc-id', command: 'get_state', success: true,
      data: { model: stateModel ? { id: canary } : null, isStreaming: false } };
  };
  d.promptAndWait = async () => {
    calls.push('prompt');
    if (failPrompt) throw Object.assign(new Error(canary), { code: 'SETTLED_TIMEOUT' });
    d.emit('diagnostic', Buffer.from(canary));
    d.emit('event', { type: canary, payload: canary });
    d.emit('event', { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'PONG-DEVOUT-T04' }] } });
    d.emit('event', { type: 'agent_settled', aborted });
    return { response: { success: true, data: { disposition: 'started' } },
      settled: { type: 'agent_settled', aborted }, assistantError: aborted };
  };
  d.cancel = async () => { calls.push('cancel'); };
  const acquire = async () => {
    calls.push('acquire');
    return {
      launch: async options => { calls.push('launch'); assert.equal(options.profile, 'isolated'); return d; },
      finish: async ({ cancel }) => {
        calls.push(cancel ? 'finish_cancel' : 'finish');
        if (uncertain) throw Object.assign(new Error(canary), { code: 'LOCK_PROCESS_UNCERTAIN' });
        return { released: true, termination: { state: 'terminated', canRelease: true, processesGone: true,
          workCompleted: !cancel, cancelled: cancel, forced: false, exitCode: 0,
          identity: { pid: 4321, created: '12345' }, observed: [{ pid: 4321, created: '12345' }] } };
      },
    };
  };
  return { acquire, calls, driver: d };
}
function evidence(outcome, output = '') {
  const events = readFileSync(join(outcome.runDir, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const disk = JSON.parse(readFileSync(join(outcome.runDir, 'result.json'), 'utf8'));
  const state = JSON.parse(readFileSync(join(outcome.runDir, 'state.json'), 'utf8'));
  assert.deepEqual(disk, outcome.result);
  assert.equal(state.state, disk.state);
  assert.ok(!JSON.stringify({ disk, state, events, output }).includes(canary));
  assert.deepEqual(events.map(event => event.seq), events.map((_, index) => index + 1));
  assert.equal(disk.taskApproved, false);
  assert.ok(!JSON.stringify(disk).includes('completed'));
  return events;
}

// Atomic persistence is platform-independent and does not require Pi.
test('atomic JSON replaces a whole result and preserves the old file on serialization/rename failure', t => {
  const root = mkdtempSync(join(tmpdir(), 'devout atomic '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'result.json');
  atomicWriteJson(file, { previous: true });
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => atomicWriteJson(file, cyclic));
  assert.deepEqual(JSON.parse(readFileSync(file)), { previous: true });
  atomicWriteJson(file, { previous: false, final: true });
  assert.deepEqual(JSON.parse(readFileSync(file)), { previous: false, final: true });
  assert.deepEqual(readdirSync(root), ['result.json']);
  const blocked = join(root, 'directory'); mkdirSync(blocked);
  assert.throws(() => atomicWriteJson(blocked, { final: true }));
  assert.deepEqual(readdirSync(blocked), []);
  assert.equal(readdirSync(root).filter(name => name.endsWith('.tmp')).length, 1);
});

test('independent readers observe only whole atomic JSON versions', { timeout: 30_000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'devout atomic reader '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, 'result.json');
  atomicWriteJson(path, { version: 0, payload: 'x'.repeat(8192) });
  const moduleUrl = new URL('../role-runner.mjs', import.meta.url).href;
  const script = `import { atomicWriteJson } from ${JSON.stringify(moduleUrl)};
    for (let version=1; version<=100; version++) atomicWriteJson(${JSON.stringify(path)}, { version, payload: 'x'.repeat(8192) });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
  let diagnostics = '';
  child.stderr.on('data', bytes => { diagnostics += bytes; });
  let finished = false;
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', code => { finished = true; resolve(code); });
  });
  let reads = 0;
  while (!finished) {
    const record = JSON.parse(readFileSync(path, 'utf8'));
    assert.ok(Number.isInteger(record.version) && record.version >= 0 && record.version <= 100);
    assert.equal(record.payload, 'x'.repeat(8192)); reads++;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(await closed, 0, diagnostics);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).version, 100);
  assert.ok(reads > 0);
});

test('request uses a closed schema, a marked disposable workspace and bounded Driver parameters', windows, t => {
  const { config } = setup(t);
  assert.equal(validateRequest(config).role, 'test');
  const cases = [
    { role: 'implementador' }, { modelProfile: 'arbitrary' }, { schemaVersion: 2 }, { taskId: '../task' },
    { prompt: '' }, { prompt: 'x'.repeat(65537) }, { expectedText: '' }, { workspace: tmpdir() },
    { workspace: fileURLToPath(new URL('../..', import.meta.url)) },
    { artifactsRoot: config.workspace }, { artifactsRoot: join(config.workspace, 'runs') },
    { artifactsRoot: fileURLToPath(new URL('..', import.meta.url)) },
    { piCmd: config.piCmd + ' & whoami' }, { piCmd: 'relative.cmd' },
    { driver: { shell: true } }, { driver: { maxRecordBytes: 8 * 1024 * 1024 + 1 } },
    { driver: { maxPending: 33 } }, { driver: { commandTimeoutMs: 0 } },
    { driver: { settlementTimeoutMs: 1.5 } }, { driver: { normalWaitMs: 600001 } },
    { command: 'bash' }, { lockRoot: config.artifactsRoot }, { profile: 'default' }, { runId: 'caller-id' },
    { taskApproved: true }, { driver: [] }, { driver: null },
  ];
  for (const change of cases) assert.throws(() => validateRequest({ ...config, ...change }), code('INVALID_REQUEST'));
  rmSync(join(config.workspace, '.devout-disposable.json'));
  assert.throws(() => validateRequest(config), code('INVALID_REQUEST'));
});

test('rejects histories, nested links, Git workspaces, unsafe operational junctions and malformed JSON', windows, t => {
  const { root, config } = setup(t);
  for (const name of ['.git', '.pi', '.openclaw']) {
    mkdirSync(join(config.workspace, name));
    assert.throws(() => validateRequest(config), code('INVALID_REQUEST'));
    rmSync(join(config.workspace, name), { recursive: true });
  }
  const external = join(root, 'external'); mkdirSync(external);
  const link = join(config.workspace, 'link'); symlinkSync(external, link, 'junction');
  assert.throws(() => validateRequest(config), code('INVALID_REQUEST'));
  rmSync(link, { recursive: true });
  mkdirSync(config.artifactsRoot);
  symlinkSync(config.workspace, join(config.artifactsRoot, 'runs'), 'junction');
  // Validation alone does not create operational directories; launch checks runs.
  assert.throws(() => loadRequest('relative.json'), code('INVALID_REQUEST'));
  const path = join(root, 'request.json');
  for (const bytes of ['{', '{"schemaVersion":1,"unknown":true}', Buffer.from([0xff]), '\ufeff{}', ' '.repeat(256 * 1024 + 1)]) {
    writeFileSync(path, bytes);
    assert.throws(() => loadRequest(path), code('INVALID_REQUEST'));
  }
});

test('orders acquisition, one isolated launch, settlement, verified release and atomic result; run IDs differ', windows, async t => {
  const { config } = setup(t), first = mock(), output = [];
  const before = readFileSync(registry);
  const outcome = await runRole(config, { acquire: first.acquire, notify: event => output.push(event) });
  assert.deepEqual(first.calls, ['acquire', 'launch', 'get_state', 'prompt', 'finish']);
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.result.technicalOutcome, 'succeeded');
  assert.equal(outcome.result.state, 'terminated');
  assert.equal(outcome.result.observed.markerMatched, true);
  const events = evidence(outcome, JSON.stringify(output));
  assert.deepEqual(events.filter(event => event.type === 'state').map(event => event.state),
    ['starting', 'running', 'stopping', 'terminated']);
  const second = await runRole(config, { acquire: mock().acquire });
  assert.notEqual(second.result.runId, outcome.result.runId);
  assert.notEqual(outcome.result.runId, config.taskId);
  assert.notEqual(outcome.result.runId, 'rpc-id');
  assert.deepEqual(readFileSync(registry), before);
});

for (const options of [{ failPrompt: true }, { uncertain: true }, { failState: true }, { stateModel: false }, { aborted: true }]) {
  test(`technical failure never approves a task: ${JSON.stringify(options)}`, windows, async t => {
    const { config } = setup(t), d = mock(options);
    const outcome = await runRole(config, { acquire: d.acquire });
    assert.equal(outcome.exitCode, 1);
    assert.equal(outcome.result.state, options.uncertain ? 'uncertain' : 'terminated');
    assert.equal(outcome.result.technicalOutcome, options.aborted ? 'interrupted' : 'failed');
    assert.equal(outcome.result.lock.released, !options.uncertain);
    assert.ok(d.calls.includes(options.uncertain ? 'finish' : 'finish_cancel'));
    evidence(outcome);
  });
}

test('busy lock records failure without launching a Pi', windows, async t => {
  const { config } = setup(t);
  const outcome = await runRole(config, { acquire: async () => { throw Object.assign(new Error(canary), { code: 'LOCK_BUSY' }); } });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.result.termination, null);
  assert.equal(outcome.result.lock.acquired, false);
  assert.equal(outcome.result.state, 'terminated');
  evidence(outcome);
});

test('persistence failure before launch prevents Pi; failure during activity still cancels and releases', windows, async t => {
  const { config } = setup(t);
  let acquired = 0;
  const initial = await runRole(config, { acquire: async () => { acquired++; }, notify: () => { throw new Error(canary); } });
  assert.equal(acquired, 0);
  assert.equal(initial.exitCode, 1);
  assert.ok(initial.result.errorCodes.includes('PERSISTENCE_FAILED'));
  const d = mock();
  const active = await runRole(config, { acquire: d.acquire, notify: event => {
    if (event.type === 'state' && event.state === 'running') throw new Error(canary);
  } });
  assert.equal(active.exitCode, 1);
  assert.ok(d.calls.includes('cancel'));
  assert.ok(d.calls.includes('finish_cancel'));
  assert.equal(active.result.lock.released, true);
  evidence(active);
});

test('failed result publication leaves no readable success result after verified shutdown', windows, async t => {
  const { config } = setup(t), d = mock();
  let runDir;
  await assert.rejects(runRole(config, { acquire: d.acquire, notify: event => {
    if (event.type === 'state' && event.state === 'terminated') {
      runDir = join(config.artifactsRoot, 'runs', event.runId);
      mkdirSync(join(runDir, 'result.json')); // deterministic rename failure
    }
  } }), code('PERSISTENCE_FAILED'));
  assert.ok(d.calls.includes('finish'));
  assert.throws(() => readFileSync(join(runDir, 'result.json'), 'utf8'));
  assert.equal(JSON.parse(readFileSync(join(runDir, 'state.json'), 'utf8')).state, 'terminated');
  assert.ok(readdirSync(runDir).some(name => name.endsWith('.tmp')));
});

test('operational runs junction is rejected before acquiring or launching', windows, async t => {
  const { config } = setup(t);
  mkdirSync(config.artifactsRoot);
  symlinkSync(config.workspace, join(config.artifactsRoot, 'runs'), 'junction');
  let acquired = false;
  await assert.rejects(runRole(config, { acquire: async () => { acquired = true; } }), code('PERSISTENCE_FAILED'));
  assert.equal(acquired, false);
});

async function cli(configPath, extra = []) {
  const child = spawn(process.execPath, [runner, 'run', '--config', configPath, ...extra], { shell: false, windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; });
  child.stderr.on('data', bytes => { stderr += bytes; });
  const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  return { child, exitCode, stdout, stderr };
}

test('CLI rejects unknown flags and invalid requests without creating artifacts or changing the registry', windows, async t => {
  const { root, config } = setup(t), path = join(root, 'request.json');
  const before = readFileSync(registry);
  writeFileSync(path, JSON.stringify({ ...config, role: 'revisor' }));
  assert.equal((await cli(path)).exitCode, 2);
  writeFileSync(path, JSON.stringify(config));
  assert.equal((await cli(path, ['--shell', canary])).exitCode, 2);
  assert.equal(readdirSync(root).includes('operacional'), false);
  assert.deepEqual(readFileSync(registry), before);
});

// Actual CLI + native guard + Driver Job proof. Serial tests use the SAME global
// default root as production (never choose another root to evade a held lease).
for (const mode of ['normal', 'rpc-error', 'eof', 'crash', 'timeout', 'assistant-error', 'aborted', 'mismatch']) {
  test(`direct CLI / fake Pi / native lock: ${mode}`, windows, async t => {
    const context = setup(t, mode), { root, config } = context;
    assert.equal((await inspectPiLock()).canAcquire, true, 'Reconcile the global workflow lock before running tests');
    const before = readFileSync(registry), path = join(root, 'request.json');
    writeFileSync(path, JSON.stringify(config));
    const output = await cli(path);
    const runIds = readdirSync(join(config.artifactsRoot, 'runs'));
    assert.equal(runIds.length, 1);
    const runDir = join(config.artifactsRoot, 'runs', runIds[0]);
    const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8'));
    if (!result.lock.released) context.preserve = true;
    assert.equal(output.exitCode, mode === 'normal' ? 0 : 1, output.stdout + output.stderr);
    assert.equal(result.state, 'terminated');
    assert.equal(result.lock.released, true);
    assert.equal(result.termination.processesGone, true);
    assert.equal(output.child.exitCode, output.exitCode); // close observed: Runner no longer exists
    evidence({ runDir, result }, output.stdout + output.stderr);
    assert.equal((await inspectPiLock()).canAcquire, true);
    const next = await acquirePiLock({ runId: 'T04-prove-reacquisition' });
    assert.equal((await next.finish()).released, true);
    assert.deepEqual(readFileSync(registry), before);
  });
}
