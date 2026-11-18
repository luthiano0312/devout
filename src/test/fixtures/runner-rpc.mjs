// Controlled fake Pi. Canary payloads must never enter Runner evidence/stdout.
import { createInterface } from 'node:readline';
const mode = process.argv[2] || 'normal';
const secret = 'CANARY-DO-NOT-PERSIST-T04';
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const reply = (cmd, data) => send({ type: 'response', id: cmd.id, command: cmd.type, success: true, data });
const input = createInterface({ input: process.stdin });
input.on('line', line => {
  const cmd = JSON.parse(line);
  process.stderr.write(secret + '\n');
  send({ type: secret, token: secret, sessionId: secret });
  if (mode === 'eof') { process.exit(0); }
  if (cmd.type === 'get_state') {
    reply(cmd, { model: { id: secret }, sessionId: secret, isStreaming: false });
  } else if (cmd.type === 'prompt') {
    if (mode === 'crash') process.exit(7);
    if (mode === 'rpc-error') {
      send({ type: 'response', id: cmd.id, command: cmd.type, success: false, error: secret });
      return;
    }
    reply(cmd, { disposition: 'started' });
    send({ type: 'agent_start' });
    if (mode === 'timeout') return;
    send({ type: 'message_update', delta: secret });
    send({ type: 'message_end', message: { role: 'assistant',
      stopReason: mode === 'assistant-error' ? 'error' : 'stop',
      errorMessage: mode === 'assistant-error' ? secret : undefined,
      content: [{ type: 'text', text: mode === 'mismatch' ? secret : 'PONG-DEVOUT-T04' }] } });
    send({ type: 'agent_settled', aborted: mode === 'aborted', sessionId: secret });
  } else if (cmd.type === 'abort') {
    reply(cmd, {});
    send({ type: 'agent_settled', aborted: true });
  }
});
