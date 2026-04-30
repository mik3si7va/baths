const cors = require("cors");
const express = require("express");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

require("dotenv").config();

const app = express();

const PORT = Number(process.env.CLIENT_APP_BACKEND_PORT || 5001);
const CLIENT_ORIGIN = process.env.CLIENT_APP_FRONTEND_URL || "http://localhost:3002";
const TARGET_BACKEND_URL = process.env.ORIGINAL_BACKEND_URL || "http://localhost:5000";
const ORIGINAL_BACKEND_DIR = path.resolve(__dirname, "../../../backend");
const ROOT_DIR = path.resolve(__dirname, "../../..");

let originalBackendProcess = null;

app.use(cors({ origin: CLIENT_ORIGIN }));

function getTarget() {
  const url = new URL(TARGET_BACKEND_URL);
  return {
    hostname: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    protocol: url.protocol,
  };
}

function isPortOpen(hostname, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port });

    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });

    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(hostname, port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isPortOpen(hostname, port)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} terminou com codigo ${code}`));
    });
  });
}

function getChildEnv(extraEnv = {}) {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...extraEnv }).filter(
      ([key, value]) => key && !key.startsWith("=") && value !== undefined
    )
  );
}

function getNpmCommand(scriptName) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", "run", scriptName],
    };
  }

  return {
    command: "npm",
    args: ["run", scriptName],
  };
}

async function startDatabaseIfNeeded() {
  if (process.env.CLIENT_APP_SKIP_DB_UP === "true") {
    console.log("A saltar arranque automatico da DB.");
    return;
  }

  const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

  console.log("A acordar PostgreSQL do projeto principal...");
  await runCommand(
    dockerCommand,
    ["compose", "-f", path.join(ROOT_DIR, "docker-compose.yml"), "up", "-d", "postgres"],
    { cwd: ROOT_DIR }
  );
}

async function startOriginalBackendIfNeeded() {
  const target = getTarget();
  const isLocalTarget = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);

  if (!isLocalTarget) {
    console.log(`AppClient backend vai usar backend externo: ${TARGET_BACKEND_URL}`);
    return;
  }

  if (await isPortOpen(target.hostname, target.port)) {
    console.log(`Backend original ja esta ativo em ${TARGET_BACKEND_URL}.`);
    return;
  }

  await startDatabaseIfNeeded();

  const npmStart = getNpmCommand("start");

  console.log(`A arrancar backend original em ${ORIGINAL_BACKEND_DIR}...`);
  originalBackendProcess = spawn(npmStart.command, npmStart.args, {
    cwd: ORIGINAL_BACKEND_DIR,
    env: getChildEnv({ PORT: String(target.port) }),
    stdio: "inherit",
  });

  originalBackendProcess.once("exit", (code, signal) => {
    originalBackendProcess = null;
    if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGINT") {
      console.error(`Backend original terminou com code=${code} signal=${signal}.`);
    }
  });

  if (await waitForPort(target.hostname, target.port)) {
    console.log(`Backend original ativo em ${TARGET_BACKEND_URL}.`);
    return;
  }

  console.warn(
    `Backend original ainda nao respondeu em ${TARGET_BACKEND_URL}; o mirror continua ativo.`
  );
}

function proxyToOriginalBackend(req, res) {
  const targetUrl = new URL(req.originalUrl, TARGET_BACKEND_URL);
  const target = getTarget();

  const proxyReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers: {
        ...req.headers,
        host: targetUrl.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    console.error("Falha ao contactar backend original:", error.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: "Backend original indisponivel.",
        target: TARGET_BACKEND_URL,
      });
    }
  });

  req.pipe(proxyReq);
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "AppClient backend mirror",
    target: TARGET_BACKEND_URL,
  });
});

app.use(proxyToOriginalBackend);

async function shutdown() {
  if (originalBackendProcess) {
    originalBackendProcess.kill("SIGTERM");
  }
  process.exit(0);
}

async function main() {
  await startOriginalBackendIfNeeded();

  app.listen(PORT, () => {
    console.log(`AppClient backend mirror a ouvir na porta ${PORT}.`);
    console.log(`Pedidos encaminhados para ${TARGET_BACKEND_URL}.`);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  console.error("Falha ao arrancar AppClient backend mirror:", error);
  process.exit(1);
});
