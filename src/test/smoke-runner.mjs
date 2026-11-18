// Opt-in, actual CLI -> global lock -> real Pi. Harmless test role only.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquirePiLock, inspectPiLock } from '../pi-lock.mjs';
const exec = promisify(execFile);
const runner = fileURLToPath(new URL('../role-runner.mjs', import.meta.url));
const registry = fileURLToPath(new URL('../../docs_devout/03-execucao/registro.md', import.meta.url));
const summary = { test: 'M01-T04 real CLI / Pi', at: new Date().toISOString(),
  platform: process.platform, node: process.version, pass: false };
let root;
try {
  assert.equal(process.platform, 'win32');
  assert.equal((await inspectPiLock()).canAcquire, true, 'Reconcile global workflow exclusivity first');
  root = await mkdtemp(join(tmpdir(), 'devout-runner-smoke-'));
  const workspace = join(root, 'workspace'), artifactsRoot = join(root, 'operacional');
  await mkdir(workspace);
  await writeFile(join(workspace, '.devout-disposable.json'), JSON.stringify({ schemaVersion: 1, disposable: true }));
  const configPath = join(root, 'request.json');
  await writeFile(configPath, JSON.stringify({ schemaVersion: 1, taskId: 'M01-T04-SMOKE', role: 'test',
    workspace, artifactsRoot, piCmd: process.env.DEVOUT_PI_CMD || join(process.env.USERPROFILE, '.pi', 'agent', 'bin', 'pi.cmd'),
    modelProfile: 'configured-isolated',
    prompt: 'Teste técnico inofensivo. Responda somente PONG-DEVOUT-T04, sem pontuação ou explicações.',
    expectedText: 'PONG-DEVOUT-T04' }));
  const before = await readFile(registry);
  const child = spawn(process.execPath, [runner, 'run', '--config', configPath], {
    windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; });
  child.stderr.on('data', bytes => { stderr += bytes; });
  const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  summary.runnerPid = child.pid;
  summary.runnerExitCode = exitCode;
  summary.runnerClosed = child.exitCode === exitCode;
  const ids = await readdir(join(artifactsRoot, 'runs'));
  assert.equal(ids.length, 1);
  const runId = ids[0]; summary.runId = runId;
  const runDir = join(artifactsRoot, 'runs', runId);
  const result = JSON.parse(await readFile(join(runDir, 'result.json'), 'utf8'));
  const state = JSON.parse(await readFile(join(runDir, 'state.json'), 'utf8'));
  const events = (await readFile(join(runDir, 'events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  summary.state = result.state; summary.technicalOutcome = result.technicalOutcome;
  summary.taskApproved = result.taskApproved;
  summary.observed = result.observed;
  summary.lockReleased = result.lock.released;
  summary.termination = result.termination;
  summary.eventCount = events.length;
  summary.stdoutMatchesEvents = JSON.stringify(stdout.trim().split('\n').slice(0, -1).map(line => JSON.parse(line))) === JSON.stringify(events);
  summary.stderrEmpty = stderr.length === 0;
  summary.registryUnchanged = before.equals(await readFile(registry));
  assert.equal(exitCode, 0);
  assert.equal(state.state, 'terminated');
  assert.equal(result.technicalOutcome, 'succeeded');
  assert.equal(result.taskApproved, false);
  assert.ok(result.observed.promptAccepted && result.observed.settled && result.observed.markerMatched);
  assert.ok(result.termination.processesGone && !result.termination.forced && result.lock.released);
  assert.ok(summary.registryUnchanged && summary.stdoutMatchesEvents && summary.stderrEmpty);
  // CIM cross-check: both the Runner and all observed disposable PIDs are gone.
  const pids = [...new Set([child.pid, ...result.termination.observed.map(item => item.pid)])];
  const script = `$ids=@(${pids.join(',')}); @((Get-CimInstance Win32_Process) | Where-Object { $ids -contains [int]$_.ProcessId }).Count`;
  const check = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15_000, windowsHide: true });
  summary.independentlyGone = Number(check.stdout.trim()) === 0;
  assert.ok(summary.independentlyGone);
  assert.equal((await inspectPiLock()).canAcquire, true);
  const next = await acquirePiLock({ runId: 'T04-real-smoke-prove-reacquisition' });
  summary.reacquiredAndReleased = (await next.finish()).released;
  assert.ok(summary.reacquiredAndReleased);
  summary.pass = true;
} catch {
  // Raw exceptions can contain local configs/provider output: never print them.
  summary.failureCode = 'RUNNER_SMOKE_FAILED';
} finally {
  // Preserve this small sanitized run as operational evidence outside Git.
  if (root) {
    summary.evidenceRoot = root;
    await writeFile(join(root, 'smoke-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  }
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.pass ? 0 : 1;
}
