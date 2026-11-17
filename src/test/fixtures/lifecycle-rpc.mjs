// Disposable RPC activity/process tree, with no provider, files or network.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
const mode = process.argv[2];
const self = fileURLToPath(import.meta.url);
if (mode === 'leaf' || mode === 'branch') {
  if (mode === 'branch') spawn(process.execPath, [self, 'leaf'], { stdio: 'ignore', shell: false });
  setInterval(() => {}, 1000);
} else {
  const resistant = ['resistant', 'silent', 'invalid-resistant', 'abort-silent'].includes(mode);
  if (resistant) {
    spawn(process.execPath, [self, 'branch'], { stdio: 'ignore', shell: false });
    setInterval(() => {}, 1000); // Deliberately ignores EOF; Windows ignores SIGTERM handlers.
  }
  const input = createInterface({ input: process.stdin });
  input.on('close', () => { if (mode === 'bad-exit') process.exitCode = 7; });
  const send = record => process.stdout.write(JSON.stringify(record) + '\n');
  const reply = (cmd, data = {}) => send({ type: 'response', id: cmd.id, command: cmd.type, success: true, data });
  let active = false;
  input.on('line', line => {
    const cmd = JSON.parse(line);
    if (mode === 'silent') return;
    if (mode === 'invalid-resistant') { process.stdout.write('invalid\n'); return; }
    if (mode === 'eof') process.exit(0);
    if (cmd.type === 'get_state') { reply(cmd, { isStreaming: active }); return; }
    if (cmd.type === 'prompt') {
      active = true;
      reply(cmd, { disposition: 'started' });
      send({ type: 'agent_start' });
      if (mode === 'normal') {
        active = false;
        send({ type: 'agent_settled', aborted: false });
      }
      return;
    }
    if (cmd.type === 'abort') {
      if (mode === 'abort-silent') return;
      if (mode === 'abort-reject') { send({ type: 'response', id: cmd.id, command: cmd.type, success: false }); return; }
      reply(cmd);
      if (active) { active = false; send({ type: 'agent_settled', aborted: true }); }
    }
  });
}
