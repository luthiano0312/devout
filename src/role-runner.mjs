#!/usr/bin/env node
// Slice 1: a single disposable test role, not the official task workflow.
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquirePiLock } from './pi-lock.mjs';
import { windowsLaunchSpec } from './pi-driver.mjs';
import { engineeringInstructions, validateEngineeringWorkspace } from './engineering-workspace.mjs';
import { atomicWriteJson } from './operational-json.mjs';
import { controlTransaction, initializeControl, requestCancellation } from './run-control.mjs';
export { atomicWriteJson } from './operational-json.mjs';

const repository = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const requestLimit = 256 * 1024;
const textLimit = 64 * 1024;
const markerName = '.devout-disposable.json';
const timerKeys = ['commandTimeoutMs', 'settlementTimeoutMs', 'abortTimeoutMs',
  'normalWaitMs', 'forceWaitMs', 'forceCommandMs', 'pollMs'];
const driverKeys = [...timerKeys, 'maxRecordBytes', 'maxQueuedBytes', 'maxPending'];
const codes = new Set([
  'INVALID_REQUEST', 'PERSISTENCE_FAILED', 'MODEL_OR_STATE_INVALID', 'ASSISTANT_ERROR',
  'SETTLEMENT_ABORTED', 'RESPONSE_MISMATCH', 'TERMINATION_FAILED', 'RUNNER_FAILED',
  'CONTROL_INVALID', 'CONTROL_IO_FAILED', 'CONTROL_BUSY',
  'LOCK_BUSY', 'LOCK_RECONCILIATION_REQUIRED', 'LOCK_METADATA_INVALID', 'LOCK_READ_FAILED',
  'LOCK_OBSERVATION_FAILED', 'LOCK_OWNER_CHANGED', 'LOCK_PROCESS_UNCERTAIN',
  'LOCK_PROCESS_IDENTITY_MISSING', 'LOCK_LEASE_CLOSED', 'LOCK_OPERATION_PENDING',
  'SPAWN_ERROR', 'PROCESS_START_FAILED', 'STDIN_ERROR', 'STDOUT_ERROR', 'STDERR_ERROR',
  'PROCESS_EXIT', 'EARLY_EOF', 'EARLY_EXIT', 'TRUNCATED_RECORD', 'INVALID_JSON',
  'INVALID_RECORD', 'INVALID_RESPONSE', 'UNCORRELATED_RESPONSE', 'COMMAND_MISMATCH',
  'RECORD_LIMIT', 'COMMAND_TIMEOUT', 'SETTLED_TIMEOUT', 'RPC_ERROR', 'PROMPT_NOT_STARTED',
  'QUEUE_LIMIT', 'INPUT_CLOSED', 'CANCELLED', 'WORK_ACTIVE', 'PROCESS_OBSERVER_FAILED',
  'PROCESS_OBSERVATION_FAILED', 'ROOT_GONE_WITH_DESCENDANTS', 'PROCESS_SURVIVED',
  'NO_PROCESS_OBSERVER', 'INVALID_PROCESS_SNAPSHOT', 'PROCESS_OBSERVATION_LIMIT',
  'PROCESS_DESCENDANT_AMBIGUOUS', 'PROCESS_FOREIGN_DESCENDANT',
  'PROCESS_IDENTITY_CHANGED', 'PROCESS_INVENTORY_INVALID',
]);
const safeCode = error => codes.has(error?.code) ? error.code : 'RUNNER_FAILED';
const fail = code => { throw Object.assign(new Error(code), { code }); };
function object(value, allowed) {
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      Object.keys(value).some(key => !allowed.includes(key))) fail('INVALID_REQUEST');
}
function text(value, limit) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > limit || value.includes('\0')) {
    fail('INVALID_REQUEST');
  }
}
function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}
function localAbsolute(path) {
  text(path, 4096);
  if (!isAbsolute(path) || (process.platform === 'win32' &&
      (!/^[a-z]:\\/iu.test(path) || path.slice(2).includes(':')))) fail('INVALID_REQUEST');
}
// Resolve existing ancestors too: a junction must not hide a repository path.
function canonicalFuture(path) {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  if (parent === path) fail('INVALID_REQUEST');
  return join(canonicalFuture(parent), path.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
}
function inGitTree(path) {
  let current = path;
  while (true) {
    if (existsSync(join(current, '.git'))) return true;
    const parent = dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}
function jsonFile(path, maxBytes) {
  if (!statSync(path).isFile() || statSync(path).size > maxBytes) fail('INVALID_REQUEST');
  const bytes = readFileSync(path);
  if (bytes.length > maxBytes || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) fail('INVALID_REQUEST');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function disposableWorkspace(workspace, engineering) {
  if (engineering !== undefined) return validateEngineeringWorkspace(workspace, engineering);
  if (!statSync(workspace).isDirectory() || lstatSync(workspace).isSymbolicLink()) fail('INVALID_REQUEST');
  const actual = realpathSync(workspace), temp = realpathSync(tmpdir());
  if (!inside(temp, actual) || actual === temp || inside(repository, actual) || inGitTree(actual)) fail('INVALID_REQUEST');
  const marker = jsonFile(join(actual, markerName), 1024);
  object(marker, ['schemaVersion', 'disposable']);
  if (marker.schemaVersion !== 1 || marker.disposable !== true) fail('INVALID_REQUEST');
  // Small fictional workspaces only. No histories or links to external data.
  const pending = [actual];
  let count = 0;
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (++count > 1024 || ['.git', '.pi', '.openclaw'].includes(entry.name.toLowerCase())) fail('INVALID_REQUEST');
      const path = join(directory, entry.name), info = lstatSync(path);
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) fail('INVALID_REQUEST');
      if (info.isDirectory()) pending.push(path);
    }
  }
  return actual;
}

