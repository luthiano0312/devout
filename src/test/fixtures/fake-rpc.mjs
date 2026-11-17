// Harmless child for transport tests. Only Node stdin/stdout, no tools/network.
import { createInterface } from 'node:readline';
const mode = process.argv[2];
const send = record => process.stdout.write(JSON.stringify(record) + '\n');
const reply = (cmd, data = {}) => ({ type: 'response', id: cmd.id, command: cmd.type, success: true, data });
let held;
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('close', () => { if (mode === 'bad-exit') process.exitCode = 7; });
if (mode === 'idle-eof') setTimeout(() => process.exit(0), 50);
input.on('line', line => {
  const cmd = JSON.parse(line);
  if (mode === 'silent') return;
  if (mode === 'invalid') { process.stdout.write('not json\n'); return; }
  if (mode === 'invalid-utf8') { process.stdout.write(Buffer.from([0xff, 10])); return; }
  if (mode === 'invalid-shape') { send([]); return; }
  if (mode === 'oversize') { process.stdout.write('x'.repeat(4097)); return; }
  if (mode === 'oversize-line') { process.stdout.write('x'.repeat(4097) + '\n'); return; }
  if (mode === 'truncated') { process.stdout.write('{"type":'); process.exitCode = 0; input.close(); process.stdin.destroy(); return; }
  if (mode === 'eof') { process.exit(0); }
  if (mode === 'error') { send({ ...reply(cmd), success: false, error: 'synthetic rejection' }); return; }
  if (mode === 'mismatch') { send({ ...reply(cmd), command: 'other' }); return; }
  if (mode === 'no-id') { send({ type: 'response', command: 'parse', success: false }); return; }
  if (mode === 'conflicting-id') { send({ ...reply(cmd), requestId: 'other' }); return; }
  if (mode === 'invalid-success') { send({ ...reply(cmd), success: 'true' }); return; }
  if (mode === 'unmatched') { send({ ...reply(cmd), id: 'unknown' }); return; }
  if (mode === 'request-id') { const r = reply(cmd); delete r.id; send({ ...r, requestId: cmd.id }); return; }
  if (mode === 'reorder') {
    if (!held) { held = cmd; return; }
    send({ type: 'agent_start', id: held.id }); // events never resolve commands
    send(reply(cmd, { marker: cmd.marker }));
    send(reply(held, { marker: held.marker }));
    held = null;
    return;
  }
  if (cmd.type === 'get_state') {
    if (mode === 'fragmented') {
      const bytes = Buffer.from(JSON.stringify(reply(cmd, { text: 'aç😀\u2028\u2029z' })) + '\r\n');
      const split = bytes.indexOf(Buffer.from('😀')) + 2;
      process.stdout.write(bytes.subarray(0, split));
      setTimeout(() => process.stdout.write(bytes.subarray(split)), 10);
    } else {
      process.stderr.write('diagnostic-not-json\n');
      send(reply(cmd, { isStreaming: false }));
    }
    return;
  }
  const response = reply(cmd, { disposition: mode === 'handled' ? 'handled' : 'started' });
  if (mode === 'handled') { send(response); return; }
  const events = [
    { type: 'agent_start' },
    { type: 'message_end', message: { role: 'assistant', stopReason: mode === 'model-error' ? 'error' : 'stop' } },
    { type: 'agent_end' },
    { type: 'agent_settled', aborted: mode === 'aborted' },
  ];
  if (mode === 'settled-first') {
    process.stdout.write(events.concat(response).map(x => JSON.stringify(x)).join('\n') + '\n');
  } else {
    send(response);
    send(events[0]);
    send(events[1]);
    send(events[2]);
    if (mode === 'no-settled') return;
    if (mode === 'exit-after-end') { process.exit(0); }
    setTimeout(() => send(events[3]), 70);
  }
});
