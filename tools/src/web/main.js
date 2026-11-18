// The command `cd tools && npm run team-web` (design REQ-011, sections 2 and 8.4):
// starts the server of the business interface of Sai Team and prints the link.
// The link goes to stdout (one line); every warning and refusal goes to stderr,
// in Russian, without a stack. The start writes nothing: the data folder is made
// by the core when the first project is created.
//
//   npm run team-web [-- --port <0..65535>] [--executor claude-cli|scripted] [--scenario <file>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "../team/config.js";
import { escapeUnsafe, formatError } from "../team/errors.js";
import { parseScenario } from "../team/executors/scripted.js";
import { resolveHome } from "../team/home.js";
import { LIMITS } from "../team/schema.js";
import { DEFAULT_PORT, HOST, SHUTDOWN_WAIT_MS } from "./config.js";
import { createEngines } from "./engines.js";
import {
  PublicFilesError,
  createWebServer,
  loadPublicFiles,
} from "./server.js";

const USAGE =
  "Использование: npm run team-web [-- --port N] [--executor claude-cli|scripted --scenario <файл>]";
const PUBLIC_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "public",
);
const OPTIONS = ["--port", "--executor", "--scenario"];

class ArgError extends Error {}

function parseArgs(argv) {
  const given = {};
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i];
    if (!OPTIONS.includes(name)) throw new ArgError();
    if (Object.hasOwn(given, name)) throw new ArgError();
    if (i + 1 >= argv.length) throw new ArgError();
    given[name] = argv[i + 1];
    i += 1;
  }
  let port = DEFAULT_PORT;
  if (given["--port"] !== undefined) {
    const raw = given["--port"];
    if (!/^[0-9]{1,5}$/.test(raw) || Number(raw) > 65535) {
      throw new ArgError();
    }
    port = Number(raw);
  }
  const executor = given["--executor"] ?? "claude-cli";
  if (executor !== "claude-cli" && executor !== "scripted") {
    throw new ArgError();
  }
  const scenario = given["--scenario"] ?? null;
  if ((executor === "scripted") !== (scenario !== null)) throw new ArgError();
  return { port, executor, scenario };
}

// The bytes of the scenario of the test executor, checked once at the start
// (decisions/0025, W3); null when the file is missing, too big or wrong.
function readScenario(file) {
  try {
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > LIMITS.SCENARIO_BYTES_MAX) return null;
    const bytes = fs.readFileSync(file);
    if (bytes.length > LIMITS.SCENARIO_BYTES_MAX) return null;
    parseScenario(bytes);
    return bytes;
  } catch {
    return null;
  }
}

function line(io, text) {
  try {
    io.err.write(`${text}\n`);
  } catch {
    // Nowhere left to report to.
  }
}

async function run(argv, env, io) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    line(io, USAGE);
    return 2;
  }

  let home;
  let config;
  try {
    home = resolveHome(env);
    config = readConfig(env);
  } catch (err) {
    line(io, formatError(err));
    return 2;
  }

  let scenarioBytes = null;
  if (args.executor === "scripted") {
    scenarioBytes = readScenario(args.scenario);
    if (scenarioBytes === null) {
      line(io, "Файл сценария не найден или неверен");
      return 1;
    }
  }

  let publicFiles;
  try {
    publicFiles = loadPublicFiles(PUBLIC_DIR);
  } catch (err) {
    if (!(err instanceof PublicFilesError)) throw err;
    line(io, "Файлы страницы не найдены");
    return 3;
  }

  // Every distinct warning once per start (the warnings of the core name folders
  // and modes of files: they go to stderr, never to the page).
  const seen = new Set();
  const warn = (text) => {
    const one = escapeUnsafe(String(text).replace(/[\r\n]+/g, " "));
    if (seen.has(one)) return;
    seen.add(one);
    line(io, `Sai Team: ${one}`);
  };

  const engines = createEngines({ home, env, warn });
  const server = createWebServer({
    home,
    env,
    config,
    executor: args.executor,
    scenarioBytes,
    port: args.port,
    publicFiles,
    engines,
    warn,
  });
  let bound;
  try {
    bound = await server.listen();
  } catch (err) {
    if (err && err.code === "EADDRINUSE") {
      line(
        io,
        `Порт ${args.port} занят. Запустите с другим: npm run team-web -- --port <номер>`,
      );
      return 1;
    }
    if (err && typeof err.code === "string" && /^E[A-Z]+$/.test(err.code)) {
      line(io, `Не удалось запустить сервер (${err.code})`);
      return 1;
    }
    throw err;
  }

  // The first SIGINT or SIGTERM: no new requests, every engine pauses its project;
  // all ended in SHUTDOWN_WAIT_MS — 0, otherwise 1 (the next opening recovers the
  // project). A second signal ends the process at once with 1. The handlers go in
  // before the link is printed.
  let stopping = false;
  let onSignal = () => {};
  const stopped = new Promise((resolve) => {
    onSignal = () => {
      if (stopping) {
        process.exit(1);
      }
      stopping = true;
      server.close();
      engines.stopAll(SHUTDOWN_WAIT_MS).then(
        (all) => resolve(all ? 0 : 1),
        () => resolve(1),
      );
    };
  });
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    // the link carries the access key of this start (ISS-0122)
    io.out.write(
      `Sai Team: http://${HOST}:${bound.port}/?k=${server.accessKey()}\n`,
    );
  } catch (err) {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await server.close();
    throw err;
  }

  const code = await stopped;
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  return code;
}

// argv: the arguments after the name of the script; env: the environment; io:
// { out, err } streams with write(). Resolves to the exit code, never rejects.
export async function main(argv, env, io) {
  try {
    return await run(argv, env, io);
  } catch (err) {
    line(io, formatError(err));
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
  // A reader of stdout or stderr that goes away (a closed pipe) must not end the
  // server through an unhandled 'error' event of the stream.
  for (const stream of [process.stdout, process.stderr]) {
    stream.on("error", () => {});
  }
  main(process.argv.slice(2), process.env, {
    out: process.stdout,
    err: process.stderr,
  }).then(
    (code) => {
      process.exitCode = code;
      // An engine that did not stop in time keeps timers alive: end now.
      if (code !== 0) process.exit(code);
    },
    () => {
      process.exit(1);
    },
  );
}
