// Opt-in T05: real disposable Pi, two independent control invocations, no secrets.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquirePiLock, inspectPiLock } from '../pi-lock.mjs';
import { requestCancellation } from '../run-control.mjs';
import { activeCancellationEvidence } from './helpers/active-cancellation.mjs';
const exec = promisify(execFile);
const runner = fileURLToPath(new URL('../role-runner.mjs', import.meta.url));
const registry = fileURLToPath(new URL('../../docs_devout/03-execucao/registro.md', import.meta.url));
const summary = { test: 'M01-T05 real asynchronous Runner cancellation', at: new Date().toISOString(),
  platform: process.platform, node: process.version, cases: [], pass: false };
let root, witness, witnessClosed;
function invocation(args, onEvent = () => {}) {
  const child = spawn(process.execPath, [runner, ...args], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let buffer = '', diagnostics = false;
  const events = [];
  child.stdout.on('data', bytes => {
    buffer += bytes;
    const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) {
      try { const event = JSON.parse(line); events.push(event); onEvent(event); }
      catch { diagnostics = true; }
    }
  });
  child.stderr.on('data', () => { diagnostics = true; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', exitCode => resolve({ exitCode, diagnostics, events }));
  });
  return { child, closed };
}
function cancel(artifactsRoot, runId) {
  return invocation(['cancel', '--artifacts-root', artifactsRoot, '--run-id', runId]).closed;
}
try {
  assert.equal(process.platform, 'win32');
  assert.equal((await inspectPiLock()).canAcquire, true, 'Reconcile the global lock first');
  root = await mkdtemp(join(tmpdir(), 'devout-runner-cancel-smoke-'));
  const before = await readFile(registry), artifactsRoot = join(root, 'operacional');
  witness = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'],
    { shell: false, windowsHide: true, stdio: 'ignore' });
  witnessClosed = new Promise((resolve, reject) => { witness.once('error', reject); witness.once('close', resolve); });
  for (const point of ['response_started', 'stopping']) {
    assert.equal((await inspectPiLock()).canAcquire, true);
    const workspace = join(root, point); await mkdir(workspace);
    await writeFile(join(workspace, '.devout-disposable.json'), '{"schemaVersion":1,"disposable":true}');
    const config = join(root, `${point}.json`);
    await writeFile(config, JSON.stringify({ schemaVersion: 1, taskId: 'M01-T05-SMOKE', role: 'test', workspace, artifactsRoot,
      piCmd: process.env.DEVOUT_PI_CMD || join(process.env.USERPROFILE, '.pi', 'agent', 'bin', 'pi.cmd'),
      modelProfile: 'configured-isolated',
      prompt: point === 'response_started' ? 'Teste descartável inofensivo de streaming. Escreva uma história original de pelo menos 2000 palavras sobre um robô jardineiro em um planeta fictício, em prosa contínua, sem resumir.' :
        'Teste inofensivo. Responda somente PONG-DEVOUT-T05, sem explicações.',
      expectedText: 'PONG-DEVOUT-T05', driver: { settlementTimeoutMs: 90000 } }));
    let request, runId;
    const run = invocation(['run', '--config', config], event => {
      runId = event.runId;
      if (!request && (event.type === point || event.type === 'state' && event.state === point)) {
        // This already-loaded controller is a separate process from the Runner.
        // Avoid CLI bootstrap latency at both narrow points; repeats below and
        // deterministic integration tests still exercise the independent CLI.
        request = requestCancellation({ artifactsRoot, runId }).then(receipt =>
          ({ exitCode: 0, diagnostics: false, events: [receipt] }));
        request.catch(() => {}); // Awaited below, including a rejected request.
      }
    });
    const output = await run.closed;
    const entry = { point, requestInterface: 'independent-controller-local-api', pass: false,
      runId, runnerPid: run.child.pid, runnerExitCode: output.exitCode, runnerClosed: run.child.exitCode !== null };
    summary.cases.push(entry);
    assert.ok(request, 'Requested observation point was not reached');
    const receipt = await request; entry.requestStatus = receipt.events[0]?.status;
    assert.equal(receipt.exitCode, 0); assert.equal(receipt.diagnostics, false);
    assert.equal(entry.requestStatus, 'requested');
    const runDir = join(artifactsRoot, 'runs', runId);
    const result = JSON.parse(await readFile(join(runDir, 'result.json'), 'utf8'));
    entry.technicalOutcome = result.technicalOutcome; entry.state = result.state;
    entry.observed = result.observed; entry.termination = result.termination; entry.lockReleased = result.lock.released;
    assert.equal(output.exitCode, 1); assert.equal(output.diagnostics, false);
    assert.equal(result.technicalOutcome, 'interrupted'); assert.equal(result.taskApproved, false);
    assert.equal(result.cancellation.requested, true); assert.ok(result.errorCodes.includes('CANCELLED'));
    assert.equal(result.state, 'terminated'); assert.equal(result.lock.released, true);
    assert.ok(result.termination.processesGone && result.termination.canRelease);
    const diskEvents = (await readFile(join(runDir, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(output.events.slice(0, -1), diskEvents);
    assert.equal(process.kill(witness.pid, 0), true, 'Unrelated process must remain alive');
    assert.notEqual(result.termination.identity.pid, witness.pid);
    entry.unrelatedProcessAlive = true;
    if (point === 'response_started') {
      const control = JSON.parse(await readFile(join(runDir, 'control.json'), 'utf8'));
      entry.activeCancellation = activeCancellationEvidence({ events: diskEvents, control, result });
    } else assert.ok(result.observed.markerMatched && result.observed.settled);
    const repeat = await cancel(artifactsRoot, runId); entry.repeatStatus = repeat.events[0]?.status;
    assert.equal(repeat.exitCode, 0); assert.equal(entry.repeatStatus, 'too_late');
    const pids = [...new Set([run.child.pid, ...result.termination.observed.map(item => item.pid)])];
    const check = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `$ids=@(${pids.join(',')}); @((Get-CimInstance Win32_Process) | Where-Object { $ids -contains [int]$_.ProcessId }).Count`],
    { timeout: 15000, windowsHide: true });
    entry.independentlyGone = Number(check.stdout.trim()) === 0; assert.ok(entry.independentlyGone);
    assert.equal((await inspectPiLock()).canAcquire, true);
    const next = await acquirePiLock({ runId: 'T05-real-cancel-prove-reacquisition' });
    entry.reacquiredAndReleased = (await next.finish()).released; assert.ok(entry.reacquiredAndReleased);
    entry.pass = true;
  }
  summary.registryUnchanged = before.equals(await readFile(registry)); assert.ok(summary.registryUnchanged);
  summary.pass = true;
} catch (error) {
  summary.failureCode = 'RUNNER_CANCEL_SMOKE_FAILED'; // Never print raw provider errors/configuration.
  if (/^ACTIVE_CANCEL_[A-Z_]+$/u.test(error.code ?? '')) summary.validationCode = error.code;
} finally {
  if (witness) { witness.kill(); await witnessClosed; }
  if (root) {
    summary.evidenceRoot = root;
    await writeFile(join(root, 'smoke-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  }
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.pass ? 0 : 1;
}
