#!/usr/bin/env node
// `cd tools && npm run picker -- <command> [arguments]` (design REQ-054, 5.11 and 7;
// REQ-056, 4). One entry for all the commands of the picker site: `check <file>` and
// `serve --tenants <folder>`. Exit 0: the file is in order, the site was stopped, or the
// help; 1: errors found (check) or the site cannot start; 2: a wrong call or a file or
// folder that cannot be read, one line `picker: <text>` to stderr; 3: a program error,
// the stack goes to stderr. This file is a script: it runs its command when it is loaded
// and exports nothing.
import {
  NODE_REFUSAL_EXIT,
  meetsNodeFloor,
  nodeFloorRefusal,
} from "../node-floor.js";
import { checkFile, show } from "./check.js";
import { runServe } from "./serve.js";

const HELP = [
  "Использование: npm run picker -- <команда> [аргументы]",
  "Команды:",
  "  check <файл>   проверить файл арендатора; файл только читается",
  "  serve --tenants <папка> [--home <папка>] [--port N]   запустить сайт подбора на этом компьютере (127.0.0.1)",
  "Коды выхода check: 0 — в порядке; 1 — найдены ошибки; 2 — неверный вызов или файл нельзя прочитать.",
  "Коды выхода serve: 0 — остановлен; 1 — нет исправных арендаторов или порт занят; 2 — неверный вызов или папку нельзя прочитать.",
  "Ошибка программы: код 3, подробности в stderr.",
];
const SEE_HELP = "Справка: npm run picker -- --help";

function refusal(text) {
  return { exitCode: 2, stdout: [], stderr: [`picker: ${text}`] };
}

function runCheck(args) {
  const key = args.find((a) => a.startsWith("--"));
  if (key !== undefined)
    return refusal(`Неизвестный ключ ${show(key)}. ${SEE_HELP}`);
  if (args.length === 0)
    return refusal("Не указан файл. Пример: npm run picker -- check <файл>");
  if (args.length > 1) {
    return refusal(
      `Лишний аргумент ${show(args[1])}. Проверяется один файл за раз.`,
    );
  }
  return checkFile(args[0]);
}

function noop() {}

// A line to a stream. When the reader of the stream is gone (a pipe closed by `head`), the
// write is dropped without a word and the site goes on.
function lineWriter(stream) {
  stream.on("error", noop);
  return (line) => {
    try {
      stream.write(`${line}\n`);
    } catch {
      // nothing to do: the reader is gone
    }
  };
}

// `callback` is called once, when the process is asked to stop (Ctrl+C or a signal).
function onStop(callback) {
  let called = false;
  const once = () => {
    if (called) return;
    called = true;
    callback();
  };
  process.once("SIGINT", once);
  process.once("SIGTERM", once);
}

async function runServeCommand(args) {
  const io = {
    out: lineWriter(process.stdout),
    err: lineWriter(process.stderr),
  };
  const exitCode = await runServe(args, io, onStop);
  return { exitCode, stdout: [], stderr: [] };
}

// name -> handler(arguments) -> { exitCode, stdout, stderr } or a promise of it; a Map, so
// that a name inherited from Object.prototype is simply unknown.
const COMMANDS = new Map([
  ["check", runCheck],
  ["serve", runServeCommand],
]);

function run(argv) {
  if (argv.includes("--help")) return { exitCode: 0, stdout: HELP, stderr: [] };
  // The Node floor (REQ-110), before the usage checks and both commands.
  const version = process.versions.node;
  if (!meetsNodeFloor(version)) {
    return {
      exitCode: NODE_REFUSAL_EXIT,
      stdout: [],
      stderr: [nodeFloorRefusal(version)],
    };
  }
  if (argv.length === 0)
    return refusal(`Не указана команда. Доступны: check, serve. ${SEE_HELP}`);
  const handler = COMMANDS.get(argv[0]);
  if (handler === undefined) {
    return refusal(
      `Неизвестная команда ${show(argv[0])}. Доступны: check, serve. ${SEE_HELP}`,
    );
  }
  return handler(argv.slice(1));
}

function emit(stream, lines) {
  if (lines.length > 0) stream.write(`${lines.join("\n")}\n`);
}

// A program error ends the process with code 3 and its stack in stderr, whether it came
// from the code run at once or from the code that runs later.
process.on("uncaughtException", (err) => {
  const stack = err instanceof Error ? err.stack : undefined;
  process.exitCode = 3;
  process.stderr.write(`${stack ?? String(err)}\n`, () => process.exit(3));
});

new Promise((resolve) => {
  resolve(run(process.argv.slice(2)));
}).then((result) => {
  emit(process.stdout, result.stdout);
  emit(process.stderr, result.stderr);
  process.exitCode = result.exitCode;
});
