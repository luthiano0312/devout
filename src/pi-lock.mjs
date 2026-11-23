import { mkdir, open, readFile, rename, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { startPi } from './pi-driver.mjs';
import { openWindowsLockGuard } from './windows-lock-guard.mjs';
import { qualifiedKernelIdentity, priorKernelEnded } from './kernel-identity.mjs';

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
  return (record?.schema === 1 && bootValid(record.boot) && record.boot.source === undefined ||
    record?.schema === 2 && qualifiedKernelIdentity(record.boot)) &&
    typeof record.token === 'string' && /^[a-f0-9-]{36}$/u.test(record.token) &&
    typeof record.runId === 'string' && record.runId.length > 0 && identityValid(record.owner) &&
    bootValid(record.boot) && phases.includes(record.phase) &&
    (record.process === null || identityValid(record.process)) &&
    (record.phase !== 'running' || identityValid(record.process));
}
const terminationValid = (result, identity) => identityEqual(result?.identity, identity) &&
  result.state === 'terminated' && result.canRelease === true && result.processesGone === true;

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function readSnapshot(path, code) {
  try {
    const bytes = await readFile(path);
    if (bytes.length > 256 * 1024) throw error(code);
    return { record: JSON.parse(bytes.toString('utf8')), sha256: digest(bytes) };
  } catch (cause) {
    if (cause.code === 'ENOENT') return null;
    throw error(cause instanceof SyntaxError ? code : cause.code || 'LOCK_READ_FAILED');
  }
}
async function leaseSnapshot(root) {
  const snapshot = await readSnapshot(join(root, 'lease.json'), 'LOCK_METADATA_INVALID');
  if (snapshot && !valid(snapshot.record)) throw error('LOCK_METADATA_INVALID');
  return snapshot;
}
async function readRecord(root) { return (await leaseSnapshot(root))?.record ?? null; }
const anchorPath = (root, token) => join(root, `anchor-${token}.json`);
async function recoverySnapshot(root) {
  const lease = await leaseSnapshot(root);
  if (!lease) return { lease: null, anchor: null };
  const anchor = await readSnapshot(anchorPath(root, lease.record.token), 'LOCK_ANCHOR_INVALID');
  if (anchor) {
    const value = anchor.record;
    const { integritySha256, ...payload } = value ?? {};
    if (integritySha256 !== digest(JSON.stringify(payload))) throw error('LOCK_ANCHOR_INVALID');
    if (lease.record.schema !== 1 || value?.schema !== 1 || value.kind !== 'legacy-kernel-anchor-v1' ||
        value.token !== lease.record.token || value.leaseSha256 !== lease.sha256 ||
        !qualifiedKernelIdentity(value.boot) || value.boot.machine !== lease.record.boot.machine ||
        !identityValid(value.by) || typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at))) {
      throw error('LOCK_ANCHOR_INVALID');
    }
  }
  return { lease, anchor };
}
async function assertUnchanged(root, snapshot) {
  const current = await recoverySnapshot(root);
  if (current.lease?.record.token !== snapshot.lease?.record.token) throw error('LOCK_OWNER_CHANGED');
  if (current.lease?.sha256 !== snapshot.lease?.sha256 || current.anchor?.sha256 !== snapshot.anchor?.sha256) {
    throw error('LOCK_INTEGRITY_CHANGED');
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
  const target = join(root, `retired-${record.token}.json`);
  try { await lstat(target); throw error('LOCK_ARCHIVE_EXISTS'); }
  catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
  await rename(join(root, 'lease.json'), target);
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
    if (!qualifiedKernelIdentity(guard.boot)) throw error('LOCK_BOOT_UNQUALIFIED');
    const record = { schema: 2, token: randomUUID(), runId, owner: guard.owner, boot: guard.boot,
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

async function assess(snapshot, guard) {
  const record = snapshot.lease?.record;
  if (!record) return { status: 'free', canAcquire: true, canReconcile: false, canAnchor: false };
  const sameMachine = record.boot.machine === guard.boot.machine;
  // Even a qualified prior-kernel proof never overrides an unknown/live owner.
  const ownerStatus = sameMachine ? await guard.probe(record.owner) : 'unknown';
  const absent = ['gone', 'reused'].includes(ownerStatus);
  const baseline = record.schema === 2 ? record.boot : snapshot.anchor?.record.boot;
  const previousKernel = priorKernelEnded(baseline, guard.boot);
  let reason = 'PROCESS_TREE_UNCERTAIN', canReconcile = false;
  if (absent) {
    if (record.phase === 'acquired' && record.process === null) { reason = 'OWNER_GONE_BEFORE_LAUNCH'; canReconcile = true; }
    else if (record.phase === 'terminated' && (record.neverLaunched === true && record.process === null ||
        terminationValid(record.termination, record.process))) { reason = 'DURABLE_TERMINATION'; canReconcile = true; }
    else if (previousKernel) {
      reason = record.schema === 2 ? 'NATIVE_PRIOR_KERNEL_ENDED' : 'ANCHORED_PRIOR_KERNEL_ENDED';
      canReconcile = true;
    }
  } else reason = ownerStatus === 'alive' ? 'OWNER_ALIVE' : 'OWNER_UNCERTAIN';
  return { status: 'blocked', canAcquire: false, canReconcile, reason, ownerStatus, record,
    leaseSha256: snapshot.lease.sha256, anchor: snapshot.anchor?.record ?? null,
    canAnchor: absent && sameMachine && record.schema === 1 && !snapshot.anchor && qualifiedKernelIdentity(guard.boot) };
}

/** Verification only. Busy/invalid/unobservable states never authorize launch. */
export async function inspectPiLock({ root = defaultPiLockRoot() } = {}, dependencies) {
  let guard;
  try {
    guard = await enter(root, dependencies);
    const snapshot = await recoverySnapshot(root);
    const assessment = await assess(snapshot, guard);
    await guard.check();
    await assertUnchanged(root, snapshot);
    return assessment;
  } catch (cause) {
    return { status: 'blocked', canAcquire: false, canReconcile: false, reason: cause.code || 'LOCK_OBSERVATION_FAILED' };
  } finally { await guard?.close(); }
}

function expectedLease(snapshot, token, sha256) {
  if (snapshot.lease?.record.token !== token) throw error('LOCK_OWNER_CHANGED');
  if (sha256 !== undefined && snapshot.lease.sha256 !== sha256) throw error('LOCK_INTEGRITY_CHANGED');
}

/** Explicit, immutable observation point for LEGACY leases. Never releases one. */
export async function anchorPiLock({ root = defaultPiLockRoot(), expectedToken, expectedLeaseSha256 }, dependencies) {
  if (typeof expectedToken !== 'string' || !expectedToken ||
      typeof expectedLeaseSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedLeaseSha256)) {
    throw new TypeError('expectedToken and expectedLeaseSha256 required');
  }
  const guard = await enter(root, dependencies);
  try {
    const snapshot = await recoverySnapshot(root);
    expectedLease(snapshot, expectedToken, expectedLeaseSha256);
    if (snapshot.anchor) throw error('LOCK_ANCHOR_EXISTS');
    if (!(await assess(snapshot, guard)).canAnchor) throw error('LOCK_ANCHOR_UNPROVEN');
    const payload = { schema: 1, kind: 'legacy-kernel-anchor-v1', token: expectedToken,
      leaseSha256: snapshot.lease.sha256, boot: structuredClone(guard.boot),
      by: structuredClone(guard.owner), at: new Date().toISOString() };
    // Corruption detection in a trusted directory, not an adversarial signature.
    const anchor = { ...payload, integritySha256: digest(JSON.stringify(payload)) };
    await guard.check();
    await assertUnchanged(root, snapshot);
    await writeDurable(anchorPath(root, expectedToken), anchor);
    await guard.check();
    const current = await recoverySnapshot(root);
    if (current.lease?.sha256 !== snapshot.lease.sha256 ||
        current.anchor?.sha256 !== digest(JSON.stringify(anchor) + '\n')) throw error('LOCK_INTEGRITY_CHANGED');
    if (!['gone', 'reused'].includes((await assess(current, guard)).ownerStatus)) throw error('LOCK_ANCHOR_UNPROVEN');
    await guard.check();
    await assertUnchanged(root, current);
    return { anchored: true, canAcquire: false, canReconcile: false, anchor };
  } finally { await guard.close(); }
}

/** Explicit recovery, NOT a new run. Caller names the lease; optional hash pins inspection. */
export async function reconcilePiLock({ root = defaultPiLockRoot(), expectedToken, expectedLeaseSha256 }, dependencies) {
  if (typeof expectedToken !== 'string' || !expectedToken) throw new TypeError('expectedToken required');
  if (expectedLeaseSha256 !== undefined &&
      (typeof expectedLeaseSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedLeaseSha256))) throw new TypeError('invalid expectedLeaseSha256');
  const guard = await enter(root, dependencies);
  try {
    const snapshot = await recoverySnapshot(root);
    expectedLease(snapshot, expectedToken, expectedLeaseSha256);
    const assessment = await assess(snapshot, guard);
    if (!assessment.canReconcile) throw error('LOCK_RECONCILIATION_UNPROVEN');
    await guard.check();
    await assertUnchanged(root, snapshot);
    // Separate durable proof preserves the ORIGINAL lease bytes and the anchor.
    const proof = { schema: 1, token: expectedToken, leaseSha256: snapshot.lease.sha256,
      anchorSha256: snapshot.anchor?.sha256 ?? null, at: new Date().toISOString(), reason: assessment.reason,
      ownerStatus: assessment.ownerStatus, boot: guard.boot, by: guard.owner };
    await writeDurable(join(root, `reconciliation-${expectedToken}-${randomUUID()}.json`), proof);
    if (!(await assess(snapshot, guard)).canReconcile) throw error('LOCK_RECONCILIATION_UNPROVEN');
    await guard.check();
    await assertUnchanged(root, snapshot);
    await archive(root, snapshot.lease.record);
    return { reconciled: true, reason: assessment.reason };
  } finally { await guard.close(); }
}
