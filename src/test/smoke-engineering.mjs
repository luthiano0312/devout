// Opt-in Windows acceptance: one real Pi, actual edit/test, same global lease as M01.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquirePiLock, inspectPiLock } from '../pi-lock.mjs';
import { engineeringEnvironment } from '../engineering-workspace.mjs';
import { prepareEngineeringFixture } from './helpers/engineering-fixture.mjs';

const runner = fileURLToPath(new URL('../role-runner.mjs', import.meta.url));
const registry = fileURLToPath(new URL('../../docs_devout/03-execucao/registro.md', import.meta.url));
const summary = { test: 'M02-T01 real engineering CLI / Pi', at: new Date().toISOString(),
  platform: process.platform, node: process.version, pass: false };
let fixture;
try {
  assert.equal(process.platform, 'win32');
  assert.equal((await inspectPiLock()).canAcquire, true, 'Reconcile exclusivity before smoke');
  fixture = prepareEngineeringFixture({ expected: 2 });
  const { root, workspace, engineering, git } = fixture;
  summary.baseline = engineering.baseline;
  const artifactsRoot = join(root, 'operacional'), configPath = join(root, 'request.json');
  writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, taskId: 'M02-T01-SMOKE', role: 'test',
    workspace, artifactsRoot, engineering, modelProfile: 'configured-engineering',
    piCmd: process.env.DEVOUT_PI_CMD || join(process.env.USERPROFILE, '.pi', 'agent', 'bin', 'pi.cmd'),
    prompt: 'Harmless fictional smoke. Read value.mjs and test/fixture.test.mjs using read. ' +
      'Use edit to change only value.mjs from export const value = 1; to export const value = 2; ' +
      'Then call the bash tool with command exactly node --test (no cd or extra shell syntax), ' +
      'and verify the local test passes. Do not modify any other file. Do not use Git or external files. ' +
      'If and only if the test passes, respond with exactly PONG-DEVOUT-M02-T01 and nothing else.',
    expectedText: 'PONG-DEVOUT-M02-T01', driver: { settlementTimeoutMs: 180_000 } }));
  const before = readFileSync(registry);
  const child = spawn(process.execPath, [runner, 'run', '--config', configPath], {
    shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', resolve);
  });
  summary.runnerPid = child.pid; summary.runnerExitCode = exitCode; summary.runnerClosed = child.exitCode === exitCode;
  const ids = readdirSync(join(artifactsRoot, 'runs')); assert.equal(ids.length, 1);
  const runId = ids[0], runDir = join(artifactsRoot, 'runs', runId); summary.runId = runId;
  const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8'));
  summary.state = result.state; summary.technicalOutcome = result.technicalOutcome;
  summary.observed = result.observed; summary.termination = result.termination;
  summary.lockReleased = result.lock.released; summary.taskApproved = result.taskApproved;
  summary.registryUnchanged = before.equals(readFileSync(registry));
  assert.equal(exitCode, 0); assert.equal(result.state, 'terminated');
  assert.equal(result.technicalOutcome, 'succeeded'); assert.equal(result.taskApproved, false);
  assert.ok(result.termination.processesGone && !result.termination.forced && result.lock.released);
  assert.ok(result.observed.engineering.harmlessTestStarted && result.observed.engineering.harmlessTestSucceeded);
  assert.ok(summary.registryUnchanged); assert.equal(stderr, '');
  const events = readFileSync(join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(stdout.trim().split('\n').slice(0, -1).map(line => JSON.parse(line)), events);
  assert.equal(readFileSync(join(workspace, 'value.mjs'), 'utf8'), 'export const value = 2;\n');
  summary.headUnchanged = git(['rev-parse', 'HEAD']) === engineering.baseline;
  summary.branchUnchanged = git(['symbolic-ref', '--short', 'HEAD']) === engineering.branch;
  summary.noRemotes = git(['remote']) === '';
  summary.changedFiles = git(['diff', '--name-only']).split('\n');
  assert.ok(summary.headUnchanged && summary.branchUnchanged && summary.noRemotes);
  assert.deepEqual(summary.changedFiles, ['value.mjs']); assert.equal(git(['diff', '--cached', '--name-only']), '');
  assert.equal(git(['ls-files', '--others', '--exclude-standard']), '');
  writeFileSync(join(root, 'fictional-diff.txt'), git(['diff', '--', 'value.mjs']) + '\n');
  // Independent test reproduction, not just the model's response/tool receipt.
  execFileSync(process.execPath, ['--test'], { cwd: workspace, env: engineeringEnvironment(),
    shell: false, windowsHide: true, timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] });
  summary.independentTestPassed = true;
  const pids = [...new Set([child.pid, ...result.termination.observed.map(item => item.pid)])];
  const check = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$ids=@(${pids.join(',')}); @((Get-CimInstance Win32_Process) | Where-Object { $ids -contains [int]$_.ProcessId }).Count`],
  { timeout: 15_000, windowsHide: true, encoding: 'utf8' });
  summary.independentlyGone = Number(check.trim()) === 0; assert.ok(summary.independentlyGone);
  assert.equal((await inspectPiLock()).canAcquire, true);
  const next = await acquirePiLock({ runId: 'M02-T01-real-prove-reacquisition' });
  summary.reacquiredAndReleased = (await next.finish()).released; assert.ok(summary.reacquiredAndReleased);
  summary.pass = true;
} catch {
  summary.failureCode = 'ENGINEERING_SMOKE_FAILED'; // Never print raw provider/config exceptions.
} finally {
  if (fixture) {
    summary.evidenceRoot = fixture.root;
    writeFileSync(join(fixture.root, 'smoke-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  }
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.pass ? 0 : 1;
}