/** Strict local request. This is not a schema for model-generated commands. */
export function validateRequest(input) {
  try {
    object(input, ['schemaVersion', 'taskId', 'role', 'workspace', 'artifactsRoot',
      'piCmd', 'modelProfile', 'prompt', 'expectedText', 'driver', 'engineering']);
    const engineering = input.modelProfile === 'configured-engineering';
    if (engineering ? !input.engineering : input.engineering !== undefined) fail('INVALID_REQUEST');
    if (input.schemaVersion !== 1 || input.role !== 'test' ||
        !['configured-isolated', 'configured-engineering'].includes(input.modelProfile) ||
        typeof input.taskId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(input.taskId)) fail('INVALID_REQUEST');
    text(input.prompt, textLimit); text(input.expectedText, textLimit);
    for (const key of ['workspace', 'artifactsRoot', 'piCmd']) localAbsolute(input[key]);
    const workspace = disposableWorkspace(input.workspace, input.engineering);
    const artifactsRoot = canonicalFuture(resolve(input.artifactsRoot));
    if (inside(repository, artifactsRoot) || inside(workspace, artifactsRoot) ||
        inside(artifactsRoot, workspace) || inGitTree(artifactsRoot) || dirname(artifactsRoot) === artifactsRoot) fail('INVALID_REQUEST');
    if (existsSync(artifactsRoot) && !statSync(artifactsRoot).isDirectory()) fail('INVALID_REQUEST');
    const options = input.driver === undefined ? {} : input.driver;
    object(options, driverKeys);
    for (const [key, value] of Object.entries(options)) {
      const max = timerKeys.includes(key) ? 600_000 : key === 'maxPending' ? 32 : 8 * 1024 * 1024;
      if (!Number.isSafeInteger(value) || value < 1 || value > max) fail('INVALID_REQUEST');
    }
    // Validate the trusted launcher before acquiring or spawning anything.
    windowsLaunchSpec({ piCmd: input.piCmd, cwd: workspace,
      profile: engineering ? 'engineering' : 'isolated', engineering: input.engineering });
    return { ...input, workspace, artifactsRoot, driver: { ...options },
      ...(engineering ? { engineering: { ...input.engineering } } : {}) };
  } catch { fail('INVALID_REQUEST'); }
}
export function loadRequest(path) {
  try { localAbsolute(path); return validateRequest(jsonFile(path, requestLimit)); }
  catch { fail('INVALID_REQUEST'); }
}

