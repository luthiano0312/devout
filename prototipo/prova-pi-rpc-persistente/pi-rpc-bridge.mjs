// Experimento isolado: OpenClaw -> HTTP loopback -> Node.js -> Pi RPC.
// Nao executa prompts de IA, comandos Git nem modifica skills.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOST = '127.0.0.1';
const PORT = 18790;
const piBin = join(homedir(), '.pi', 'agent', 'bin', process.platform === 'win32' ? 'pi.cmd' : 'pi');
const piArgs = [
  '--mode', 'rpc', '--no-session', '--no-tools', '--no-extensions',
  '--no-skills', '--no-context-files', '--offline',
];

// No Windows, .cmd precisa de um shell para executar; stdin/stdout
// do processo-filho permanecem em pipes controlados por Node.
const pi = spawn(piBin, piArgs, {
  shell: process.platform === 'win32',
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe'],
});
let buffer = '';
let counter = 0;
let alive = true;
let sessionId = null;
const pending = new Map();

function failPending(reason) {
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(new Error(reason));
  }
  pending.clear();
}

pi.stdout.setEncoding('utf8');
pi.stdout.on('data', (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, end).replace(/\r$/, '');
    buffer = buffer.slice(end + 1);
    if (!line.trim()) continue;
    let message;
    try { message = JSON.parse(line); }
    catch { console.error('Linha nao JSON recebida do Pi:', line.slice(0, 240)); continue; }
    if (message.type !== 'response' || !message.id) continue;
    const request = pending.get(message.id);
    if (!request) continue;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (!message.success) request.reject(new Error(message.error?.message || 'Resposta RPC sem sucesso'));
    else request.resolve(message);
  }
});

pi.stderr.setEncoding('utf8');
pi.stderr.on('data', (chunk) => console.error('Pi stderr:', chunk.trim().slice(0, 500)));
pi.on('error', (err) => { alive = false; failPending(`Falha ao iniciar Pi: ${err.message}`); });
pi.on('exit', (code, signal) => {
  alive = false;
  failPending(`Pi encerrou: code=${code}, signal=${signal}`);
  console.error(`Pi encerrou: code=${code}, signal=${signal}`);
});

function rpc(type) {
  if (!alive || !pi.stdin.writable) return Promise.reject(new Error('Pi nao esta disponivel'));
  const id = `bridge-${++counter}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout aguardando resposta a ${id}`));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    pi.stdin.write(JSON.stringify({ id, type }) + '\n', (err) => {
      if (err && pending.has(id)) {
        clearTimeout(timer);
        pending.delete(id);
        reject(err);
      }
    });
  });
}

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.writeHead(405); res.end(JSON.stringify({ error: 'Metodo nao permitido' })); return;
  }
  if (req.url === '/health') {
    res.writeHead(alive ? 200 : 503);
    res.end(JSON.stringify({ piAlive: alive, piPid: pi.pid, sessionId, pending: pending.size }));
    return;
  }
  if (req.url === '/state') {
    try {
      const response = await rpc('get_state');
      res.writeHead(200); res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(502); res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  res.writeHead(404); res.end(JSON.stringify({ error: 'Rota desconhecida' }));
});

server.on('error', (err) => {
  console.error('Falha no servidor HTTP:', err.message);
  shutdown(1);
});

function shutdown(code = 0) {
  server.close();
  failPending('Ponte encerrada');
  if (alive && pi.pid) {
    if (process.platform === 'win32') {
      // Encerra o cmd.exe e seu processo-filho (node/pi) da arvore desta prova.
      const killer = spawn('taskkill', ['/PID', String(pi.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('exit', () => process.exit(code));
      setTimeout(() => process.exit(code), 2000).unref();
      return;
    }
    pi.kill('SIGTERM');
  }
  process.exit(code);
}
process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

try {
  const first = await rpc('get_state');
  sessionId = first.data?.sessionId ?? null;
  server.listen(PORT, HOST, () => {
    console.log(`PONTE_PRONTA http://${HOST}:${PORT} | Pi PID=${pi.pid} | sessionId=${sessionId}`);
    console.log('Rotas: GET /health e GET /state | Para encerrar: Ctrl+C neste terminal');
  });
} catch (err) {
  console.error('Handshake RPC falhou:', err.message);
  shutdown(1);
}
