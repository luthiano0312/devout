// Opt-in Windows smoke. Only a harmless marker; never print raw RPC or stderr.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startPi } from '../pi-driver.mjs';
const exec = promisify(execFile);
const marker = 'PONG-DEVOUT-T01';
const summary = {
  test: 'M01-T01 real Pi smoke', at: new Date().toISOString(),
  platform: process.platform, node: process.version,
  getStateCorrelated: false, promptAccepted: false, settled: false,
  stdinOpenAtSettled: false, markerMatched: false, assistantError: false,
  eventCounts: {}, diagnosticBytes: 0, dep0190: false,
  exitCode: null, forced: false, processesGone: false, pass: false,
};
let driver;
let workspace;
const identities = new Map();
let rawText = '';
let stderrWindow = '';
let failureCode;
const warning = item => { if (item.code === 'DEP0190') summary.dep0190 = true; };
process.on('warning', warning);

// Test-only process observations: no CommandLine, environment, tokens or files
// in the output. The product's robust termination policy belongs to T02.
async function processes(rootPid, pids = []) {
  const script = `
$ErrorActionPreference = 'Stop'
$all = @(Get-CimInstance Win32_Process)
$selected = @()
if ($env:DEVOUT_OBSERVE_IDS) {
  $ids = @($env:DEVOUT_OBSERVE_IDS.Split(',') | ForEach-Object { [int]$_ })
  $selected = @($all | Where-Object { $ids -contains [int]$_.ProcessId })
} else {
  $ids = @([int]$env:DEVOUT_OBSERVE_ROOT)
  do {
    $more = @($all | Where-Object { $ids -contains [int]$_.ParentProcessId -and $ids -notcontains [int]$_.ProcessId })
    $ids += @($more | ForEach-Object { [int]$_.ProcessId })
  } while ($more.Count -gt 0)
  $selected = @($all | Where-Object { $ids -contains [int]$_.ProcessId })
}
@($selected | ForEach-Object {
  [pscustomobject]@{ pid = [int]$_.ProcessId; parent = [int]$_.ParentProcessId; created = $_.CreationDate.ToUniversalTime().ToString('o') }
}) | ConvertTo-Json -Compress
`;
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true, timeout: 15_000,
    env: { ...process.env, DEVOUT_OBSERVE_ROOT: String(rootPid), DEVOUT_OBSERVE_IDS: pids.join(',') },
  });
  const parsed = stdout.trim() ? JSON.parse(stdout) : [];
  return Array.isArray(parsed) ? parsed : [parsed];
}
async function observeTree() {
  if (!driver?.child.pid) return;
  for (const item of await processes(driver.child.pid)) identities.set(item.pid, item);
}
async function waitClosed(ms) {
  let timer;
  try {
    return await Promise.race([driver.closed, new Promise(resolve => { timer = setTimeout(() => resolve(null), ms); })]);
  } finally { clearTimeout(timer); }
}
async function cleanup() {
  let observationFailed = false;
  try { await observeTree(); }
  catch { observationFailed = true; }
  // Even an unavailable process inventory must not prevent orderly EOF.
  driver.closeInput();
  let closed = await waitClosed(10_000);
  if (!closed && driver.child.pid) {
    const root = identities.get(driver.child.pid);
    const live = await processes(driver.child.pid, [driver.child.pid]);
    if (!root || !live.some(p => p.pid === root.pid && p.created === root.created)) {
      throw Object.assign(new Error(), { code: 'UNCERTAIN_PROCESS_IDENTITY' });
    }
    summary.forced = true;
    await exec('taskkill.exe', ['/PID', String(root.pid), '/T', '/F'], { windowsHide: true, timeout: 10_000 });
    closed = await waitClosed(5000);
  }
  if (!closed) throw Object.assign(new Error(), { code: 'CHILD_NOT_REAPED' });
  summary.exitCode = closed.exitCode;
  if (observationFailed) throw Object.assign(new Error(), { code: 'PROCESS_INVENTORY_UNAVAILABLE' });
  const remaining = identities.size ? await processes(driver.child.pid, [...identities.keys()]) : [];
  summary.processesGone = remaining.every(p => p.created !== identities.get(p.pid)?.created);
  if (!summary.processesGone) throw Object.assign(new Error(), { code: 'OBSERVED_PROCESS_SURVIVED' });
  if (closed.failure) throw closed.failure;
  assert.equal(summary.exitCode, 0);
  assert.equal(summary.forced, false);
}

try {
  assert.equal(process.platform, 'win32');
  workspace = await mkdtemp(join(tmpdir(), 'devout-smoke-'));
  const piCmd = process.env.DEVOUT_PI_CMD || join(process.env.USERPROFILE, '.pi', 'agent', 'bin', 'pi.cmd');
  driver = startPi({ piCmd, cwd: workspace, profile: 'isolated' });
  driver.on('diagnostic', bytes => {
    summary.diagnosticBytes += bytes.length;
    // Only retain enough to detect this particular warning across byte chunks.
    stderrWindow = (stderrWindow + bytes.toString('utf8')).slice(-512);
    if (stderrWindow.includes('DEP0190')) summary.dep0190 = true;
  });
  driver.on('event', event => {
    summary.eventCounts[event.type] = (summary.eventCounts[event.type] || 0) + 1;
    if (event.type === 'message_end' && event.message?.role === 'assistant') {
      rawText = (event.message.content || []).filter(x => x.type === 'text').map(x => x.text).join('');
    }
    if (event.type === 'agent_settled') summary.stdinOpenAtSettled = !driver.child.stdin.writableEnded;
  });
  await driver.ready;
  const state = await driver.getState();
  summary.getStateCorrelated = typeof state.id === 'string' && state.command === 'get_state' && state.success === true;
  await observeTree();
  assert.ok(identities.has(driver.child.pid), 'Launcher identity must be observed');
  summary.observedProcessCount = identities.size;
  const run = await driver.promptAndWait(`Teste técnico inofensivo. Responda somente ${marker}, sem pontuação ou explicações.`);
  summary.promptAccepted = run.response.success === true && run.response.data?.disposition === 'started';
  summary.settled = run.settled.type === 'agent_settled' && run.settled.aborted === false;
  summary.assistantError = run.assistantError;
  summary.markerMatched = rawText.trim() === marker;
  assert.ok(summary.getStateCorrelated && summary.promptAccepted && summary.settled && summary.stdinOpenAtSettled);
  assert.ok(summary.markerMatched && !summary.assistantError && !summary.dep0190);
} catch (error) {
  failureCode = error.code || 'SMOKE_ASSERTION_OR_ENVIRONMENT';
} finally {
  if (driver) {
    try { await cleanup(); }
    catch (error) { failureCode = error.code || 'CLEANUP_FAILED'; }
  }
  // Do not remove a workspace while an owned process may still be using it.
  if (workspace && (!driver || summary.processesGone)) await rm(workspace, { recursive: true, force: true });
  rawText = '';
  stderrWindow = '';
  process.off('warning', warning);
  summary.pass = !failureCode && summary.processesGone;
  if (failureCode) summary.failureCode = failureCode;
  if (!summary.processesGone && driver?.child.pid) {
    summary.reconciliationRequired = { launcherPid: driver.child.pid, workspace, observed: [...identities.values()] };
  }
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.pass ? 0 : 1;
}
