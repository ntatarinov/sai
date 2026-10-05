// The command `cd tools && npm run pixel-office` (design 2.2, 9.1): starts the
// Pixel Office server and prints the link. The report goes to stdout (one
// line); every warning and error goes to stderr, in Russian, without a stack.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_MARKER,
  DEFAULT_PORT,
  ENV_STATE_DIR,
  HOST,
  PROBE_MS,
} from "./config.js";
import { JournalReadError, JournalWriteError } from "./journal.js";
import { createServer } from "./server.js";
import {
  StateDirError,
  ensureSecret,
  ensureStateDir,
  resolveStateDir,
} from "./state-dir.js";

const USAGE = [
  "Использование: npm run pixel-office [-- --port <1-65535 или 0>] [--dir <абсолютный путь>]",
  "  --port  порт сервера (по умолчанию 4780; 0 — любой свободный)",
  "  --dir   каталог состояния (по умолчанию ~/.sai-pixel-office)",
  "  --help  эта справка",
].join("\n");

const DIR_WARNING = `Каталог состояния задан ключом --dir. Хуки Claude Code найдут его, только если переменная ${ENV_STATE_DIR} с тем же путём задана в окружении Claude Code.`;

// Longest answer read from the occupant of a busy port.
const PROBE_MAX = 1024 * 1024;

class ArgError extends Error {}

function parseArgs(argv) {
  const opts = { port: DEFAULT_PORT, dir: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    if (name === "--help") {
      if (inline !== undefined) {
        throw new ArgError("ключ --help не принимает значение");
      }
      opts.help = true;
    } else if (name === "--port" || name === "--dir") {
      const value = inline ?? argv[++i];
      if (value === undefined) {
        throw new ArgError(`ключ ${name} требует значение`);
      }
      if (name === "--port") {
        if (!/^\d+$/.test(value) || Number(value) > 65535) {
          throw new ArgError(
            `порт должен быть целым числом от 1 до 65535 или 0 (сейчас: ${value})`,
          );
        }
        opts.port = Number(value);
      } else {
        if (!path.isAbsolute(value)) {
          throw new ArgError(
            `ключ --dir требует абсолютный путь (сейчас: ${value})`,
          );
        }
        opts.dir = path.resolve(value);
      }
    } else {
      throw new ArgError(
        arg.startsWith("--")
          ? `неизвестный ключ ${name}`
          : `лишний аргумент ${arg}`,
      );
    }
  }
  return opts;
}

// The one line the command prints on stdout.
function linkLine(port) {
  return `Pixel Office: http://${HOST}:${port}/`;
}

function describe(err) {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/\s+/g, " ").slice(0, 300);
}

function homeDir(env) {
  if (typeof env.HOME === "string" && env.HOME !== "") return env.HOME;
  try {
    return os.homedir();
  } catch {
    return null;
  }
}

// Is the occupant of this port a Pixel Office server? One bounded GET to
// 127.0.0.1 (the host is a constant, the port is a checked integer); any
// failure, silence, wrong status or foreign answer means "no".
function isPixelOffice(port) {
  return new Promise((resolve) => {
    let timer = null;
    let settled = false;
    let req = null;
    const finish = (answer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (req !== null) req.destroy();
      resolve(answer);
    };
    timer = setTimeout(() => finish(false), PROBE_MS);
    try {
      req = http.get(
        {
          host: HOST,
          port,
          path: "/api/events?after=0&limit=0",
          headers: { Accept: "application/json" },
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            finish(false);
            return;
          }
          const chunks = [];
          let total = 0;
          res.on("data", (chunk) => {
            total += chunk.length;
            if (total > PROBE_MAX) finish(false);
            else chunks.push(chunk);
          });
          res.on("end", () => {
            try {
              const answer = JSON.parse(Buffer.concat(chunks).toString("utf8"));
              finish(
                answer !== null &&
                  typeof answer === "object" &&
                  answer.app === APP_MARKER,
              );
            } catch {
              finish(false);
            }
          });
          res.on("error", () => finish(false));
        },
      );
      req.on("error", () => finish(false));
    } catch {
      finish(false);
    }
  });
}

