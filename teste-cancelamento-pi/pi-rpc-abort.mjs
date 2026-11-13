// E09 — Prova controlada de cancelamento do Pi RPC, Windows nativo.
// Um unico Pi, stdin aberto, sem ferramentas, sem edicao de arquivos e sem sessao salva.
// O comando abort e enviado apos o primeiro evento de atualizacao do modelo,
// ou apos um prazo de seguranca se o modelo ainda nao transmitiu nenhum delta.
import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (process.platform !== 'win32' || !process.env.USERPROFILE) {
  console.error('ERRO: este teste foi preparado para Windows nativo.');
  process.exit(2);
}
const piCmd = join(process.env.USERPROFILE, '.pi', 'agent', 'bin', 'pi.cmd');
if (!existsSync(piCmd)) {
  console.error(`ERRO: Pi nao encontrado em ${piCmd}`);
  process.exit(2);
}

// Mantem o padrao de spawn ja validado no Windows do experimento anterior.
// Argumentos e caminho sao fixos/conhecidos. Nao incorporar dados externos
// no comando quando shell:true; trataremos DEP0190 fora desta prova.
const child = spawn(piCmd, [
  '--mode', 'rpc', '--no-session', '--no-tools',
  '--no-extensions', '--no-skills', '--no-context-files',
], { shell: true, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

const counts = {};
const T = { prompt: false, started: false, abortSent: false, abortAck: false,
            settled: false, settledAborted: null, stateRequested: false,
            idle: false, lastStop: 'n/a', timeout: false,
            invalid: 0, closed: false, stderr: '' };
let buffer = Buffer.alloc(0);
let fallbackTimer;
let forceKillTimer;

function send(cmd) {
  if (child.stdin.destroyed || child.stdin.writableEnded) {
    console.error(`STDIN_INDISPONIVEL command=${cmd.type}`);
    return false;
  }
  child.stdin.write(JSON.stringify(cmd) + '\n');
  return true;
}
function shutdown() {
  clearTimeout(fallbackTimer);
  if (!child.stdin.destroyed && !child.stdin.writableEnded) child.stdin.end();
}
function abortNow(reason) {
  if (!T.started || T.abortSent || T.settled) return;
  T.abortSent = send({ id: 'e09-abort', type: 'abort' });
  if (T.abortSent) console.log(`ABORT_SENT reason=${reason}`);
}
function checkAfterAbort() {
  if (T.abortAck && T.settled && !T.stateRequested) {
    T.stateRequested = send({ id: 'e09-state', type: 'get_state' });
    if (T.stateRequested) console.log('STATE_REQUESTED after_abort');
    else shutdown();
  }
}
function onRecord(m) {
  const type = String(m.type || 'unknown');
  counts[type] = (counts[type] || 0) + 1;
  if (type === 'response') {
    if (m.id === 'e09-prompt') {
      T.prompt = m.success === true && m.command === 'prompt' && m.data?.disposition === 'started';
      console.log(`PROMPT_RESPONSE success=${m.success} disposition=${m.data?.disposition ?? 'n/a'}`);
      if (!T.prompt) { console.error(`PROMPT_ERROR ${String(m.error ?? 'sem detalhes').slice(0, 300)}`); shutdown(); }
    } else if (m.id === 'e09-abort') {
      T.abortAck = m.success === true && m.command === 'abort';
      console.log(`ABORT_RESPONSE success=${m.success} error=${String(m.error ?? 'none').slice(0, 200)}`);
      checkAfterAbort();
    } else if (m.id === 'e09-state') {
      T.idle = m.success === true && m.command === 'get_state' && m.data?.isStreaming === false;
      console.log(`STATE_RESPONSE success=${m.success} isStreaming=${m.data?.isStreaming ?? 'n/a'}`);
      shutdown();
    }
  } else if (type === 'agent_start') {
    T.started = true;
    console.log('EVENT agent_start');
    // Fallback para modelos lentos que nao emitiram delta; ainda exige agent_start.
    fallbackTimer = setTimeout(() => abortNow('fallback_10s_without_delta'), 10000);
  } else if (type === 'message_update') {
    const ev = m.assistantMessageEvent?.type || 'unknown';
    if (!T.abortSent && T.started) abortNow(`first_message_update_${ev}`);
  } else if (type === 'message_end' && m.message?.role === 'assistant') {
    T.lastStop = m.message?.stopReason ?? 'n/a';
    console.log(`MESSAGE_END assistant stopReason=${T.lastStop}`);
    if (m.message?.errorMessage) console.error(`MODEL_MESSAGE ${String(m.message.errorMessage).slice(0, 300)}`);
  } else if (type === 'agent_settled') {
    T.settled = true;
    T.settledAborted = m.aborted ?? null;
    console.log(`AGENT_SETTLED aborted=${T.settledAborted ?? 'n/a'}`);
    clearTimeout(fallbackTimer);
    if (!T.abortSent) {
      console.error('INCONCLUSIVO: tarefa terminou antes do pedido de abort.');
      shutdown();
    } else checkAfterAbort();
  } else if (type === 'turn_start' || type === 'turn_end' || type === 'agent_end') {
    console.log(`EVENT ${type}`);
  }
}

child.stdout.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk]);
  let ix;
  while ((ix = buffer.indexOf(10)) >= 0) {
    const raw = buffer.subarray(0, ix);
    buffer = buffer.subarray(ix + 1);
    const line = raw.toString('utf8').replace(/\r$/, '');
    if (!line) continue;
    try { onRecord(JSON.parse(line)); }
    catch { T.invalid++; console.error(`INVALID_JSON count=${T.invalid}`); }
  }
  if (buffer.length > 8 * 1024 * 1024) {
    T.invalid++; console.error('ERRO: linha JSON maior que 8MiB'); shutdown();
  }
});
child.stderr.on('data', data => { T.stderr = (T.stderr + data.toString('utf8')).slice(-1200); });
child.stdin.on('error', err => console.error(`STDIN_ERROR ${err.message}`));
child.on('error', err => console.error(`PROCESS_ERROR ${err.message}`));

// Timeout global: sinaliza abort e encerra apenas esta arvore de teste.
const deadline = setTimeout(() => {
  T.timeout = true;
  console.error('TIMEOUT_GLOBAL 90s');
  if (T.started && !T.abortSent && !T.settled) abortNow('timeout_90s');
  shutdown();
  forceKillTimer = setTimeout(() => {
    if (!T.closed && child.pid) {
      execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide:true }, () => {});
    }
  }, 5000);
}, 90000);

child.on('close', (code, signal) => {
  T.closed = true;
  clearTimeout(deadline); clearTimeout(fallbackTimer); clearTimeout(forceKillTimer);
  console.log(`EVENT_COUNTS ${JSON.stringify(counts)}`);
  console.log(`PI_EXIT code=${code} signal=${signal || 'none'}`);
  if (T.stderr.trim()) console.error(`STDERR (oculte dados sensiveis antes de compartilhar): ${T.stderr.trim()}`);
  const ok = T.prompt && T.started && T.abortSent && T.abortAck &&
    T.settled && T.settledAborted === true && T.idle &&
    !T.timeout && T.invalid === 0 && code === 0;
  console.log(`TEST_RESULT ${ok ? 'PASS' : 'FAIL'}`);
  process.exitCode = ok ? 0 : 1;
});

console.log(`PI_PROCESS pid=${child.pid ?? 'n/a'}`);
send({
  id: 'e09-prompt', type: 'prompt',
  message: 'Escreva os numeros inteiros de 1 ate 1500, um por linha, sem explicacoes, sem abreviar, sem resumir e sem pular nenhum numero.'
});
