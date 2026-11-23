// Qualified observation: M02-T08, Windows 10 AMD64 build 19045, 2026-11-23.
// BootId stayed 87 across S3/hibernate and increased to 88 across real restart.
// Other builds/architectures/sources are NOT inferred qualified from this test.
export const kernelIdentitySource = 'windows-kuser-shared-data-bootid-v1';
export function qualifiedKernelIdentity(value) {
  return value?.source === kernelIdentitySource && value.architecture === 'AMD64' && value.build === 19045 &&
    typeof value.machine === 'string' && value.machine.length > 0 && value.machine.length <= 256 &&
    typeof value.id === 'string' && /^(0|[1-9]\d{0,9})$/u.test(value.id) && Number(value.id) <= 0xffffffff;
}
export function priorKernelEnded(before, current) {
  return qualifiedKernelIdentity(before) && qualifiedKernelIdentity(current) &&
    before.machine === current.machine && before.source === current.source && before.build === current.build &&
    before.architecture === current.architecture && Number(current.id) > Number(before.id);
  // Counter rollback/wrap or an unsupported context stays blocked, never a force release.
}
