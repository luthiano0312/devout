// Opt-in synthetic recovery across a MANUAL reboot. No Pi or automatic reboot.
import { mkdtemp, open, readFile, realpath, lstat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultPiLockRoot, inspectPiLock, anchorPiLock, reconcilePiLock } from '../pi-lock.mjs';
import { compareKernelCandidates, observeKernelCandidate } from '../windows-kernel-candidate.mjs';

const exec = promisify(execFile);
const fail = code => Object.assign(new Error(code), { code });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const repository = fileURLToPath(new URL('../../', import.meta.url));
const sources = ['./smoke-lock-recovery.mjs', './fixtures/recovery-seed.mjs', '../pi-lock.mjs',
  '../kernel-identity.mjs', '../windows-lock-guard.mjs', '../windows-lock-guard.ps1',
  '../windows-kernel-candidate.mjs', '../windows-kernel-candidate.ps1'];
const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async path =>
  [path, hash(await readFile(new URL(path, import.meta.url)))])));
let evidenceRoot;
const inside = (parent, child) => { const path = relative(parent, child); return path === '' || !path.startsWith('..') && !isAbsolute(path); };
async function persist(path, value) {
  const file = await open(path, 'wx');
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
}
async function bytes(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 256 * 1024) throw fail('SYNTHETIC_EVIDENCE_INVALID');
  return readFile(path);
}
const json = async path => JSON.parse((await bytes(path)).toString('utf8'));
async function operationalHash() {
  try { return hash(await readFile(join(defaultPiLockRoot(), 'lease.json'))); }
  catch (error) { if (error.code === 'ENOENT') return 'absent'; throw fail('OPERATIONAL_LEASE_UNOBSERVABLE'); }
}
async function checkedRoot(root) {
  if (!isAbsolute(root) || (await lstat(root)).isSymbolicLink()) throw fail('SYNTHETIC_PATH_INVALID');
  const actual = await realpath(root), temporary = await realpath(tmpdir());
  if (dirname(actual).toLowerCase() !== temporary.toLowerCase() ||
      !/^devout-recovery-smoke-[a-z0-9]{6}$/iu.test(basename(actual)) ||
      inside(await realpath(repository), actual) || inside(resolve(defaultPiLockRoot()), actual)) throw fail('SYNTHETIC_PATH_INVALID');
  return actual;
}
async function context(root, retired = false) {
  root = await checkedRoot(root);
  const manifest = await json(join(root, 'manifest.json'));
  if (manifest.schema !== 1 || manifest.synthetic !== true || manifest.root !== root ||
      manifest.operationalRoot !== defaultPiLockRoot() ||
      JSON.stringify(manifest.sourceHashes) !== JSON.stringify(sourceHashes)) throw fail('SYNTHETIC_MANIFEST_INVALID');
  for (const path of sources) {
    if (hash(await readFile(new URL(path, import.meta.url))) !== sourceHashes[path]) throw fail('SYNTHETIC_SOURCE_CHANGED');
  }
  if (await operationalHash() !== manifest.operationalSha256) throw fail('OPERATIONAL_LEASE_CHANGED');
  const fixtures = [];
  for (const kind of ['native', 'legacy']) {
    const directory = join(root, kind), info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory) throw fail('SYNTHETIC_PATH_INVALID');
    const identity = manifest.fixtures[kind];
    if (!/^[a-f0-9-]{36}$/u.test(identity?.token) || !/^[a-f0-9]{64}$/u.test(identity.leaseSha256)) throw fail('SYNTHETIC_MANIFEST_INVALID');
    const file = retired ? `retired-${identity.token}.json` : 'lease.json';
    if (hash(await bytes(join(directory, file))) !== identity.leaseSha256) throw fail('SYNTHETIC_LEASE_CHANGED');
    fixtures.push({ kind, root: directory, expectedToken: identity.token, expectedLeaseSha256: identity.leaseSha256 });
  }
  return { root, manifest, fixtures };
}
const inspect = async fixtures => Promise.all(fixtures.map(fixture => inspectPiLock({ root: fixture.root })));
async function anchorHash(root, token) { return hash(await bytes(join(root, 'legacy', `anchor-${token}.json`))); }
async function checkedAnchor(root, legacy) {
  const saved = await json(join(root, 'anchored.json'));
  if (saved.token !== legacy.expectedToken || saved.anchorSha256 !== await anchorHash(root, legacy.expectedToken)) {
    throw fail('SYNTHETIC_ANCHOR_CHANGED');
  }
  return saved;
}

