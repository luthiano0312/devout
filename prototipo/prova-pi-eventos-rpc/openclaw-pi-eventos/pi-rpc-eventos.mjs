// Prova de eventos RPC: um processo Pi, um prompt, stdin aberto ate agent_settled.
// Windows nativo; sem ferramentas, skills, extensoes ou arquivos de contexto.
import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const userHome = process.env.USERPROFILE;
if (!userHome || process.platform !== 'win32') {
  console.error('ERRO: este experimento foi preparado para Windows nativo.');
  process.exit(2);
}
const piCmd = join(userHome, '.pi', 'agent', 'bin', 'pi.cmd');
if (!existsSync(piCmd)) {
  console.error(`ERRO: Pi nao encontrado em ${piCmd}`);
  process.exit(2);
}

const flags = [
  '--mode', 'rpc', '--no-session', '--no-tools',
  '--no-extensions', '--no-skills', '--no-context-files',
];
// Executar .cmd atraves do cmd.exe, preservando pipes stdin/stdout separados.
const command = `"${piCmd}" ${flags.join(' ')}`;
const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
  stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
});

const counts = {};
let stdoutBuffer = Buffer.alloc(0);
let acknowledged = false;
let settled = false;
let assistantText = '';
let assistantError = false;
let timedOut = false;
let invalidRecords = 0;
let stderrTail = '';
let closed = false;
let killTimer;

function stopGracefully() {
  if (!child.stdin.destroyed && !child.stdin.writableEnded) child.stdin.end();
}

function handleRecord(msg) {
  const type = String(msg.type || 'unknown');
  counts[type] = (counts[type] || 0) + 1;
  if (type === 'response' && msg.id === 'oc-pi-eventos-2') {
    acknowledged = msg.success === true && msg.command === 'prompt';
    console.log(`RESPONSE success=${msg.success} disposition=${msg.data?.disposition ?? 'n/a'}`);
    if (!msg.success) {
      console.error(`RPC_ERRO: ${String(msg.error || 'sem detalhes').slice(0, 400)}`);
      stopGracefully();
    }
  } else if (type === 'message_update' && msg.assistantMessageEvent?.type === 'text_delta') {
    // A resposta final em message_end e a fonte preferencial.
    assistantText += msg.assistantMessageEvent.delta || '';
  } else if (type === 'message_end' && msg.message?.role === 'assistant') {
    const finalContent = msg.message.content;
    if (Array.isArray(finalContent)) {
      const finalText = finalContent.filter(x => x.type === 'text').map(x => x.text || '').join('');
      if (finalText) assistantText = finalText;
    }
    assistantError ||= ['error', 'aborted'].includes(msg.message.stopReason) || Boolean(msg.message.errorMessage);
    console.log(`MESSAGE_END assistant stopReason=${msg.message.stopReason || 'n/a'}`);
    if (msg.message.errorMessage) console.error(`MODEL_ERRO: ${String(msg.message.errorMessage).slice(0, 400)}`);
  } else if (type === 'agent_settled') {
    settled = true;
    console.log(`AGENT_SETTLED aborted=${msg.aborted ?? 'n/a'}`);
    if (msg.aborted === true) assistantError = true;
    stopGracefully();
  } else if (type === 'agent_start' || type === 'agent_end' || type === 'turn_start' || type === 'turn_end') {
    console.log(`EVENT ${type}`);
  } else if (type === 'auto_retry_start' || type === 'extension_error') {
    console.log(`EVENT ${type}`);
  }
}

child.stdout.on('data', chunk => {
  stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
  let index;
  while ((index = stdoutBuffer.indexOf(10)) >= 0) {
    const lineBytes = stdoutBuffer.subarray(0, index);
    stdoutBuffer = stdoutBuffer.subarray(index + 1);
    const line = lineBytes.toString('utf8').replace(/\r$/, '').trim();
    if (!line) continue;
    try {
      handleRecord(JSON.parse(line));
    } catch {
      invalidRecords += 1;
      console.error(`INVALID_JSON registro=${invalidRecords}`);
    }
  }
  if (stdoutBuffer.length > 8 * 1024 * 1024) {
    console.error('ERRO: linha JSON maior que 8 MiB');
    stopGracefully();
  }
});
child.stderr.on('data', chunk => {
  stderrTail = (stderrTail + chunk.toString('utf8')).slice(-1200);
});
child.on('error', err => {
  console.error(`PROCESSO_ERRO: ${err.message}`);
});

const timeout = setTimeout(() => {
  timedOut = true;
  console.error('TIMEOUT: agent_settled nao chegou em 120 segundos; solicitando abort.');
  if (!child.stdin.destroyed && !child.stdin.writableEnded) {
    child.stdin.write(JSON.stringify({ type: 'abort', id: 'oc-pi-abort-timeout' }) + '\n');
  }
  setTimeout(stopGracefully, 2500).unref();
  // Ultimo recurso: encerrar somente a arvore deste processo de teste.
  killTimer = setTimeout(() => {
    if (!closed && child.pid) {
      execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
    }
  }, 10000);
  killTimer.unref();
}, 120000);

timeout.unref();

child.on('close', (code, signal) => {
  closed = true;
  clearTimeout(timeout);
  if (killTimer) clearTimeout(killTimer);
  console.log(`EVENT_COUNTS ${JSON.stringify(counts)}`);
  console.log(`ASSISTANT_TEXT ${JSON.stringify(assistantText.slice(0, 500))}`);
  console.log(`PI_EXIT code=${code} signal=${signal || 'none'}`);
  if (stderrTail.trim()) console.error(`STDERR (revise/remova segredos antes de compartilhar): ${stderrTail.trim()}`);
  const ok = acknowledged && settled && !assistantError && !timedOut && invalidRecords === 0 &&
    assistantText.includes('PONG-EVENTOS') && code === 0;
  console.log(`TEST_RESULT ${ok ? 'PASS' : 'FAIL'}`);
  process.exitCode = ok ? 0 : 1;
});

child.stdin.on('error', err => console.error(`STDIN_ERRO: ${err.message}`));
const prompt = { id: 'oc-pi-eventos-2', type: 'prompt', message: 'Responda somente: PONG-EVENTOS.' };
child.stdin.write(JSON.stringify(prompt) + '\n');
console.log(`PI_PROCESS pid=${child.pid ?? 'n/a'}; stdin mantido aberto ate agent_settled`);
