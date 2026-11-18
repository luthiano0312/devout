// One small, local mailbox per immutable run directory. Never signal by PID.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { atomicWriteJson } from './operational-json.mjs';

const repository = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const runPattern = /^run-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const fail = code => { throw Object.assign(new Error(code), { code }); };

export function cancellationDirectory({ artifactsRoot, runId } = {}) {
  try {
    if (typeof runId !== 'string' || !runPattern.test(runId) || typeof artifactsRoot !== 'string' ||
        !isAbsolute(artifactsRoot) || (process.platform === 'win32' &&
        (!/^[a-z]:\\/iu.test(artifactsRoot) || artifactsRoot.slice(2).includes(':')))) fail('INVALID_REQUEST');
    const root = realpathSync(resolve(artifactsRoot));
    const rel = relative(repository, root);
    if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)) || dirname(root) === root) fail('INVALID_REQUEST');
    for (let dir = root; ; dir = dirname(dir)) {
      if (existsSync(join(dir, '.git'))) fail('INVALID_REQUEST');
      if (dirname(dir) === dir) break;
    }
    const runs = join(root, 'runs'), directory = join(runs, runId);
    for (const path of [runs, directory]) {
      if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink() || realpathSync(path) !== path) fail('INVALID_REQUEST');
    }
    return directory;
  } catch { fail('INVALID_REQUEST'); }
}

export function initializeControl(directory, runId) {
  // Called once in a freshly mkdir'ed run directory, before exposing runId.
  atomicWriteJson(join(directory, 'control.json'), { schemaVersion: 1, runId,
    runnerPid: process.pid, status: 'open', requestedAt: null, finalState: null });
}
function readControl(directory, runId) {
  try {
    const path = join(directory, 'control.json'), info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) fail('CONTROL_INVALID');
    const data = readFileSync(path);
    if (data.length > 4096) fail('CONTROL_INVALID');
    const record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
    if (!record || Object.keys(record).sort().join(',') !== 'finalState,requestedAt,runId,runnerPid,schemaVersion,status' ||
        record.schemaVersion !== 1 || record.runId !== runId || !runPattern.test(runId) ||
        !Number.isSafeInteger(record.runnerPid) || record.runnerPid < 1 ||
        !['open', 'requested', 'closed'].includes(record.status) ||
        !(record.requestedAt === null || typeof record.requestedAt === 'string' &&
          /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(record.requestedAt)) ||
        (record.status === 'open' && record.requestedAt !== null) ||
        (record.status === 'requested' && record.requestedAt === null) ||
        (record.status === 'closed' ? !['terminated', 'uncertain'].includes(record.finalState) : record.finalState !== null)) fail('CONTROL_INVALID');
    return record;
  } catch { fail('CONTROL_INVALID'); }
}

/** Short synchronous transaction, across processes. Never await while owning it.
 * No stale-guard reclamation: a crashed holder leaves control fail-closed.
 * Acquisition retries are bounded; no Pi or OS signal is created here.
 */
export async function controlTransaction(directory, runId, operation) {
  const guard = join(directory, 'control.guard');
  const deadline = performance.now() + 2000;
  while (true) {
    try { mkdirSync(guard); break; }
    catch (error) {
      if (error.code !== 'EEXIST') fail('CONTROL_IO_FAILED');
      if (performance.now() >= deadline) fail('CONTROL_BUSY');
      await delay(25);
    }
  }
  try {
    const record = readControl(directory, runId);
    // Return/adopt the operation's promise only AFTER finally releases the guard.
    return operation(record, () => {
      try { atomicWriteJson(join(directory, 'control.json'), record); }
      catch { fail('CONTROL_IO_FAILED'); }
    });
  } finally { rmdirSync(guard); }
}

/** Receipt is a request, NEVER proof of abort, death, release or task completion. */
export async function requestCancellation(target) {
  const directory = cancellationDirectory(target);
  return controlTransaction(directory, target.runId, (record, save) => {
    let status;
    if (record.status === 'closed') status = record.finalState === 'uncertain' ? 'blocked' : 'too_late';
    else if (record.status === 'requested') status = 'already_requested';
    else {
      record.status = 'requested'; record.requestedAt = new Date().toISOString(); save();
      status = 'requested';
    }
    return { schemaVersion: 1, runId: target.runId, status };
  });
}
