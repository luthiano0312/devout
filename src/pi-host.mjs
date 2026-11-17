// Private, short-lived launch gate. No Pi descendant exists until the Driver
// has put this host in a non-breakaway Windows Job Object.
import { spawn } from 'node:child_process';
let started = false;
const deadline = setTimeout(() => process.exit(71), 30_000);
process.on('disconnect', () => { if (!started) process.exit(72); });
process.once('message', spec => {
  started = true;
  clearTimeout(deadline);
  const child = spawn(spec.file, spec.args, {
    ...spec.options, stdio: [0, 1, 2],
  });
  child.once('spawn', () => process.send?.({ type: 'launched' }));
  child.once('error', () => process.exit(73));
  child.once('exit', code => process.exit(code ?? 74));
});
process.send?.({ type: 'waiting' });
