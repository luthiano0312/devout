import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { win32 } from 'node:path';
import { promisify } from 'node:util';

export const kernelCandidateSource = 'windows-kuser-shared-data-bootid-v1';
const script = readFileSync(new URL('./windows-kernel-candidate.ps1', import.meta.url), 'utf8');
const exec = promisify(execFile);
const fail = code => Object.assign(new Error(code), { code });
const text = value => typeof value === 'string' && value.length > 0 && value.length < 256;
const timestamp = value => text(value) && Number.isFinite(Date.parse(value));

// These are observations for qualification, NOT an allowlist of recovery proofs.
export function validateKernelCandidate(value) {
  if (value?.source !== kernelCandidateSource || value.qualified !== false ||
      !text(value.machine) || !text(value.id) || !/^(0|[1-9]\d{0,9})$/u.test(value.id) || Number(value.id) > 0xffffffff ||
      value.architecture !== 'AMD64' || !Number.isSafeInteger(value.build) || value.build < 10240 ||
      !timestamp(value.lastBootUpTime) || !text(value.kernelStart?.recordId) || !/^\d+$/u.test(value.kernelStart.recordId) ||
      !timestamp(value.kernelStart?.at) || !Array.isArray(value.powerEvents) || value.powerEvents.length > 12 ||
      value.powerEvents.some(event => ![42, 107].includes(event?.id) || !text(event.recordId) || !/^\d+$/u.test(event.recordId) ||
        !timestamp(event.at) || !event.states || typeof event.states !== 'object' ||
        Object.entries(event.states).some(([key, state]) => !['TargetState', 'EffectiveState'].includes(key) || !/^\d+$/u.test(state)))) {
    throw fail('KERNEL_CANDIDATE_INVALID');
  }
  return value;
}

export async function observeKernelCandidate() {
  if (process.platform !== 'win32') throw fail('WINDOWS_REQUIRED');
  try {
    const { stdout } = await exec(win32.join(process.env.SystemRoot || 'C:\\Windows',
      'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), [
      '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64'),
    ], { shell: false, windowsHide: true, timeout: 30_000, maxBuffer: 64 * 1024 });
    return validateKernelCandidate(JSON.parse(stdout.trim()));
  } catch { throw fail('KERNEL_CANDIDATE_OBSERVATION_FAILED'); }
}

export function compareKernelCandidates(before, after, action) {
  validateKernelCandidate(before); validateKernelCandidate(after);
  if (!['same-kernel', 'after-suspend', 'after-hibernate', 'after-reboot'].includes(action)) {
    throw fail('KERNEL_CANDIDATE_ACTION_INVALID');
  }
  if (before.machine !== after.machine || before.source !== after.source ||
      before.build !== after.build || before.architecture !== after.architecture) {
    throw fail('KERNEL_CANDIDATE_CONTEXT_CHANGED');
  }
  const idChanged = before.id !== after.id;
  const bootEventChanged = before.kernelStart.recordId !== after.kernelStart.recordId;
  const cimChanged = before.lastBootUpTime !== after.lastBootUpTime;
  // CIM and the kernel-start event only corroborate a manually executed reboot.
  // They never enter production lock policy and never prove process death alone.
  if (action === 'after-reboot' ? !(idChanged && bootEventChanged && cimChanged) :
    idChanged || bootEventChanged || cimChanged) throw fail('KERNEL_CANDIDATE_EXPECTATION_FAILED');
  const lastPowerRecord = before.powerEvents.reduce((last, event) => BigInt(event.recordId) > last ? BigInt(event.recordId) : last, 0n);
  const newPowerEvents = after.powerEvents.filter(event => BigInt(event.recordId) > lastPowerRecord);
  const target = action === 'after-suspend' ? '4' : action === 'after-hibernate' ? '5' : null;
  // SYSTEM_POWER_STATE: Sleeping3=4, Hibernate=5. Other states (e.g. modern
  // standby) are not silently accepted as this test's S3/hibernate evidence.
  const powerTransitionObserved = target !== null &&
    newPowerEvents.some(event => event.id === 42 && event.states.TargetState === target &&
      event.states.EffectiveState === target && newPowerEvents.some(resume => resume.id === 107 &&
        BigInt(resume.recordId) > BigInt(event.recordId)));
  if (target !== null && !powerTransitionObserved) throw fail('KERNEL_POWER_TRANSITION_UNPROVEN');
  return { action, candidateExpectationMet: true, idChanged, bootEventChanged, cimChanged,
    powerTransitionObserved, qualified: false };
}