async function prepare() {
  const temporary = await realpath(tmpdir());
  if (inside(await realpath(repository), temporary) || inside(resolve(defaultPiLockRoot()), temporary)) throw fail('SYNTHETIC_PATH_INVALID');
  const operationalSha256 = await operationalHash();
  evidenceRoot = await checkedRoot(await mkdtemp(join(temporary, 'devout-recovery-smoke-')));
  // Child exits before anchoring, so the ORIGINAL owner can be proved absent.
  await exec(process.execPath, [fileURLToPath(new URL('./fixtures/recovery-seed.mjs', import.meta.url)), evidenceRoot],
    { shell: false, windowsHide: true, timeout: 90_000, maxBuffer: 64 * 1024 });
  const fixtures = {};
  for (const kind of ['native', 'legacy']) {
    const raw = await bytes(join(evidenceRoot, kind, 'lease.json')), record = JSON.parse(raw);
    fixtures[kind] = { token: record.token, leaseSha256: hash(raw) };
  }
  await persist(join(evidenceRoot, 'manifest.json'), { schema: 1, synthetic: true, root: evidenceRoot,
    sourceHashes, operationalRoot: defaultPiLockRoot(), operationalSha256, fixtures, piLaunched: false });
  const checked = await context(evidenceRoot), states = await inspect(checked.fixtures);
  if (states.some(state => state.canAcquire || state.canReconcile || !['gone', 'reused'].includes(state.ownerStatus)) ||
      !states[1].canAnchor) throw fail('SYNTHETIC_PRECONDITION_FAILED');
  return { root: evidenceRoot, prepared: true, syntheticBlocked: true, operationalPreserved: true, piLaunched: false };
}
async function stage(action, root) {
  const checked = await context(root), legacy = checked.fixtures[1];
  if (action === 'anchor') {
    const result = await anchorPiLock(legacy);
    const states = await inspect(checked.fixtures);
    if (states.some(state => state.canAcquire || state.canReconcile)) throw fail('SYNTHETIC_SAME_KERNEL_NOT_BLOCKED');
    await context(root);
    await persist(join(root, 'anchored.json'), { token: legacy.expectedToken,
      anchorSha256: await anchorHash(root, legacy.expectedToken), result });
    return { root, anchored: true, syntheticBlocked: true, operationalPreserved: true, rebootPerformed: false };
  }
  const saved = await checkedAnchor(root, legacy);
  const sample = await observeKernelCandidate(), states = await inspect(checked.fixtures);
  if (action === 'before-reboot') {
    if (states.some(state => state.canAcquire || state.canReconcile) ||
        states[0].record.boot.id !== sample.id || saved.result.anchor.boot.id !== sample.id) throw fail('SYNTHETIC_SAME_KERNEL_NOT_BLOCKED');
    await context(root);
    await persist(join(root, 'ready.json'), { sample, states, anchorSha256: saved.anchorSha256 });
    return { root, readyForManualReboot: true, syntheticBlocked: true, operationalPreserved: true };
  }
  if (action !== 'after-reboot') throw fail('SYNTHETIC_ACTION_INVALID');
  const ready = await json(join(root, 'ready.json'));
  const comparison = compareKernelCandidates(ready.sample, sample, 'after-reboot');
  if (ready.anchorSha256 !== saved.anchorSha256 || states.some(state => !state.canReconcile || state.canAcquire) ||
      states[0].reason !== 'NATIVE_PRIOR_KERNEL_ENDED' || states[1].reason !== 'ANCHORED_PRIOR_KERNEL_ENDED') throw fail('SYNTHETIC_RECOVERY_UNPROVEN');
  await context(root);
  // Persist observation BEFORE the explicit synthetic-only operations.
  await persist(join(root, 'observed-after-reboot.json'), { sample, states, comparison });
  const recovered = [];
  for (const fixture of checked.fixtures) recovered.push(await reconcilePiLock(fixture));
  await context(root, true);
  await checkedAnchor(root, legacy);
  if ((await inspect(checked.fixtures)).some(state => !state.canAcquire)) throw fail('SYNTHETIC_RECOVERY_INCOMPLETE');
  const result = { root, syntheticReconciled: true, recovered, originalLeasesPreserved: true,
    anchorPreserved: true, operationalPreserved: true, piLaunched: false, automaticRebootPerformed: false };
  await persist(join(root, 'completed.json'), result);
  return result;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    if (process.platform !== 'win32') throw fail('WINDOWS_REQUIRED');
    const [action, root, ...extra] = process.argv.slice(2);
    if (extra.length || action === 'prepare' && root || action !== 'prepare' && !root ||
        !['prepare', 'anchor', 'before-reboot', 'after-reboot'].includes(action)) throw fail('SYNTHETIC_ARGUMENTS_INVALID');
    evidenceRoot = root;
    console.log(JSON.stringify(action === 'prepare' ? await prepare() : await stage(action, await checkedRoot(root)), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: error.code || 'SYNTHETIC_RECOVERY_FAILED', preservedRoot: evidenceRoot,
      operationalRecoveryPerformed: false }));
    process.exitCode = 1;
  }
}
