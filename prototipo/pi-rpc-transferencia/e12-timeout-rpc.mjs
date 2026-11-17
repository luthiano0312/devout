
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const piCmd = join(
  process.env.USERPROFILE || '',
  '.pi', 'agent', 'bin', 'pi.cmd'
);

const flags = [
  '--mode', 'rpc',
  '--no-session',
  '--no-tools',
  '--no-extensions',
  '--no-skills',
  '--no-context-files',
  '--offline'
];

function whenClosed(proc) {
  return new Promise(resolve =>
    proc.once('close', (code, signal) =>
      resolve({ code, signal })
    )
  );
}

async function deadline(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('PROCESS_CLOSE_TIMEOUT')),
          ms
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function getState(proc, id, ms) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let done = false;

    const timer = setTimeout(
      () => finish(new Error('RPC_TIMEOUT')), ms
    );

    const onExit = () =>
      finish(new Error('PROCESS_EXIT_BEFORE_RESPONSE'));

    function finish(error, value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      proc.stdout.off('data', onData);
      proc.off('close', onExit);

      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk) {
      buffer += chunk.toString();
      let pos;

      while ((pos = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, pos).trim();
        buffer = buffer.slice(pos + 1);

        try {
          const msg = JSON.parse(line);

          if (msg.type === 'response' && msg.id === id) {
            return finish(null, msg);
          }
        } catch {
          // Ignora linhas não JSON.
        }
      }
    }

    proc.stdout.on('data', onData);
    proc.once('close', onExit);

    proc.stdin.write(
      JSON.stringify({ id, type: 'get_state' }) + '\n',
      error => {
        if (error) finish(error);
      }
    );
  });
}

let fake;
let pi;
let pass = false;

try {
  // Simulador: aceita stdin, mas nunca responde.
  fake = spawn(
    process.execPath,
    ['-e', 'process.stdin.resume(); setInterval(()=>{},1000)'],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    }
  );

  const fakeClosed = whenClosed(fake);
  let timedOut = false;

  try {
    await getState(fake, 'e12-sem-resposta', 1500);
  } catch (error) {
    timedOut = error.message === 'RPC_TIMEOUT';

    console.log(
      'SIMULATED_RPC_TIMEOUT=' + timedOut +
      ' detail=' + error.message
    );
  }

  if (!timedOut) {
    throw new Error('Timeout não detectado');
  }

  fake.kill();
  const fakeExit = await deadline(fakeClosed, 5000);

  console.log(
    'UNRESPONSIVE_PROCESS_EXIT code=' + fakeExit.code +
    ' signal=' + fakeExit.signal
  );

  // Inicia o Pi real somente depois do encerramento.
  if (!existsSync(piCmd)) {
    throw new Error('PI_NOT_FOUND ' + piCmd);
  }

  pi = spawn(piCmd, flags, {
    shell: true,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const piClosed = whenClosed(pi);

  const response = await getState(
    pi, 'e12-recovery', 20000
  );

  console.log(
    'RECOVERY_RPC success=' + response.success +
    ' sessionId=' + response.data?.sessionId
  );

  pi.stdin.end();

  const piExit = await deadline(piClosed, 10000);

  console.log('RECOVERY_PI_EXIT code=' + piExit.code);

  pass =
    !!response.success &&
    !!response.data?.sessionId &&
    piExit.code === 0;

} catch (error) {
  console.error('TEST_ERROR ' + error.message);

} finally {
  if (fake && fake.exitCode === null && !fake.killed) {
    fake.kill();
  }

  if (pi && pi.exitCode === null && pi.pid) {
    try {
      execFileSync(
        'taskkill.exe',
        ['/PID', String(pi.pid), '/T', '/F'],
        {
          stdio: 'ignore',
          windowsHide: true,
          timeout: 5000
        }
      );
    } catch {
      console.error(
        'CLEANUP_WARNING: confira se o Pi do teste foi encerrado'
      );
    }
  }
}

console.log('TEST_RESULT ' + (pass ? 'PASS' : 'FAIL'));
process.exitCode = pass ? 0 : 1;
