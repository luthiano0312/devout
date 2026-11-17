// Opt-in real Pi abort in a secret-free disposable workspace. No raw RPC logs.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startPi } from '../pi-driver.mjs';
const exec = promisify(execFile);
const summary = { test: 'M01-T02 real Pi abort', at: new Date().toISOString(),
  platform: process.platform, node: process.version, pass: false };
let driver, workspace, failureCode, termination;
let started = false, settled = false;
try {
  assert.equal(process.platform, 'win32');
  workspace = await mkdtemp(join(tmpdir(), 'devout-abort-'));
  const piCmd = process.env.DEVOUT_PI_CMD || join(process.env.USERPROFILE, '.pi', 'agent', 'bin', 'pi.cmd');
  driver = startPi({ piCmd, cwd: workspace, profile: 'isolated' });
  driver.on('event', event => {
    if (event.type === 'agent_start') started = true;
    if (event.type === 'agent_settled') settled = true;
  });
  await driver.ready;
  assert.equal((await driver.getState()).success, true);
  const response = await driver.prompt('Teste técnico descartável de cancelamento. Liste os números de 1 até 10000, um por linha.');
  summary.promptAccepted = response.data?.disposition === 'started';
  // Wait only for the local activity event, not for model completion.
  for (let i = 0; i < 500 && !started && !driver.failure; i++) await new Promise(resolve => setTimeout(resolve, 10));
  summary.activeAtCancel = started && !settled;
  assert.ok(summary.promptAccepted && summary.activeAtCancel);
  termination = await driver.cancel();
  summary.abortAccepted = termination.abortAccepted;
  summary.settledObserved = settled;
  assert.ok(termination.abortAccepted && termination.canRelease && !termination.forced);
  assert.equal(termination.workCompleted, false);
} catch (error) {
  failureCode = error.code || 'SMOKE_ASSERTION_OR_ENVIRONMENT';
} finally {
  if (driver) {
    try {
      termination ??= await driver.cancel();
      summary.state = termination.state;
      summary.forced = termination.forced;
      summary.canRelease = termination.canRelease;
      summary.exitCode = termination.exitCode;
      summary.failureCode = termination.failureCode;
      summary.rootIdentity = { pid: termination.identity?.pid, created: termination.identity?.created };
      summary.observed = termination.observed;
      if (!termination.canRelease) throw Object.assign(new Error(), { code: termination.reason || 'UNCERTAIN_TREE' });
      const ids = [...new Set(termination.observed.map(item => item.pid))];
      assert.ok(ids.length);
      const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `$ids=@(${ids.join(',')}); @((Get-CimInstance Win32_Process) | Where-Object { $ids -contains [int]$_.ProcessId }).Count`],
      { timeout: 15_000, windowsHide: true });
      summary.independentRemainingPids = Number(stdout.trim());
      assert.equal(summary.independentRemainingPids, 0);
    } catch (error) { failureCode = error.code || 'CLEANUP_OR_INSPECTION_FAILED'; }
  }
  if (workspace && (!driver || termination?.canRelease)) await rm(workspace, { recursive: true, force: true });
  if (failureCode) summary.errorCode = failureCode;
  if (driver && !termination?.canRelease) summary.reconciliationRequired = { rootPid: driver.child.pid, workspace };
  summary.pass = !failureCode && termination?.canRelease === true;
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.pass ? 0 : 1;
}
