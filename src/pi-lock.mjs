import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startPi } from './pi-driver.mjs';
import { openWindowsLockGuard } from './windows-lock-guard.mjs';

export class PiLockError extends Error {
  constructor(code) { super(code); this.name = 'PiLockError'; this.code = code; }
}
const error = code => new PiLockError(code);
export const defaultPiLockRoot = () => join(process.env.LOCALAPPDATA || homedir(), 'devout', 'pi-exclusivity');
const identityValid = value => Number.isSafeInteger(value?.pid) && value.pid > 0 &&
  typeof value.created === 'string' && /^\d+$/u.test(value.created) && typeof value.image === 'string' && value.image.length > 0;
const identityEqual = (a, b) => identityValid(a) && identityValid(b) && a.pid === b.pid &&
  a.created === b.created && a.image.toLowerCase() === b.image.toLowerCase();
const bootValid = value => typeof value?.id === 'string' && value.id.length > 0 &&
  typeof value.machine === 'string' && value.machine.length > 0;
const phases = ['acquired', 'launching', 'running', 'uncertain', 'terminated'];
function valid(record) {
  return record?.schema === 1 && typeof record.token === 'string' && /^[a-f0-9-]{36}$/u.test(record.token) &&
    typeof record.runId === 'string' && record.runId.length > 0 && identityValid(record.owner) &&
    bootValid(record.boot) && phases.includes(record.phase) &&
    (record.process === null || identityValid(record.process)) &&
    (record.phase !== 'running' || identityValid(record.process));
}
const terminationValid = (result, identity) => identityEqual(result?.identity, identity) &&
  result.state === 'terminated' && result.canRelease === true && result.processesGone === true;

async function readRecord(root) {
  try {
    const text = await readFile(join(root, 'lease.json'), 'utf8');
    if (text.length > 256 * 1024) throw error('LOCK_METADATA_INVALID');
    const record = JSON.parse(text);
    if (!valid(record)) throw error('LOCK_METADATA_INVALID');
    return record;
  } catch (cause) {
    if (cause.code === 'ENOENT') return null;
    throw error(cause instanceof SyntaxError ? 'LOCK_METADATA_INVALID' : cause.code || 'LOCK_READ_FAILED');
  }
}
async function writeDurable(path, record) {
  const file = await open(path, 'wx');
  try { await file.writeFile(JSON.stringify(record) + '\n'); await file.sync(); }
  finally { await file.close(); }
}
async function replaceRecord(root, record) {
  const temporary = join(root, `lease-${randomUUID()}.tmp`);
  await writeDurable(temporary, record);
  await rename(temporary, join(root, 'lease.json'));
}
async function archive(root, record) {
  // Preserve the old lease and its proof, never blindly delete an abandoned one.
  await rename(join(root, 'lease.json'), join(root, `retired-${record.token}.json`));
}
async function enter(root, { openGuard = openWindowsLockGuard } = {}) {
  if (typeof root !== 'string' || !isAbsolute(root)) throw new TypeError('Lock root must be absolute');
  await mkdir(root, { recursive: true });
  const guard = await openGuard(join(root, 'guard'));
  if (!identityValid(guard.owner) || !bootValid(guard.boot)) {
    await guard.close(); throw error('LOCK_OBSERVATION_FAILED');
  }
  return guard;
}

/** One global root per Windows account/orchestrator, NEVER per run/workspace. */
export async function acquirePiLock({ runId, root = defaultPiLockRoot() }, dependencies) {
  if (typeof runId !== 'string' || !runId.trim() || runId.length > 256) throw new TypeError('runId required (1..256 characters)');
  const guard = await enter(root, dependencies);
  try {
    if (await readRecord(root)) throw error('LOCK_RECONCILIATION_REQUIRED');
    const record = { schema: 1, token: randomUUID(), runId, owner: guard.owner, boot: guard.boot,
      phase: 'acquired', process: null, acquiredAt: new Date().toISOString() };
    await writeDurable(join(root, 'lease.json'), record);
    await guard.check();
    return new PiLease(root, guard, record);
  } catch (cause) { await guard.close(); throw cause; }
}

