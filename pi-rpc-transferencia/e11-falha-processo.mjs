
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const pi = join(
  process.env.USERPROFILE || "",
  ".pi", "agent", "bin", "pi.cmd"
);

const flags = [
  "--mode", "rpc",
  "--no-session",
  "--no-tools",
  "--no-extensions",
  "--no-skills",
  "--no-context-files",
  "--offline"
];

if (process.platform !== "win32" || !existsSync(pi)) {
  console.error("ERRO: pi.cmd não encontrado no Windows.");
  process.exit(2);
}

function iniciarPi() {
  const proc = spawn(pi, flags, {
    shell: true,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });

  const instancia = {
    proc,
    encerrado: false,
    pendentes: new Map(),
    buffer: ""
  };

  instancia.fechamento = new Promise(resolve => {
    proc.once("close", (code, signal) => {
      instancia.encerrado = true;

      for (const req of instancia.pendentes.values()) {
        clearTimeout(req.timer);
        req.reject(new Error("Processo encerrado antes da resposta"));
      }

      instancia.pendentes.clear();
      resolve({ code, signal });
    });
  });

  proc.stdout.on("data", data => {
    instancia.buffer += data.toString();

    let pos;
    while ((pos = instancia.buffer.indexOf("\n")) >= 0) {
      const linha = instancia.buffer.slice(0, pos).trim();
      instancia.buffer = instancia.buffer.slice(pos + 1);

      if (!linha) continue;

      try {
        const msg = JSON.parse(linha);
        const req = instancia.pendentes.get(msg.id);

        if (req) {
          clearTimeout(req.timer);
          instancia.pendentes.delete(msg.id);
          req.resolve(msg);
        }
      } catch {}
    }
  });

  proc.stderr.on("data", data => {
    console.error("STDERR:", data.toString().trim());
  });

  proc.stdin.on("error", () => {});
  proc.on("error", err => console.error("PROCESS_ERROR:", err.message));

  console.log("PROCESS_START pid=" + proc.pid);
  return instancia;
}

function consultarEstado(instancia, id) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      instancia.pendentes.delete(id);
      reject(new Error("TIMEOUT_RPC " + id));
    }, 12000);

    instancia.pendentes.set(id, { resolve, reject, timer });

    instancia.proc.stdin.write(
      JSON.stringify({ id, type: "get_state" }) + "\n"
    );
  });
}

function encerrarArvore(instancia) {
  if (instancia.encerrado || !instancia.proc.pid) return false;

  try {
    execFileSync("taskkill.exe", [
      "/PID", String(instancia.proc.pid),
      "/T", "/F"
    ], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 5000
    });

    return true;
  } catch {
    return false;
  }
}

function comTimeout(promise, ms) {
  let timer;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("TIMEOUT_WAIT_CLOSE")), ms
      );
    })
  ]).finally(() => clearTimeout(timer));
}

const instancias = [];
let aprovado = false;

try {
  const primeiro = iniciarPi();
  instancias.push(primeiro);

  const antes = await consultarEstado(primeiro, "e11-before");

  if (!antes.success || !antes.data?.sessionId) {
    throw new Error("Primeiro get_state falhou");
  }

  console.log("BEFORE sessionId=" + antes.data.sessionId);

  const killed = encerrarArvore(primeiro);
  console.log("FORCE_KILL success=" + killed);

  if (!killed) {
    throw new Error("Não foi possível encerrar o primeiro Pi");
  }

  const saida = await comTimeout(primeiro.fechamento, 12000);
  console.log("UNEXPECTED_EXIT code=" + saida.code);

  // Só iniciar o segundo depois de confirmar o encerramento.
  const segundo = iniciarPi();
  instancias.push(segundo);

  const depois = await consultarEstado(segundo, "e11-after");

  if (!depois.success || !depois.data?.sessionId) {
    throw new Error("Segundo get_state falhou");
  }

  console.log("AFTER sessionId=" + depois.data.sessionId);

  segundo.proc.stdin.end();

  const final = await comTimeout(segundo.fechamento, 12000);
  console.log("RESTART_EXIT code=" + final.code);

  aprovado =
    antes.data.sessionId !== depois.data.sessionId &&
    final.code === 0;

} catch (erro) {
  console.error("TEST_ERROR:", erro.message);

} finally {
  for (const instancia of instancias) {
    if (!instancia.encerrado) {
      encerrarArvore(instancia);
    }
  }
}

console.log("TEST_RESULT", aprovado ? "PASS" : "FAIL");
process.exitCode = aprovado ? 0 : 1;
