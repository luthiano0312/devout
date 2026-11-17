import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = readFileSync(new URL('./windows-process-tree.ps1', import.meta.url), 'utf8');
const host = fileURLToPath(new URL('./pi-host.mjs', import.meta.url));
const observationError = (code = 'PROCESS_OBSERVATION_FAILED') => Object.assign(new Error('Windows process supervision unavailable'), { code });

function message(child, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(observationError()), 25_000);
    const onMessage = value => { if (value?.type === type) finish(); };
    const onExit = () => finish(observationError());
    function finish(error) {
      clearTimeout(timer);
      child.off('message', onMessage); child.off('exit', onExit); child.off('error', onExit);
      if (error) reject(error); else resolve();
    }
    child.on('message', onMessage); child.once('exit', onExit); child.once('error', onExit);
  });
}

// A private observer per Driver execution, not a service or workflow IPC.
// The Job Object, not PID polling, accounts for all inherited descendants.
export class WindowsProcessTree {
  constructor(child, spec, earliestMs) {
    this.child = child;
    this.pending = new Map();
    this.sequence = 0;
    this.failed = false;
    this.helper = spawn(win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), [
      '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64'),
    ], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.helper.stderr.resume();
    this.helper.stdout.on('error', () => this.fail());
    this.helper.stderr.on('error', () => this.fail());
    this.helper.stdin.on('error', () => this.fail());
    this.helper.on('error', () => this.fail());
    this.helper.on('exit', () => this.fail());
    createInterface({ input: this.helper.stdout }).on('line', line => {
      try {
        const msg = JSON.parse(line);
        const entry = this.pending.get(msg.id);
        if (!entry) return;
        this.pending.delete(msg.id); clearTimeout(entry.timer);
        if (msg.ok) entry.resolve(msg.data);
        else entry.reject(observationError(/^PROCESS_[A-Z_0-9]+$/u.test(msg.code) ? msg.code : undefined));
      } catch { this.fail(); }
    });
    this.ready = this.initialize(spec, earliestMs);
    this.ready.catch(() => {});
  }
  async initialize(spec, earliestMs) {
    await message(this.child, 'waiting');
    this.identity = await this.request('attach', {
      pid: this.child.pid, parentPid: process.pid, image: process.execPath, earliestMs,
    });
    // IPC is tied to the actual owned child, not a recyclable PID. The launch
    // gate is still alive and connected after opening/assigning its handle.
    if (!this.child.connected || this.child.exitCode !== null) throw observationError();
    this.initialSnapshot = await this.snapshot();
    const launched = message(this.child, 'launched');
    this.child.send(spec, error => { if (error) this.fail(); });
    await launched;
  }
  fail() {
    if (this.disposed || this.failed) return;
    this.failed = true;
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(observationError()); }
    this.pending.clear();
    this.onFailure?.();
  }
  request(op, payload = {}) {
    if (this.failed) return Promise.reject(observationError());
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.fail(); }, 15_000);
      this.pending.set(id, { resolve, reject, timer });
      this.helper.stdin.write(JSON.stringify({ id, op, ...payload }) + '\n', error => { if (error) this.fail(); });
    });
  }
  snapshot() { return this.request('snapshot'); }
  force(timeoutMs) { return this.request('force', { timeoutMs }); }
  async dispose() {
    try { if (!this.failed) await this.request('dispose'); }
    finally {
      this.disposed = true;
      this.helper.stdin.end();
      // The helper itself is an owned ChildProcess with a live native handle.
      // It never has kill-on-job-close semantics, even on observer failure.
      if (this.failed) this.helper.kill();
    }
  }
}

export function spawnManagedPi(spec) {
  const earliestMs = Date.now() - 2000; // Windows creation timestamps, not a PID-only identity.
  const child = spawn(process.execPath, [host], {
    cwd: spec.options.cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });
  return { child, processTree: new WindowsProcessTree(child, spec, earliestMs) };
}
