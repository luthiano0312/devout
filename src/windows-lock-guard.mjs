import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { win32 } from 'node:path';

const script = readFileSync(new URL('./windows-lock-guard.ps1', import.meta.url), 'utf8');
const failure = (code = 'LOCK_OBSERVATION_FAILED') => Object.assign(new Error(code), { code });

// The only cross-process synchronization primitive. All callers use the same
// stable file, never delete it, and retain its native exclusive handle.
export async function openWindowsLockGuard(path) {
  if (process.platform !== 'win32') throw failure('WINDOWS_REQUIRED');
  const child = spawn(win32.join(process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), [
    '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64'),
  ], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let sequence = 0, failed = false, closing = false;
  const pending = new Map();
  const exited = new Promise(resolve => child.once('close', resolve));
  function fail(error = failure()) {
    failed = true;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
  }
  child.stderr.resume();
  for (const stream of [child.stdin, child.stdout, child.stderr]) stream.on('error', () => fail());
  child.on('error', () => fail());
  child.on('exit', () => fail());
  createInterface({ input: child.stdout }).on('line', line => {
    try {
      const value = JSON.parse(line);
      const entry = pending.get(value.id);
      if (!entry) return;
      pending.delete(value.id); clearTimeout(entry.timer);
      if (value.ok) entry.resolve(value.data);
      else entry.reject(failure(value.code === 'LOCK_BUSY' ? 'LOCK_BUSY' : undefined));
    } catch { fail(); }
  });
  function exchange(id, payload) {
    if (failed || closing) return Promise.reject(failure());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { fail(); child.kill(); }, 25_000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, ...payload }) + '\n', error => { if (error) fail(); });
    });
  }
  async function close() {
    if (!closing) {
      closing = true;
      child.stdin.end();
    }
    const timer = setTimeout(() => child.kill(), 2000);
    try { await exited; } finally { clearTimeout(timer); }
  }
  try {
    const identity = await exchange(0, { path, pid: process.pid });
    return { ...identity, check: () => exchange(++sequence, { op: 'check' }),
      probe: identity => exchange(++sequence, { op: 'probe', identity }).then(value => value.status), close };
  } catch (error) { await close(); throw error; }
}
