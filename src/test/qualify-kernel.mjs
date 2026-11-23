// Opt-in, synthetic evidence only. NEVER launches Pi, reboots, anchors or reconciles.
import { mkdtemp, open, readFile, realpath, lstat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWindowsLockGuard } from '../windows-lock-guard.mjs';
import { defaultPiLockRoot, inspectPiLock } from '../pi-lock.mjs';
import { compareKernelCandidates, observeKernelCandidate } from '../windows-kernel-candidate.mjs';

const fail = code => Object.assign(new Error(code), { code });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const repository = fileURLToPath(new URL('../../', import.meta.url));
const inside = (parent, child) => { const path = relative(parent, child); return path === '' || !path.startsWith('..') && !isAbsolute(path); };
const actions = ['same-kernel', 'before-suspend', 'after-suspend', 'before-hibernate', 'after-hibernate', 'before-reboot', 'after-reboot'];
const evidenceSources = ['../windows-kernel-candidate.mjs', '../windows-kernel-candidate.ps1',
  './qualify-kernel.mjs', '../pi-lock.mjs', '../windows-lock-guard.mjs', '../windows-lock-guard.ps1'];
async function sourceFingerprint() {
  return Object.fromEntries(await Promise.all(evidenceSources.map(async path =>
    [path, sha256(await readFile(new URL(path, import.meta.url)))])));
}
const loadedSources = await sourceFingerprint();
async function assertSourcesUnchanged(expected = loadedSources) {
  if (JSON.stringify(expected) !== JSON.stringify(loadedSources) ||
      JSON.stringify(await sourceFingerprint()) !== JSON.stringify(loadedSources)) throw fail('QUALIFICATION_SOURCE_CHANGED');
}

async function writeEvidence(path, value) {
  const file = await open(path, 'wx');
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
}
async function readEvidence(path) {
  if (!(await lstat(path)).isFile() || (await lstat(path)).isSymbolicLink()) throw fail('QUALIFICATION_PATH_INVALID');
  const bytes = await readFile(path);
  if (bytes.length > 256 * 1024) throw fail('QUALIFICATION_EVIDENCE_INVALID');
  return JSON.parse(bytes.toString('utf8'));
}
async function operationalFingerprint() {
  try { return sha256(await readFile(join(defaultPiLockRoot(), 'lease.json'))); }
  catch (error) { if (error.code === 'ENOENT') return 'absent'; throw fail('OPERATIONAL_LEASE_UNOBSERVABLE'); }
}
async function checkRoot(root) {
  if (!isAbsolute(root) || (await lstat(root)).isSymbolicLink()) throw fail('QUALIFICATION_PATH_INVALID');
  const actual = await realpath(root), temporary = await realpath(tmpdir());
  if (dirname(actual).toLowerCase() !== temporary.toLowerCase() ||
      !/^devout-kernel-qualification-[a-z0-9]{6}$/iu.test(basename(actual)) ||
      inside(await realpath(repository), actual) || inside(resolve(defaultPiLockRoot()), actual)) {
    throw fail('QUALIFICATION_PATH_INVALID');
  }
  return actual;
}
async function assertPreserved(root, manifest) {
  await assertSourcesUnchanged(manifest?.sourceHashes ?? null);
  if (manifest?.schema !== 1 || manifest.synthetic !== true || manifest.root !== root ||
      manifest.operationalRoot !== defaultPiLockRoot() ||
      !/^[a-f0-9]{64}$/u.test(manifest.leaseSha256) ||
      !/^[a-f0-9-]{36}$/u.test(manifest.token)) throw fail('QUALIFICATION_EVIDENCE_INVALID');
  const info = await lstat(join(root, 'lease.json'));
  if (!info.isFile() || info.isSymbolicLink()) throw fail('QUALIFICATION_PATH_INVALID');
  if (sha256(await readFile(join(root, 'lease.json'))) !== manifest.leaseSha256) throw fail('SYNTHETIC_LEASE_CHANGED');
  if (await operationalFingerprint() !== manifest.operationalSha256) throw fail('OPERATIONAL_LEASE_CHANGED');
}