function isTypedStartError(err) {
  return (
    err instanceof StateDirError ||
    err instanceof JournalWriteError ||
    err instanceof JournalReadError
  );
}

async function run(argv, env, io) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    io.err.write(`Pixel Office: ${err.message}\n${USAGE}\n`);
    return 2;
  }
  if (args.help) {
    io.out.write(`${USAGE}\n`);
    return 0;
  }

  const version = io.nodeVersion ?? process.versions.node;
  if (String(version).split(".")[0] !== "22") {
    io.err.write(
      `Pixel Office: нужен Node 22 (сейчас ${version}). Подробности — tools/README.md\n`,
    );
    return 1;
  }

  // The directory the hook will look for: the environment, else the home
  // directory. A --dir that differs from it is allowed, with a warning.
  let hookDir = null;
  let hookDirError = null;
  try {
    hookDir = resolveStateDir(env, homeDir(env));
  } catch (err) {
    if (!(err instanceof StateDirError)) throw err;
    hookDirError = err;
  }
  if (args.dir === null && hookDirError !== null) {
    io.err.write(`Pixel Office: ${hookDirError.message}\n`);
    return 1;
  }
  const stateDir = args.dir ?? hookDir;
  if (args.dir !== null && args.dir !== hookDir) {
    io.err.write(`${DIR_WARNING}\n`);
  }

  try {
    ensureStateDir(stateDir);
    ensureSecret(stateDir);
  } catch (err) {
    if (!(err instanceof StateDirError)) throw err;
    io.err.write(`Pixel Office: ${err.message}\n`);
    return 1;
  }

  const server = createServer({ stateDir, port: args.port });
  let bound;
  try {
    bound = await server.listen();
  } catch (err) {
    if (err && err.code === "EADDRINUSE") {
      if (await isPixelOffice(args.port)) {
        io.out.write(`${linkLine(args.port)}\n`);
        return 0;
      }
      io.err.write(
        `Порт ${args.port} занят другим процессом, это не Pixel Office. Освободите порт или запустите с другим: npm run pixel-office -- --port <номер>\n`,
      );
      return 1;
    }
    if (isTypedStartError(err)) {
      io.err.write(`Pixel Office: ${err.message}\n`);
      return 1;
    }
    if (err && typeof err.code === "string") {
      io.err.write(
        `Pixel Office: не удалось запустить сервер: ${describe(err)}\n`,
      );
      return 1;
    }
    throw err;
  }

  // Runs until SIGINT or SIGTERM, then closes and reports success. The
  // handlers go in before the link line is printed: a signal sent as soon as
  // the link is seen must not end the process by the signal.
  let stopping = false;
  let stop = () => {};
  const stopped = new Promise((resolve) => {
    stop = () => {
      if (stopping) return;
      stopping = true;
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      server.close().then(() => resolve(0));
    };
  });
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  try {
    io.out.write(`${linkLine(bound.port)}\n`);
  } catch (err) {
    stopping = true;
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await server.close();
    throw err;
  }

  return await stopped;
}

// argv: arguments after the script name; env: the environment; io: {out, err}
// streams with write(). Resolves to the exit code and never rejects: an
// unexpected error is reported as one line, without a stack trace.
// io.nodeVersion (optional) replaces the Node version for the version check.
export async function main(argv, env, io) {
  try {
    return await run(argv, env, io);
  } catch (err) {
    try {
      io.err.write(`Pixel Office: внутренняя ошибка: ${describe(err)}\n`);
    } catch {
      // Nowhere left to report to.
    }
    return 1;
  }
}

function isEntryPoint() {
  try {
    return (
      fs.realpathSync(process.argv[1]) ===
      fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  // The reader of stdout or stderr can go away while the server runs (a pipe
  // closed after a background start). A write then fails with EPIPE as an
  // 'error' event of the stream, and an event without a listener ends the
  // process (Q10). The listeners go in before anything is written, so neither
  // the link line nor a later warning from the server or the journal can stop
  // the server; what cannot be delivered is dropped.
  for (const stream of [process.stdout, process.stderr]) {
    stream.on("error", () => {});
  }
  main(process.argv.slice(2), process.env, {
    out: process.stdout,
    err: process.stderr,
  }).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.exitCode = 1;
    },
  );
}
