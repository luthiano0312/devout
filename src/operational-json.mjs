import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, openSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Flush + atomic rename on the same volume. Preserve temporaries on failure. */
export function atomicWriteJson(path, value) {
  const data = JSON.stringify(value) + '\n';
  const temporary = join(dirname(path), `.write-${randomUUID()}.tmp`);
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
  const backoff = [10, 20, 40, 80, 100];
  for (let attempt = 0; ; attempt++) {
    try { renameSync(temporary, path); return; }
    catch (error) {
      // Retry the SAME durable candidate; never unlink the valid destination.
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= backoff.length) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, backoff[attempt]);
    }
  }
}
