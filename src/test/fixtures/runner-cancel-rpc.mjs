// Disposable streaming/forced termination targets for T05. No real data/tools.
import { createInterface } from 'node:readline';
const mode = process.argv[2];
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const reply = (cmd, data) => send({ type: 'response', id: cmd.id, command: cmd.type, success: true, data });
let streaming;
const input = createInterface({ input: process.stdin });
input.on('line', line => {
  const cmd = JSON.parse(line);
  if (cmd.type === 'get_state') reply(cmd, { model: { id: 'fictional' }, isStreaming: false });
  if (cmd.type === 'prompt') {
    reply(cmd, { disposition: 'started' });
    send({ type: 'agent_start' });
    streaming = setInterval(() => send({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'FICTIONAL-T05' } }), 50);
  }
  if (cmd.type === 'abort' && mode !== 'force') {
    clearInterval(streaming);
    reply(cmd, {});
    send({ type: 'agent_settled', aborted: true });
  }
});
input.on('close', () => { if (mode !== 'force') clearInterval(streaming); });
