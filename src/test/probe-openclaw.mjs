// Opt-in support for OpenClaw's REAL exec/process tools. Never launches a Runner
// itself, changes OpenClaw config, restarts a Gateway, or updates official tasks.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectPiLock, acquirePiLock } from '../pi-lock.mjs';
import { validateRequest } from '../role-runner.mjs';
import { checkRunEvidence, checkScenarioOrder, checkOpenClawTrace } from './helpers/openclaw-evidence.mjs';
const exec = promisify(execFile);
const registry = fileURLToPath(new URL('../../docs_devout/03-execucao/registro.md', import.meta.url));
const runner = fileURLToPath(new URL('../role-runner.mjs', import.meta.url));
const kinds = ['cancel', 'duplicate', 'normal', 'mismatch'];
const taskId = kind => `M01-T06-PROBE-${kind.toUpperCase()}`;
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const fail = () => { throw new Error('OPENCLAW_PROBE_FAILED'); };
const require = value => { if (!value) fail(); };
const json = path => {
  const data = readFileSync(path); require(data.length <= 1024 * 1024);
  return JSON.parse(data.toString('utf8'));
};
function openRoot(path) {
  const root = realpathSync(resolve(path));
  require(dirname(root) === realpathSync(tmpdir()) && basename(root).startsWith('devout-openclaw-probe-'));
  require(json(join(root, 'probe.json')).schemaVersion === 1);
  return root;
}
function readCase(root, kind, pending = false) {
  require(kinds.includes(kind));
  const base = join(root, 'operacional', 'runs');
  const matches = readdirSync(base).filter(id => /^run-[0-9a-f-]{36}$/u.test(id)).map(id => join(base, id))
    .filter(dir => json(join(dir, 'state.json')).taskId === taskId(kind));
  require(matches.length === 1);
  const dir = matches[0];
  const eventsText = readFileSync(join(dir, 'events.jsonl'), 'utf8');
  require(Buffer.byteLength(eventsText) <= 8 * 1024 * 1024);
  // Only complete, flushed lines. A concurrent append may still be in progress.
  const events = eventsText.slice(0, eventsText.lastIndexOf('\n')).split('\n').filter(Boolean).map(JSON.parse);
  const state = json(join(dir, 'state.json')), control = json(join(dir, 'control.json'));
  return { state, control, events, result: pending && !existsSync(join(dir, 'result.json')) ? null : json(join(dir, 'result.json')) };
}
async function gone(result) {
  const ids = [...new Set([result.runnerPid, ...(result.termination?.observed ?? []).map(p => p.pid)])];
  require(ids.every(id => Number.isSafeInteger(id) && id > 0));
  const output = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$ids=@(${ids.join(',')}); @((Get-CimInstance Win32_Process -ErrorAction Stop) | Where-Object { $ids -contains [int]$_.ProcessId }).Count`],
  { timeout: 15000, windowsHide: true });
  require(output.stdout.trim() === '0');
}
async function check(root, kind) {
  const evidence = readCase(root, kind);
  const summary = checkRunEvidence(evidence, kind);
  require(summary.taskId === taskId(kind));
  await gone(evidence.result); // Missing/unknown native observation fails closed.
  require(hash(registry) === json(join(root, 'probe.json')).registryHash);
  if (kind !== 'duplicate') require((await inspectPiLock()).canAcquire === true);
  const output = { ...summary, runnerAndObservedPidsGone: true, registryUnchanged: true, pass: true };
  writeFileSync(join(root, `${kind}-summary.json`), JSON.stringify(output, null, 2) + '\n');
  return output;
}
try {
  require(process.platform === 'win32');
  const [command, path, kind, ...extra] = process.argv.slice(2);
  require(extra.length === 0);
  let output;
  if (command === 'prepare' && path === undefined) {
    require((await inspectPiLock()).canAcquire === true);
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'devout-openclaw-probe-'));
    const workspace = join(root, 'workspace'); mkdirSync(workspace);
    writeFileSync(join(workspace, '.devout-disposable.json'), '{"schemaVersion":1,"disposable":true}');
    for (const mode of kinds) {
      const request = { schemaVersion: 1, taskId: taskId(mode), role: 'test', workspace,
        artifactsRoot: join(root, 'operacional'),
        piCmd: process.env.DEVOUT_PI_CMD || join(process.env.USERPROFILE, '.pi', 'agent', 'bin', 'pi.cmd'),
        modelProfile: 'configured-isolated',
        prompt: mode === 'cancel' ? 'Teste descartável inofensivo de streaming. Escreva uma história original de pelo menos 10000 palavras sobre um robô jardineiro em um planeta fictício, em prosa contínua, sem resumir.' :
          'Teste técnico inofensivo. Responda somente PONG-DEVOUT-T06, sem pontuação ou explicações.',
        expectedText: mode === 'mismatch' ? 'MARCADOR-DIVERGENTE-T06' : 'PONG-DEVOUT-T06',
        driver: { settlementTimeoutMs: 180000 } };
      validateRequest(request);
      writeFileSync(join(root, `${mode}.json`), JSON.stringify(request, null, 2) + '\n');
    }
    writeFileSync(join(root, 'probe.json'), JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), registryHash: hash(registry) }));
    const probe = fileURLToPath(import.meta.url);
    const procedure = readFileSync(new URL('./openclaw-procedure.txt', import.meta.url), 'utf8')
      .replaceAll('{{ROOT}}', root).replaceAll('{{RUNNER}}', runner).replaceAll('{{PROBE}}', probe);
    const messageFile = join(root, 'openclaw-instructions.txt'); writeFileSync(messageFile, procedure);
    output = { root, runner, probe, messageFile, configs: Object.fromEntries(kinds.map(k => [k, join(root, `${k}.json`)])) };
  } else {
    require(typeof path === 'string'); const root = openRoot(path);
    if (command === 'active' && kind === undefined) {
      const before = readCase(root, 'cancel', true);
      require(before.result === null && before.state.state === 'running' && before.control.status === 'open');
      require(before.events.some(e => e.type === 'state_observed') && !before.events.some(e => e.type === 'pi_event' && e.event === 'agent_settled'));
      require((await inspectPiLock()).canAcquire === false);
      const after = readCase(root, 'cancel', true);
      require(after.result === null && !after.events.some(e => e.type === 'pi_event' && e.event === 'agent_settled'));
      output = { runId: after.state.runId, artifactsRoot: join(root, 'operacional'),
        piReadyObserved: true, streamingObserved: after.events.some(e => e.type === 'response_started'), nextPiAllowed: false };
    } else if (command === 'check' && kinds.includes(kind)) output = await check(root, kind);
    else if (command === 'trace' && kind === undefined) {
      const chunks = []; let bytes = 0;
      for await (const chunk of process.stdin) { bytes += chunk.length; require(bytes <= 8 * 1024 * 1024); chunks.push(chunk); }
      const cases = {}; for (const mode of kinds) cases[mode] = await check(root, mode);
      checkScenarioOrder(cases);
      output = { ...checkOpenClawTrace(JSON.parse(Buffer.concat(chunks).toString('utf8')), { runner, root, cases }), artifactChecksPassed: true };
      writeFileSync(join(root, 'gateway-trace.json'), JSON.stringify(output, null, 2) + '\n');
    } else if (command === 'summary' && kind === undefined) {
      const cases = {};
      for (const mode of kinds) cases[mode] = await check(root, mode);
      checkScenarioOrder(cases);
      const lease = await acquirePiLock({ runId: 'T06-probe-final-reacquisition' });
      require((await lease.finish()).released);
      output = { test: 'M01-T06 OpenClaw real procedure', at: new Date().toISOString(), cases, pass: true,
        reacquiredAndReleased: true, registryUnchanged: true, gatewayRestartTested: false, taskApproved: false };
      writeFileSync(join(root, 'summary.json'), JSON.stringify(output, null, 2) + '\n');
    } else fail();
  }
  console.log(JSON.stringify(output, null, 2));
} catch {
  // Raw exceptions may contain host config or payloads. No fallback/retry/cleanup.
  console.error('{"pass":false,"code":"OPENCLAW_PROBE_FAILED","nextPiAllowed":false}');
  process.exitCode = 1;
}
