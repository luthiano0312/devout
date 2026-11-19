// Opt-in Windows: one real Pi implements/tests a fictional task and writes its report.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquirePiLock, inspectPiLock } from '../pi-lock.mjs';
import { engineeringEnvironment } from '../engineering-workspace.mjs';
import { taskGitRefsHash } from '../task-input.mjs';
import { prepareImplementationFixture } from './helpers/implementation-fixture.mjs';

const registry = fileURLToPath(new URL('../../docs_devout/03-execucao/registro.md', import.meta.url));
const summary = { test: 'M02-T03 real implementador CLI / Pi', at: new Date().toISOString(),
  platform: process.platform, node: process.version, pass: false };
let fixture;
try {
  assert.equal(process.platform, 'win32');
  assert.equal((await inspectPiLock()).canAcquire, true, 'Reconcile workflow exclusivity before smoke');
  fixture = prepareImplementationFixture({ after: () => {} }); // Preserve evidence outside repository.
  const f = fixture, config = { ...f.config,
    piCmd: process.env.DEVOUT_PI_CMD || join(process.env.USERPROFILE, '.pi', 'agent', 'bin', 'pi.cmd'),
    driver: { commandTimeoutMs: 10_000, settlementTimeoutMs: 180_000, normalWaitMs: 10_000 } };
  const requestPath = join(f.root, 'request.json'), approvalPath = join(f.root, 'approval.json');
  writeFileSync(requestPath, JSON.stringify(config)); writeFileSync(approvalPath, JSON.stringify(f.approval));
  const officialBefore = readFileSync(registry), fixtureBefore = readFileSync(join(f.workspace, 'docs/registro.md'));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../role-runner.mjs', import.meta.url)),
    'run', '--config', requestPath, '--approval', approvalPath], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
  summary.runnerPid = child.pid;
  summary.runnerExitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  const ids = readdirSync(join(config.artifactsRoot, 'runs')); assert.equal(ids.length, 1);
  const runDir = join(config.artifactsRoot, 'runs', ids[0]);
  const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8'));
  summary.runId = result.runId; summary.technicalOutcome = result.technicalOutcome;
  summary.roleOutcome = result.roleOutcome; summary.taskApproved = result.taskApproved;
  summary.delivery = result.delivery; summary.errorCodes = result.errorCodes;
  summary.termination = result.termination; summary.lockReleased = result.lock.released;
  assert.equal(summary.runnerExitCode, 0); assert.equal(stderr, '');
  assert.equal(result.role, 'implementador'); assert.equal(result.roleOutcome, 'completed');
  assert.equal(result.technicalOutcome, 'succeeded'); assert.equal(result.taskApproved, false);
  assert.ok(result.delivery.accepted && result.lock.released && result.termination.processesGone && !result.termination.forced);
  const events = readFileSync(join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(stdout.trim().split('\n').slice(0, -1).map(line => JSON.parse(line)), events);
  summary.registryUnchanged = officialBefore.equals(readFileSync(registry)) && fixtureBefore.equals(readFileSync(join(f.workspace, 'docs/registro.md')));
  summary.headAndRefsUnchanged = f.git(['rev-parse', 'HEAD']) === f.engineering.baseline && taskGitRefsHash(f.workspace) === f.approval.refsHash;
  summary.branchUnchanged = f.git(['symbolic-ref', '--short', 'HEAD']) === f.engineering.branch;
  assert.ok(summary.registryUnchanged && summary.headAndRefsUnchanged && summary.branchUnchanged);
  assert.equal(f.git(['diff', '--cached', '--name-only']), '');
  assert.deepEqual(result.delivery.changedFiles, [config.reportPath, 'value.mjs']);
  assert.equal(readFileSync(join(f.workspace, 'value.mjs'), 'utf8'), 'export const value = 2;\n');
  execFileSync(process.execPath, ['--test'], { cwd: f.workspace, shell: false, windowsHide: true, timeout: 15_000,
    env: engineeringEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
  summary.independentTestPassed = true;
  writeFileSync(join(f.root, 'fictional-diff.txt'), f.git(['diff', '--', 'value.mjs']) + '\n');
  const pids = [...new Set([child.pid, ...result.termination.observed.map(item => item.pid)])];
  const cim = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$ids=@(${pids.join(',')}); @((Get-CimInstance Win32_Process) | Where-Object { $ids -contains [int]$_.ProcessId }).Count`],
  { windowsHide: true, timeout: 15_000, encoding: 'utf8' });
  summary.independentlyGone = Number(cim.trim()) === 0; assert.ok(summary.independentlyGone);
  assert.equal((await inspectPiLock()).canAcquire, true);
  const next = await acquirePiLock({ runId: 'M02-T03-prove-reacquisition' });
  summary.reacquiredAndReleased = (await next.finish()).released; assert.ok(summary.reacquiredAndReleased);
  summary.pass = true;
} catch {
  summary.failureCode = 'IMPLEMENTER_SMOKE_FAILED'; // Never print raw provider/config exceptions.
} finally {
  if (fixture) {
    summary.evidenceRoot = fixture.root;
    writeFileSync(join(fixture.root, 'smoke-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  }
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.pass ? 0 : 1;
}
