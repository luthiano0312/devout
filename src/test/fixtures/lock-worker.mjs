import { acquirePiLock } from '../../pi-lock.mjs';

process.send({ type: 'ready' });
let lease;
process.once('message', async config => {
  try {
    lease = await acquirePiLock({ root: config.root, runId: config.runId });
    if (config.launch) {
      const d = await lease.launch({ piCmd: config.piCmd, cwd: config.cwd, normalWaitMs: 3000, pollMs: 20 });
      await d.getState();
      await d.inspectTree();
      process.send({ type: 'acquired', token: lease.token, identity: d.processTree.identity,
        observed: [...d.observed.values()] });
    } else process.send({ type: 'acquired', token: lease.token });
    process.once('message', async command => {
      try {
        if (command === 'finish') {
          const result = await lease.finish({ cancel: true });
          process.send({ type: 'released', canRelease: result.termination?.canRelease ?? true });
        } else await lease.abandon();
        process.disconnect();
      } catch (error) { process.send({ type: 'error', code: error.code }); process.disconnect(); }
    });
  } catch (error) {
    process.send({ type: 'blocked', code: error.code });
    // A failed acquisition must close its helper and leave no owned child.
    process.disconnect();
  }
});
