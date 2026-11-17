import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { statSync } from 'node:fs';
import { win32 } from 'node:path';
import { randomUUID } from 'node:crypto';

export class DriverError extends Error {
  constructor(code, message, response) {
    super(message);
    this.name = 'DriverError';
    this.code = code;
    if (response) this.response = response;
  }
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2 ** 31 - 1) {
    throw new TypeError(`${name} must be a positive 32-bit integer`);
  }
  return value;
}

// Only these two literal command lines can reach cmd.exe. All RPC input goes
// through stdin. Reject shell syntax even in the trusted launcher's path.
const COMMANDS = Object.freeze({
  default: '""%DEVOUT_PI_CMD%" --mode rpc --no-session"',
  isolated: '""%DEVOUT_PI_CMD%" --mode rpc --no-session --no-tools --no-extensions --no-mcp --no-skills --no-prompt-templates --no-context-files --no-approve"',
});

export function windowsLaunchSpec({ piCmd, cwd, profile = 'default' }) {
  if (typeof piCmd !== 'string' || !win32.isAbsolute(piCmd) ||
      !piCmd.toLowerCase().endsWith('.cmd') || /["%!&|<>^()\r\n\0]/u.test(piCmd)) {
    throw new TypeError('piCmd must be an absolute .cmd path without shell metacharacters');
  }
  if (!Object.hasOwn(COMMANDS, profile)) throw new TypeError('Unknown launch profile');
  if (!statSync(piCmd).isFile() || !statSync(cwd).isDirectory()) {
    throw new TypeError('piCmd and cwd must exist');
  }
  return {
    file: win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'),
    args: ['/d', '/s', '/v:off', '/c', COMMANDS[profile]],
    options: {
      cwd, env: { ...process.env, DEVOUT_PI_CMD: piCmd },
      shell: false, windowsVerbatimArguments: true, windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  };
}

export function startPi({ piCmd, cwd, profile = 'default', ...transportOptions }) {
  if (process.platform !== 'win32') throw new Error('startPi requires native Windows');
  // Validate options before creating a process that could otherwise be orphaned.
  const limits = validateOptions(transportOptions);
  const spec = windowsLaunchSpec({ piCmd, cwd, profile });
  return new PiDriver(spawn(spec.file, spec.args, spec.options), limits);
}

function validateOptions({ commandTimeoutMs = 30_000, maxRecordBytes = 8 * 1024 * 1024,
  maxQueuedBytes = 8 * 1024 * 1024, maxPending = 32 } = {}) {
  return {
    commandTimeoutMs: positiveInteger(commandTimeoutMs, 'commandTimeoutMs'),
    maxRecordBytes: positiveInteger(maxRecordBytes, 'maxRecordBytes'),
    maxQueuedBytes: positiveInteger(maxQueuedBytes, 'maxQueuedBytes'),
    maxPending: positiveInteger(maxPending, 'maxPending'),
  };
}

/** JSONL transport over an owned, newly spawned child with piped stdio. */
export class PiDriver extends EventEmitter {
  constructor(child, options = {}) {
    super();
    Object.assign(this, validateOptions(options));
    this.child = child;
    this.failure = null;
    this.inputClosed = false;
    this.pending = new Map();
    this.fragments = [];
    this.fragmentBytes = 0;
    this.writeQueue = [];
    this.queuedBytes = 0;
    this.writeBlocked = false;
    this.run = null;
    this.closed = new Promise(resolve => { this.resolveClosed = resolve; });
    this.ready = new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', () => reject(new DriverError('SPAWN_ERROR', 'Child failed to start')));
    });
    // Keep an unobserved ready promise from becoming an unhandled rejection.
    this.ready.catch(() => {});
    child.on('error', () => this.fail('SPAWN_ERROR', 'Child process error'));
    child.stdin.on('error', () => this.fail('STDIN_ERROR', 'RPC stdin failed'));
    child.stdout.on('error', () => this.fail('STDOUT_ERROR', 'RPC stdout failed'));
    child.stderr.on('error', () => this.fail('STDERR_ERROR', 'Diagnostic stream failed'));
    child.stderr.on('data', bytes => this.emit('diagnostic', bytes));
    child.stdin.on('drain', () => { this.writeBlocked = false; this.flushWrites(); });
    child.stdout.on('data', bytes => this.acceptBytes(bytes));
    child.stdout.on('end', () => {
      if (this.fragmentBytes) this.fail('TRUNCATED_RECORD', 'EOF inside a JSONL record');
      else if (!this.inputClosed || this.pending.size || this.run) {
        this.fail('EARLY_EOF', 'RPC stdout ended before requested shutdown or completion');
      }
    });
    child.on('close', (exitCode, signal) => {
      if (!this.inputClosed || this.pending.size || this.run) {
        this.fail('EARLY_EXIT', 'Child exited before requested shutdown or completion');
      } else if (exitCode !== 0 || signal) {
        this.fail('PROCESS_EXIT', 'Child exited abnormally');
      }
      const result = { exitCode, signal, failure: this.failure };
      this.resolveClosed(result);
      this.emit('closed', result);
    });
  }

  fail(code, message) {
    if (this.failure) return;
    this.failure = new DriverError(code, message);
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(this.failure);
    }
    this.pending.clear();
    this.writeQueue = [];
    this.fragments = [];
    this.fragmentBytes = 0;
    this.finishRun(this.failure);
    // Only an orderly EOF request here. Escalation/tree verification is T02.
    this.closeInput();
    this.emit('failure', this.failure);
  }

  closeInput() {
    this.inputClosed = true;
    if (!this.child.stdin.destroyed && !this.child.stdin.writableEnded) this.child.stdin.end();
  }

  command(type, payload = {}, options) {
    return this.#command(type, payload, options);
  }

  #command(type, payload = {}, { timeoutMs = this.commandTimeoutMs } = {}, observedRun = null) {
    positiveInteger(timeoutMs, 'timeoutMs');
    if (typeof type !== 'string' || !type || !payload || typeof payload !== 'object' ||
        Array.isArray(payload) || ['id', 'requestId', 'type'].some(key => Object.hasOwn(payload, key))) {
      throw new TypeError('Command payload cannot override type/id/requestId');
    }
    if (this.failure || this.inputClosed) {
      return Promise.reject(this.failure || new DriverError('INPUT_CLOSED', 'RPC input is closed'));
    }
    if (type === 'prompt' && this.run && observedRun !== this.run) {
      return Promise.reject(new DriverError('RUN_ACTIVE', 'Cannot inject a prompt into an observed run'));
    }
    if (this.pending.size >= this.maxPending) {
      return Promise.reject(new DriverError('QUEUE_LIMIT', 'Too many outstanding commands'));
    }
    const id = randomUUID();
    const line = JSON.stringify({ ...payload, type, id }) + '\n';
    const bytes = Buffer.byteLength(line);
    if (bytes - 1 > this.maxRecordBytes || this.queuedBytes + bytes > this.maxQueuedBytes) {
      return Promise.reject(new DriverError('QUEUE_LIMIT', 'Outgoing JSONL byte limit exceeded'));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail('COMMAND_TIMEOUT', 'RPC command deadline exceeded'), timeoutMs);
      this.pending.set(id, { type, resolve, reject, timer });
      this.writeQueue.push({ line, bytes });
      this.queuedBytes += bytes;
      this.flushWrites();
    });
  }

  flushWrites() {
    while (!this.failure && !this.writeBlocked && this.writeQueue.length) {
      const { line, bytes } = this.writeQueue.shift();
      this.writeBlocked = !this.child.stdin.write(line, 'utf8', error => {
        this.queuedBytes -= bytes;
        if (error) this.fail('STDIN_ERROR', 'RPC write failed');
      });
    }
  }

  getState(options) { return this.command('get_state', {}, options); }
  prompt(message, options) {
    if (typeof message !== 'string') throw new TypeError('message must be a string');
    return this.command('prompt', { message }, options);
  }

  // One session-level run at a time. Register before sending: settlement can
  // arrive before the acknowledgement, including in the same stdout chunk.
  promptAndWait(message, { timeoutMs = 120_000, commandTimeoutMs = this.commandTimeoutMs } = {}) {
    positiveInteger(timeoutMs, 'timeoutMs');
    positiveInteger(commandTimeoutMs, 'commandTimeoutMs');
    if (typeof message !== 'string') throw new TypeError('message must be a string');
    if (this.run) return Promise.reject(new DriverError('RUN_ACTIVE', 'A run is already being observed'));
    if (this.failure || this.inputClosed) {
      return Promise.reject(this.failure || new DriverError('INPUT_CLOSED', 'RPC input is closed'));
    }
    return new Promise((resolve, reject) => {
      this.run = { resolve, reject, assistantError: false,
        timer: setTimeout(() => this.fail('SETTLED_TIMEOUT', 'No agent_settled before deadline'), timeoutMs) };
      this.#command('prompt', { message }, { timeoutMs: commandTimeoutMs }, this.run).then(response => {
        if (!this.run) return;
        this.run.response = response;
        if (response.data?.disposition !== 'started') {
          this.finishRun(new DriverError('PROMPT_NOT_STARTED', 'Prompt did not start a fresh run', response));
        } else this.maybeFinishRun();
      }, error => this.finishRun(error));
    });
  }

  finishRun(error) {
    const run = this.run;
    if (!run) return;
    this.run = null;
    clearTimeout(run.timer);
    if (error) run.reject(error);
    else run.resolve({ response: run.response, settled: run.settled, assistantError: run.assistantError });
  }

  maybeFinishRun() {
    if (this.run?.response && this.run.settled) this.finishRun();
  }

  acceptBytes(bytes) {
    if (this.failure) return;
    let start = 0;
    while (start < bytes.length) {
      const lf = bytes.indexOf(10, start);
      const end = lf < 0 ? bytes.length : lf;
      const part = bytes.subarray(start, end);
      if (this.fragmentBytes + part.length > this.maxRecordBytes) {
        this.fail('RECORD_LIMIT', 'Incoming JSONL record exceeds byte limit');
        return;
      }
      this.fragments.push(part);
      this.fragmentBytes += part.length;
      if (lf < 0) return;
      const record = Buffer.concat(this.fragments, this.fragmentBytes);
      this.fragments = [];
      this.fragmentBytes = 0;
      let msg;
      try {
        // Decode only complete records, preserving split UTF-8 and U+2028/2029.
        const text = new TextDecoder('utf-8', { fatal: true }).decode(record);
        msg = JSON.parse(text.endsWith('\r') ? text.slice(0, -1) : text);
      } catch {
        this.fail('INVALID_JSON', 'Invalid UTF-8 or JSON in RPC stdout');
        return;
      }
      this.acceptRecord(msg);
      if (this.failure) return;
      start = lf + 1;
    }
  }

  acceptRecord(msg) {
    if (!msg || Array.isArray(msg) || typeof msg.type !== 'string' || !msg.type) {
      this.fail('INVALID_RECORD', 'RPC record must be an object with a type');
      return;
    }
    if (msg.type === 'response') {
      if (typeof msg.success !== 'boolean' || typeof msg.command !== 'string' ||
          (msg.id !== undefined && msg.requestId !== undefined && msg.id !== msg.requestId)) {
        this.fail('INVALID_RESPONSE', 'Malformed RPC response');
        return;
      }
      const id = msg.id ?? msg.requestId;
      if (id === undefined) {
        this.fail('UNCORRELATED_RESPONSE', 'RPC response has no correlation identifier');
        return;
      }
      const entry = this.pending.get(id);
      if (!entry) { this.emit('unmatchedResponse', msg); return; }
      if (msg.command !== entry.type) {
        this.fail('COMMAND_MISMATCH', 'Response command does not match its identifier');
        return;
      }
      clearTimeout(entry.timer);
      this.pending.delete(id);
      if (msg.success) entry.resolve(msg);
      else entry.reject(new DriverError('RPC_ERROR', 'RPC command was rejected', msg));
      this.emit('response', msg);
      return;
    }
    if (this.run) {
      if (msg.type === 'message_end' && msg.message?.role === 'assistant') {
        this.run.assistantError ||= ['error', 'aborted'].includes(msg.message.stopReason) || Boolean(msg.message.errorMessage);
      }
      if (msg.type === 'agent_settled') {
        this.run.settled = msg;
        this.run.assistantError ||= msg.aborted === true;
        this.maybeFinishRun();
      }
    }
    this.emit('event', msg);
  }
}
