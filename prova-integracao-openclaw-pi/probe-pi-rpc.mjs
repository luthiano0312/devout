// Prova de integração: Pi RPC pelo stdio, sem dependências externas.
// Uso: node .\probe-pi-rpc.mjs              (handshake, sem LLM)
//      node .\probe-pi-rpc.mjs --prompt     (handshake + LLM)
// Execute em uma pasta descartável, no Windows nativo.
import { spawn, execFile } from 'node:child_process';
import { createWriteStream, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { platform, release } from 'node:os';

const promptEnabled = process.argv.includes('--prompt');
const marker = 'PONG-OPENCLAW-PI';
const started = Date.now();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(process.cwd(), 'resultados');
mkdirSync(outDir, { recursive: true });
const eventsFile = join(outDir, `${stamp}-eventos.jsonl`);
const resultFile = join(outDir, `${stamp}-resultado.json`);
const events = createWriteStream(eventsFile, { encoding: 'utf8' });
const result = {
  startedAt: new Date(started).toISOString(),
  mode: promptEnabled ? 'prompt' : 'handshake',
  environment: { platform: platform(), osRelease: release(), node: process.version, cwd: process.cwd() },
  rpc: { getState: false, promptAccepted: false, settled: false, eventCount: 0, types: {}, assistantText: '', model: null },
  status: 'RUNNING', errors: [], eventsFile,
};

if (platform() !== 'win32') {
  result.status = 'FAILED';
  result.errors.push('Este experimento foi definido para Windows nativo (process.platform=win32).');
  writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
  events.end();
  console.error('FALHOU: sistema diferente de Windows nativo:', platform());
  process.exit(2);
}

const piArgs = [
  '--mode', 'rpc', '--no-session', '--no-tools', '--no-extensions',
  '--no-skills', '--no-prompt-templates', '--no-context-files', '--no-approve',
];
// No Windows, o executável global do npm é normalmente um .cmd.
// Invocamos cmd.exe só para resolver esse launcher, mantendo stdio em pipes.
const pi = spawn('cmd.exe', ['/d', '/s', '/c', `pi ${piArgs.join(' ')}`], {
  cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
});
console.log(`Pi RPC iniciado (PID do launcher: ${pi.pid ?? 'indisponível'}).`);
console.log('Experimento:', result.mode, '| Ambiente:', platform(), '| Pasta:', process.cwd());
console.log('Log:', eventsFile);

let outputBuffer = '';
const decoder = new StringDecoder('utf8');
let stderrTail = '';
let finished = false;
let shuttingDown = false;
let promptAcknowledged = false;
let settled = false;
let assistantError = false;
let forceTimer;
let forceTriggered = false;

function send(obj) {
  if (pi.stdin.destroyed) throw new Error('stdin do Pi foi encerrado.');
  pi.stdin.write(JSON.stringify(obj) + '\n', 'utf8');
  console.log('ENVIADO:', obj.type, 'id=' + obj.id);
}
function finish(success, reason) {
  if (finished) return;
  finished = true;
  result.status = success ? 'PASS' : 'FAIL'; // Provisório até confirmar a saída do processo.
  if (reason) result.errors.push(reason);
  result.rpc.settled = settled;
  result.rpc.assistantText = result.rpc.assistantText.trim();
  events.end();
  shuttingDown = true;
  clearTimeout(watchdog);
  pi.stdin.end(); // Desligamento ordenado, conforme documentação RPC.
  forceTimer = setTimeout(() => {
    forceTriggered = true;
    console.error('Processo ainda ativo após stdin EOF; encerrando árvore do launcher.');
    if (pi.pid) execFile('taskkill.exe', ['/PID', String(pi.pid), '/T', '/F'], () => {});
  }, 4000);
}
function maybeFinishPrompt() {
  if (!promptAcknowledged || !settled) return;
  const ok = !assistantError && result.rpc.assistantText.trim() === marker;
  finish(ok, ok ? undefined : 'Resposta diferente do marcador esperado ou erro do modelo.');
}
function onRecord(record) {
  if (finished) return;
  result.rpc.eventCount++;
  result.rpc.types[record.type] = (result.rpc.types[record.type] || 0) + 1;
  events.write(JSON.stringify(record) + '\n');
  if (record.type === 'response' && record.id === 'state-1') {
    if (!record.success) return finish(false, `get_state falhou: ${record.error || 'sem detalhe'}`);
    result.rpc.getState = true;
    result.rpc.model = record.data?.model ? { provider: record.data.model.provider, id: record.data.model.id } : null;
    console.log('RECEBIDO: get_state, sessão=', record.data?.sessionId ?? '<indisponível>', 'modelo=', JSON.stringify(result.rpc.model));
    if (!promptEnabled) return finish(true);
    send({ id: 'prompt-1', type: 'prompt', message: `Este é um teste técnico de comunicação. Responda SOMENTE com ${marker} sem pontuação, espaços ou explicações.` });
  }
  if (record.type === 'response' && record.id === 'prompt-1') {
    if (!record.success) return finish(false, `prompt rejeitado: ${record.error || 'sem detalhe'}`);
    const disposition = record.data?.disposition;
    if (disposition !== 'started') return finish(false, `prompt não iniciou uma execução: ${disposition || '<não informado>'}`);
    promptAcknowledged = true;
    result.rpc.promptAccepted = true;
    console.log('RECEBIDO: prompt aceito (started), aguardando agent_settled...');
    maybeFinishPrompt();
  }
  if (record.type === 'message_end' && record.message?.role === 'assistant') {
    const m = record.message;
    result.rpc.assistantText = (m.content ?? []).filter(c => c?.type === 'text').map(c => c.text ?? '').join('');
    if (m.stopReason === 'error' || m.stopReason === 'aborted') {
      assistantError = true;
      if (m.errorMessage) result.errors.push(m.errorMessage);
    }
  }
  if (record.type === 'agent_settled') {
    settled = true;
    if (record.aborted) assistantError = true;
    console.log('RECEBIDO: agent_settled (aborted=' + Boolean(record.aborted) + ')');
    maybeFinishPrompt();
  }
}
function acceptText(text) {
  outputBuffer += text;
  let pos;
  while ((pos = outputBuffer.indexOf('\n')) !== -1) {
    let line = outputBuffer.slice(0, pos);
    outputBuffer = outputBuffer.slice(pos + 1);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (!line) continue;
    try { onRecord(JSON.parse(line)); }
    catch (error) { finish(false, 'Registro RPC inválido: ' + error.message + ' | trecho=' + line.slice(0, 100)); }
  }
}
pi.stdout.on('data', chunk => acceptText(decoder.write(chunk)));
pi.stderr.on('data', chunk => { stderrTail = (stderrTail + chunk.toString('utf8')).slice(-3000); });
pi.on('error', err => finish(false, 'Falha ao iniciar cmd.exe/Pi: ' + err.message));
pi.on('close', (code, signal) => {
  if (forceTimer) clearTimeout(forceTimer);
  if (!shuttingDown) finish(false, `Pi encerrou inesperadamente (code=${code}, signal=${signal}). ${stderrTail}`);
  result.shutdown = { exitCode: code, signal, forced: forceTriggered };
  if (code !== 0 || forceTriggered) {
    result.status = 'FAIL';
    result.errors.push(`Falha no encerramento do Pi (code=${code}, forced=${forceTriggered}).`);
  }
  result.durationMs = Date.now() - started;
  result.finishedAt = new Date().toISOString();
  console.log('\nRESULTADO:', result.status, result.errors.length ? '(' + result.errors.join(' | ') + ')' : '');
  if (promptEnabled) console.log('RESPOSTA FINAL:', result.rpc.assistantText || '<vazia>');
  console.log('Resumo:', resultFile);
  writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
  if (stderrTail) console.log('Diagnóstico stderr (trecho):', stderrTail.slice(-500));
  process.exitCode = result.status === 'PASS' ? 0 : 1;
});
const watchdog = setTimeout(() => {
  finish(false, `Tempo máximo de ${promptEnabled ? 120 : 30}s excedido. ${stderrTail.slice(-500)}`);
}, promptEnabled ? 120000 : 30000);
send({ id: 'state-1', type: 'get_state' });
