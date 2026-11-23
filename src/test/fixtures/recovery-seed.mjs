// Private synthetic fixture worker. No Pi, Driver, model input or recovery.
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openWindowsLockGuard } from '../../windows-lock-guard.mjs';
import { qualifiedKernelIdentity } from '../../kernel-identity.mjs';

const root = process.argv[2]; // generated/validated by the trusted opt-in parent
for (const kind of ['native', 'legacy']) {
  const directory = join(root, kind);
  await mkdir(directory); // exclusive fresh fixture: never overwrite a previous lease
  const guard = await openWindowsLockGuard(join(directory, 'guard'));
  try {
    if (!qualifiedKernelIdentity(guard.boot)) throw new Error('UNQUALIFIED_KERNEL');
    const record = { schema: kind === 'native' ? 2 : 1, token: randomUUID(),
      runId: `M02-T08-synthetic-recovery-${kind}`, owner: guard.owner,
      boot: kind === 'native' ? guard.boot : { machine: guard.boot.machine, id: randomUUID() },
      phase: 'uncertain', process: null, acquiredAt: new Date().toISOString() };
    const file = await open(join(directory, 'lease.json'), 'wx');
    try { await file.writeFile(JSON.stringify(record, null, 2) + '\n'); await file.sync(); }
    finally { await file.close(); }
    await guard.check();
  } finally { await guard.close(); }
}
console.log(JSON.stringify({ seeded: true, piLaunched: false }));