class PiLease {
  #root; #guard; #record; #driver; #closed = false; #launchPending = false; #launchPromise; #finishPromise;
  constructor(root, guard, record) { this.#root = root; this.#guard = guard; this.#record = record; }
  get token() { return this.#record.token; }
  // Return a copy: mutating caller-visible metadata cannot authorize release.
  get metadata() { return structuredClone(this.#record); }
  async #check() {
    if (this.#closed) throw error('LOCK_LEASE_CLOSED');
    await this.#guard.check();
    const current = await readRecord(this.#root);
    if (current?.token !== this.token) throw error('LOCK_OWNER_CHANGED');
  }
  /** Persist launch intent BEFORE invoking the trusted Driver factory, once. */
  launch(options, factory = startPi) {
    if (this.#closed || this.#finishPromise) return Promise.reject(error('LOCK_LEASE_CLOSED'));
    if (this.#launchPromise) return Promise.reject(error('LOCK_ALREADY_LAUNCHED'));
    this.#launchPending = true;
    this.#launchPromise = this.#launch(options, factory).finally(() => { this.#launchPending = false; });
    return this.#launchPromise;
  }
  async #launch(options, factory) {
    await this.#check();
    this.#record.phase = 'launching';
    await replaceRecord(this.#root, this.#record);
    await this.#guard.check();
    try {
      this.#driver = factory(options);
      await this.#driver.ready;
      const identity = this.#driver.processTree?.identity;
      if (!identityValid(identity)) throw error('LOCK_PROCESS_IDENTITY_MISSING');
      this.#record.process = structuredClone(identity);
      this.#record.phase = 'running';
      await this.#check();
      await replaceRecord(this.#root, this.#record);
      return this.#driver;
    } catch (cause) {
      // Intent remains if persistence/observer failed: even a failed factory
      // might have created a child. There is no automatic empty-lock rollback.
      this.#record.phase = 'uncertain';
      try { await this.#check(); await replaceRecord(this.#root, this.#record); } catch { /* preserve last durable state */ }
      throw cause;
    }
  }
  /** Does not accept a caller-supplied success boolean or detached receipt. */
  finish({ cancel = false } = {}) {
    if (this.#finishPromise) return this.#finishPromise;
    if (this.#closed) return Promise.reject(error('LOCK_LEASE_CLOSED'));
    this.#finishPromise = this.#finish(cancel);
    return this.#finishPromise;
  }
  async #finish(cancel) {
    try {
      // Finish cannot overtake an in-flight launch or authorize another one.
      try { await this.#launchPromise; } catch { /* inspect the actual Driver below */ }
      await this.#check();
      let termination = null;
      if (this.#launchPromise) {
        if (!this.#driver) throw error('LOCK_PROCESS_UNCERTAIN');
        termination = await this.#driver.shutdown({ cancel });
        if (!terminationValid(termination, this.#record.process)) throw error('LOCK_PROCESS_UNCERTAIN');
      }
      this.#record.phase = 'terminated';
      this.#record.termination = termination ? {
        state: termination.state, canRelease: termination.canRelease, processesGone: termination.processesGone,
        identity: structuredClone(termination.identity),
      } : null;
      this.#record.neverLaunched = !this.#launchPromise;
      this.#record.terminatedAt = new Date().toISOString();
      await this.#check();
      await replaceRecord(this.#root, this.#record);
      await archive(this.#root, this.#record);
      return { released: true, termination };
    } finally {
      this.#closed = true;
      await this.#guard.close();
    }
  }
  /** Stop holding the native handle, but KEEP the blocking lease. No killing. */
  async abandon() {
    if (this.#finishPromise || this.#launchPending) throw error('LOCK_OPERATION_PENDING');
    if (!this.#closed) { this.#closed = true; await this.#guard.close(); }
  }
}

async function assess(record, guard) {
  if (!record) return { status: 'free', canAcquire: true, canReconcile: false };
  const sameMachine = record.boot.machine === guard.boot.machine;
  const previousBoot = sameMachine && record.boot.id !== guard.boot.id;
  // Never interpret a foreign/copied record or a failed query as proof of death.
  const ownerStatus = previousBoot ? 'prior-boot' : sameMachine ? await guard.probe(record.owner) : 'unknown';
  let reason = 'PROCESS_TREE_UNCERTAIN', canReconcile = false;
  if (['gone', 'reused', 'prior-boot'].includes(ownerStatus)) {
    if (previousBoot) { reason = 'PRIOR_BOOT_ENDED'; canReconcile = true; }
    else if (record.phase === 'acquired' && record.process === null) { reason = 'OWNER_GONE_BEFORE_LAUNCH'; canReconcile = true; }
    else if (record.phase === 'terminated' && (record.neverLaunched === true && record.process === null ||
        terminationValid(record.termination, record.process))) { reason = 'DURABLE_TERMINATION'; canReconcile = true; }
  } else reason = ownerStatus === 'alive' ? 'OWNER_ALIVE' : 'OWNER_UNCERTAIN';
  return { status: 'blocked', canAcquire: false, canReconcile, reason, ownerStatus, record };
}

/** Verification only. Busy/invalid/unobservable states never authorize launch. */
export async function inspectPiLock({ root = defaultPiLockRoot() } = {}, dependencies) {
  let guard;
  try {
    guard = await enter(root, dependencies);
    return await assess(await readRecord(root), guard);
  } catch (cause) {
    return { status: 'blocked', canAcquire: false, canReconcile: false, reason: cause.code || 'LOCK_OBSERVATION_FAILED' };
  } finally { await guard?.close(); }
}

/** Explicit recovery, NOT a new run. Caller must name the inspected lease. */
export async function reconcilePiLock({ root = defaultPiLockRoot(), expectedToken }, dependencies) {
  if (typeof expectedToken !== 'string' || !expectedToken) throw new TypeError('expectedToken required');
  const guard = await enter(root, dependencies);
  try {
    const record = await readRecord(root);
    if (record?.token !== expectedToken) throw error('LOCK_OWNER_CHANGED');
    const assessment = await assess(record, guard);
    if (!assessment.canReconcile) throw error('LOCK_RECONCILIATION_UNPROVEN');
    record.reconciliation = { at: new Date().toISOString(), reason: assessment.reason,
      ownerStatus: assessment.ownerStatus, boot: guard.boot, by: guard.owner };
    await replaceRecord(root, record);
    await archive(root, record);
    return { reconciled: true, reason: assessment.reason };
  } finally { await guard.close(); }
}