/** acquire/notify are trusted test seams, never accepted from a request/CLI. */
export async function runRole(input, { acquire = acquirePiLock, notify = () => {} } = {}) {
  const config = validateRequest(input);
  const runId = `run-${randomUUID()}`;
  const runDir = join(config.artifactsRoot, 'runs', runId);
  // No Pi exists if this initial persistence fails.
  let eventsFd;
  try {
    mkdirSync(join(config.artifactsRoot, 'runs'), { recursive: true });
    if (realpathSync(config.artifactsRoot) !== config.artifactsRoot ||
        realpathSync(join(config.artifactsRoot, 'runs')) !== join(config.artifactsRoot, 'runs')) fail('PERSISTENCE_FAILED');
    mkdirSync(runDir); // unique, not an overwrite/resume of an earlier invocation
    eventsFd = openSync(join(runDir, 'events.jsonl'), 'wx', 0o600);
  } catch { fail('PERSISTENCE_FAILED'); }
  const errors = new Set();
  const observed = { stateCorrelated: false, modelAvailable: false, promptAccepted: false,
    settled: false, aborted: false, assistantError: false, markerMatched: false, responseStarted: false,
    eventCount: 0, diagnosticBytes: 0 };
  const harmlessTests = new Set();
  if (config.engineering) observed.engineering = { toolStarts: 0, toolEnds: 0,
    harmlessTestStarted: false, harmlessTestSucceeded: false };
  let lease, driver, termination = null, released = false, launchAttempted = false;
  let state = 'starting', sequence = 0, journalFailed = false, textSeen = '', finalMessageSeen = false;
  let cancelRequested = false, controlReady = false, watcher, polling = null;
  const startedAt = new Date().toISOString();
  const base = () => ({ schemaVersion: 1, runId, taskId: config.taskId, role: 'test', runnerPid: process.pid });
  function record(type, details = {}) {
    const event = { schemaVersion: 1, runId, seq: ++sequence, at: new Date().toISOString(), type, ...details };
    try {
      writeFileSync(eventsFd, JSON.stringify(event) + '\n'); fsyncSync(eventsFd);
      notify(event);
    } catch {
      journalFailed = true; errors.add('PERSISTENCE_FAILED');
      // EventEmitter callbacks must never throw into the Driver.
      if (driver) void driver.cancel().catch(() => {});
    }
  }
  function transition(next) {
    state = next;
    try { atomicWriteJson(join(runDir, 'state.json'), { ...base(), state, updatedAt: new Date().toISOString() }); }
    catch { journalFailed = true; errors.add('PERSISTENCE_FAILED'); }
    record('state', { state });
    if (journalFailed) fail('PERSISTENCE_FAILED');
  }
  function observeCancellation(control) {
    if (control.runnerPid !== process.pid) fail('CONTROL_INVALID');
    if (control.requestedAt !== null && !cancelRequested) {
      cancelRequested = true; errors.add('CANCELLED');
      record('cancel_observed');
      if (driver) void driver.cancel().catch(() => {});
    }
  }
  function phase(action) {
    return controlTransaction(runDir, runId, control => {
      observeCancellation(control);
      if (cancelRequested) fail('CANCELLED');
      if (control.status !== 'open') fail('CONTROL_INVALID');
      if (journalFailed || errors.size) fail('RUNNER_FAILED');
      // Phase intent and the controller's request share this short transaction.
      return action();
    });
  }
  try {
    initializeControl(runDir, runId); controlReady = true;
    watcher = setInterval(() => {
      if (polling) return;
      polling = controlTransaction(runDir, runId, observeCancellation).catch(error => {
        errors.add(safeCode(error));
        if (driver) void driver.cancel().catch(() => {});
      }).finally(() => { polling = null; });
    }, 100);
    transition('starting');
    lease = await phase(() => acquire({ runId }));
    record('lock_acquired');
    if (journalFailed) fail('PERSISTENCE_FAILED');
    // Revalidate immediately before launch; marker/paths are not a sandbox.
    disposableWorkspace(config.workspace, config.engineering);
    const { settlementTimeoutMs = 120_000, ...driverOptions } = config.driver;
    driver = await phase(() => {
      launchAttempted = true;
      return lease.launch({ piCmd: config.piCmd, cwd: config.workspace,
        profile: config.modelProfile === 'configured-engineering' ? 'engineering' : 'isolated',
        ...(config.engineering ? { engineering: config.engineering } : {}), ...driverOptions });
    });
    // A request during asynchronous bootstrap cannot be lost before binding.
    if (cancelRequested || errors.size) void driver.cancel().catch(() => {});
    driver.on('diagnostic', bytes => { observed.diagnosticBytes += bytes.length; });
    driver.on('failure', error => { errors.add(safeCode(error)); record('driver_failure', { code: safeCode(error) }); });
    driver.on('response', response => {
      if (response.command === 'prompt') {
        observed.promptAccepted = response.success === true && response.data?.disposition === 'started';
      }
    });
    driver.on('event', event => {
      observed.eventCount++;
      if (config.engineering && ['read', 'edit', 'write', 'bash'].includes(event.toolName)) {
        if (event.type === 'tool_execution_start') {
          observed.engineering.toolStarts++;
          if (event.toolName === 'bash' && event.args?.command === 'node --test' && typeof event.toolCallId === 'string') {
            harmlessTests.add(event.toolCallId); observed.engineering.harmlessTestStarted = true;
          }
        } else if (event.type === 'tool_execution_end') {
          observed.engineering.toolEnds++;
          if (harmlessTests.delete(event.toolCallId) && event.isError === false) observed.engineering.harmlessTestSucceeded = true;
        }
      }
      if (!observed.responseStarted && event.type === 'message_update' &&
          event.assistantMessageEvent?.type === 'text_delta') {
        observed.responseStarted = true;
        record('response_started'); // One payload-free streaming marker, not response text.
      }
      if (event.type === 'agent_settled') {
        observed.settled = true;
        observed.aborted = event.aborted === true;
      }
      if (event.type === 'message_end' && event.message?.role === 'assistant') {
        observed.assistantError ||= ['error', 'aborted'].includes(event.message.stopReason) || Boolean(event.message.errorMessage);
        finalMessageSeen = true;
        textSeen = '';
        if (Array.isArray(event.message.content)) {
          for (const part of event.message.content) {
            if (part?.type === 'text' && typeof part.text === 'string') {
              if (Buffer.byteLength(textSeen) + Buffer.byteLength(part.text) > textLimit) {
                finalMessageSeen = false; textSeen = ''; break;
              }
              textSeen += part.text;
            }
          }
        }
      }
      // Only closed, payload-free summaries. Unknown types/data are never logged.
      if (['agent_start', 'agent_settled'].includes(event.type) && observed.eventCount <= 512) {
        record('pi_event', { event: event.type });
      }
    });
    transition('running');
    const response = await phase(() => driver.getState());
    observed.stateCorrelated = response.success === true && response.command === 'get_state' && typeof response.id === 'string';
    observed.modelAvailable = typeof response.data?.model?.id === 'string' && response.data.model.id.length > 0;
    if (!observed.stateCorrelated || !observed.modelAvailable || response.data?.isStreaming !== false) fail('MODEL_OR_STATE_INVALID');
    record('state_observed', { modelAvailable: true });
    const prompt = config.engineering ? `${engineeringInstructions}\n\n${config.prompt}` : config.prompt;
    const result = await phase(() => driver.promptAndWait(prompt, { timeoutMs: settlementTimeoutMs }));
    observed.promptAccepted = result.response.success === true && result.response.data?.disposition === 'started';
    observed.settled = result.settled.type === 'agent_settled';
    observed.aborted = result.settled.aborted === true;
    observed.assistantError = result.assistantError;
    observed.markerMatched = finalMessageSeen && textSeen.trim() === config.expectedText;
    textSeen = '';
    record('prompt_observed', { accepted: observed.promptAccepted, settled: observed.settled,
      aborted: observed.aborted, assistantError: observed.assistantError, markerMatched: observed.markerMatched });
    if (observed.aborted) fail('SETTLEMENT_ABORTED');
    if (observed.assistantError) fail('ASSISTANT_ERROR');
    if (!observed.markerMatched) fail('RESPONSE_MISMATCH');
  } catch (error) {
    errors.add(safeCode(error)); record('failure', { code: safeCode(error) });
  } finally {
    textSeen = '';
    try { transition('stopping'); } catch { /* still terminate the owned Pi */ }
    if (controlReady) {
      try { await controlTransaction(runDir, runId, observeCancellation); }
      catch (error) { errors.add(safeCode(error)); }
    }
    if (lease) {
      try {
        const ended = await lease.finish({ cancel: errors.size > 0 });
        termination = ended.termination; released = ended.released === true;
      } catch (error) {
        errors.add(safeCode(error));
        // The bound Driver may have proved termination but persistence prevented
        // releasing the lease. Keep uncertainty blocking; never forge a receipt.
        termination = driver?.terminationResult ?? null;
      }
    }
    const gone = launchAttempted ? termination?.state === 'terminated' && termination.canRelease === true &&
      termination.processesGone === true && released : !lease || released;
    if (!gone) errors.add('TERMINATION_FAILED');
    if (termination?.failureCode) errors.add(safeCode({ code: termination.failureCode }));
    if (launchAttempted && errors.size === 0 &&
        (!termination?.workCompleted || termination.forced || termination.exitCode !== 0)) {
      errors.add('TERMINATION_FAILED');
    }
    clearInterval(watcher);
    await polling;
    if (controlReady) {
      try {
        await controlTransaction(runDir, runId, (control, save) => {
          observeCancellation(control);
          // Linearization point: later requests are too late (or blocked), not
          // accepted and silently lost between shutdown and result publication.
          control.status = 'closed'; control.finalState = gone ? 'terminated' : 'uncertain'; save();
          record('control_closed', { cancelRequested });
        });
      } catch (error) { errors.add(safeCode(error)); }
    }
    try { transition(gone ? 'terminated' : 'uncertain'); } catch { /* final result must not claim success */ }
    try { closeSync(eventsFd); } catch { errors.add('PERSISTENCE_FAILED'); }
  }
  const technicalOutcome = errors.size ? (observed.aborted || errors.has('CANCELLED') ? 'interrupted' : 'failed') : 'succeeded';
  const result = { ...base(), startedAt, finishedAt: new Date().toISOString(), state, technicalOutcome,
    taskApproved: false, observed, cancellation: { requested: cancelRequested },
    errorCodes: [...errors], lock: { acquired: Boolean(lease), released },
    termination: termination ? {
      state: termination.state, processesGone: termination.processesGone === true,
      canRelease: termination.canRelease === true, workCompleted: termination.workCompleted === true,
      cancelled: termination.cancelled === true, abortAccepted: termination.abortAccepted === true,
      forced: termination.forced === true, exitCode: termination.exitCode ?? null,
      taskkillExitCode: termination.taskkillExitCode ?? null,
      failureCode: termination.failureCode ? safeCode({ code: termination.failureCode }) : null,
      reason: termination.reason ? safeCode({ code: termination.reason }) : null,
      identity: termination.identity ? { pid: termination.identity.pid, created: termination.identity.created } : null,
      observed: (termination.observed ?? []).map(item => ({ pid: item.pid, created: item.created })),
    } : null };
  // No result is better than a partially written or false-success result.
  try { atomicWriteJson(join(runDir, 'result.json'), result); }
  catch { fail('PERSISTENCE_FAILED'); }
  return { runDir, result, exitCode: technicalOutcome === 'succeeded' ? 0 : 1 };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 5 && args[0] === 'cancel' && args[1] === '--artifacts-root' && args[3] === '--run-id') {
    try {
      const receipt = await requestCancellation({ artifactsRoot: args[2], runId: args[4] });
      process.stdout.write(JSON.stringify({ type: 'cancel_request', ...receipt }) + '\n');
      return receipt.status === 'blocked' ? 1 : 0;
    } catch (error) {
      process.stderr.write(JSON.stringify({ type: 'cancel_error', code: safeCode(error) }) + '\n');
      return error.code === 'INVALID_REQUEST' ? 2 : 1;
    }
  }
  // No shell forwarding, arbitrary flags, injected factories or RPC commands.
  if (args.length !== 3 || args[0] !== 'run' || args[1] !== '--config' || !args[2]) {
    process.stderr.write('{"type":"request_rejected","code":"INVALID_REQUEST"}\n');
    return 2;
  }
  try {
    const request = loadRequest(args[2]);
    const outcome = await runRole(request, { notify: event => process.stdout.write(JSON.stringify(event) + '\n') });
    process.stdout.write(JSON.stringify({ type: 'result', runId: outcome.result.runId,
      state: outcome.result.state, technicalOutcome: outcome.result.technicalOutcome, taskApproved: false }) + '\n');
    return outcome.exitCode;
  } catch (error) {
    process.stderr.write(JSON.stringify({ type: 'runner_error', code: safeCode(error) }) + '\n');
    return error.code === 'INVALID_REQUEST' ? 2 : 1;
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  // A lost observer pipe must not crash Node and orphan Pi. Disk evidence remains
  // authoritative; a broken pipe still makes this invocation fail for its caller.
  let outputFailed = false;
  process.stdout.on('error', () => { outputFailed = true; process.exitCode = 1; });
  process.stderr.on('error', () => { outputFailed = true; process.exitCode = 1; });
  const exitCode = await main();
  await Promise.all([process.stdout, process.stderr].map(stream =>
    new Promise(resolve => stream.write('', resolve))));
  // All owned termination attempts and synchronous evidence writes have finished.
  // An uncertain child may still hold pipes/IPC: do not become a resident Runner.
  // Exiting here does NOT prove Pi ended; its persistent lease stays blocking.
  process.exit(outputFailed ? 1 : exitCode);
}