export async function prepareQualification() {
  await assertSourcesUnchanged();
  const temporary = await realpath(tmpdir());
  if (inside(await realpath(repository), temporary) || inside(resolve(defaultPiLockRoot()), temporary)) {
    throw fail('QUALIFICATION_PATH_INVALID');
  }
  const operationalSha256 = await operationalFingerprint();
  const before = await observeKernelCandidate();
  const repeated = await observeKernelCandidate();
  compareKernelCandidates(before, repeated, 'same-kernel');
  const root = await checkRoot(await mkdtemp(join(temporary, 'devout-kernel-qualification-')));
  const guard = await openWindowsLockGuard(join(root, 'guard'));
  const token = randomUUID();
  try {
    if (guard.boot.machine !== before.machine) throw fail('KERNEL_CANDIDATE_CONTEXT_CHANGED');
    // Known synthetic uncertain lease: NO Driver/factory/Pi ever existed.
    // Deliberately artificial legacy identity, NOT an observed boot GUID/kernel.
    // Never copy the native guard.boot into schema 1 or anchor this fixture.
    await writeEvidence(join(root, 'lease.json'), { schema: 1, token,
      runId: 'M02-T08-synthetic-qualification-only', owner: guard.owner,
      boot: { machine: guard.boot.machine, id: randomUUID() },
      phase: 'uncertain', process: null, acquiredAt: new Date().toISOString() });
    await guard.check();
  } finally { await guard.close(); }
  const manifest = { schema: 1, synthetic: true, root, token,
    leaseSha256: sha256(await readFile(join(root, 'lease.json'))), operationalRoot: defaultPiLockRoot(),
    operationalSha256, sourceHashes: loadedSources, before, repeated, qualified: false, piLaunched: false };
  await writeEvidence(join(root, 'manifest.json'), manifest);
  await assertPreserved(root, manifest);
  const state = await inspectPiLock({ root });
  if (state.canAcquire || state.canReconcile || state.record?.token !== token) throw fail('SYNTHETIC_LEASE_NOT_BLOCKED');
  return { root, candidateStable: true, syntheticBlocked: true, operationalPreserved: true,
    qualified: false, next: 'Run same-kernel in a NEW Node process, then follow the manual procedure.' };
}

export async function recordQualification(action, suppliedRoot) {
  if (!actions.includes(action)) throw fail('QUALIFICATION_ACTION_INVALID');
  const root = await checkRoot(suppliedRoot);
  const manifest = await readEvidence(join(root, 'manifest.json'));
  await assertPreserved(root, manifest);
  const sample = await observeKernelCandidate();
  let comparison;
  if (action.startsWith('after-')) {
    const baseline = await readEvidence(join(root, `${action.replace('after-', 'before-')}.json`));
    if (baseline.root !== root || baseline.token !== manifest.token) throw fail('QUALIFICATION_EVIDENCE_INVALID');
    comparison = compareKernelCandidates(baseline.sample, sample, action);
  } else {
    comparison = compareKernelCandidates(manifest.before, sample, 'same-kernel');
  }
  const state = await inspectPiLock({ root });
  if (state.canAcquire || state.canReconcile || state.record?.token !== manifest.token) throw fail('SYNTHETIC_LEASE_NOT_BLOCKED');
  await assertPreserved(root, manifest);
  const result = { schema: 1, root, token: manifest.token, action, sample, comparison,
    syntheticCanAcquire: state.canAcquire, legacyCanReconcile: state.canReconcile,
    legacyReason: state.reason, operationalPreserved: true, qualified: false,
    automaticRecoveryPerformed: false };
  // Immutable evidence; do not overwrite a preceding observation or failed write.
  await writeEvidence(join(root, `${action}.json`), result);
  return { root, action, observationSaved: true, comparison, operationalPreserved: true,
    qualified: false, automaticRecoveryPerformed: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.platform !== 'win32') throw fail('WINDOWS_REQUIRED');
    const [action, root, ...extra] = process.argv.slice(2);
    if (extra.length || action === 'prepare' && root || action !== 'prepare' && !root) throw fail('QUALIFICATION_ARGUMENTS_INVALID');
    const result = action === 'prepare' ? await prepareQualification() : await recordQualification(action, root);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: error.code || 'QUALIFICATION_FAILED', qualified: false }));
    process.exitCode = 1;
  }
}
