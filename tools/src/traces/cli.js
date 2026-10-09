#!/usr/bin/env node
// `cd tools && npm run traces [-- <subcommand> [options]]` (design REQ-014, 2;
// decisions/0021). check (default): exit 0 clean, 1 a trace, 2 an error of the
// environment or the input, or an incomplete check. add: names from stdin into the file
// of hashes. hash-line: the sha256 of one line, for a record of the file of exceptions.
// Errors are one stderr line `traces: <code>: <text>`, without a stack trace; a program
// error is not caught.
import fs from "node:fs";
import path from "node:path";
import { sha256 } from "../util.js";
import { addNames, readInput } from "./add.js";
import {
  checkRepo,
  exitCodeOf,
  formatReport,
  loadLists,
  readText,
} from "./check.js";
import { repoRoot } from "./git-files.js";
import { TraceError } from "./lists.js";
import { makeMatcher } from "./words.js";

const USAGE = [
  "Использование: npm run traces [-- <подкоманда> [ключи]]",
  "  check (по умолчанию)  проверить репозиторий: пути домашних каталогов, названия из списка, ссылки за корень",
  "  add                   добавить хеши названий со стандартного ввода (по одному в строке) в tools/traces/forbidden-names.sha256",
  "  hash-line             напечатать sha256 строки файла: --file <путь от корня> --line <n>",
  "  --root <папка>        любая папка внутри репозитория (по умолчанию — текущая)",
  "  --help                эта справка",
  "Коды выхода check: 0 — следов нет; 1 — найден след; 2 — ошибка или неполная проверка.",
].join("\n");

// Subcommand -> its keys. A Map: names inherited from Object.prototype ("toString",
// "constructor", "__proto__" ...) are unknown, never a lookup that succeeds (2, r3).
const KEYS = new Map([
  ["check", ["root"]],
  ["add", ["root"]],
  ["hash-line", ["root", "file", "line"]],
]);

function usage(message) {
  return new TraceError(
    "E_TRACE_USAGE",
    `${message}; справка: npm run traces -- --help`,
  );
}

function parseArgs(argv) {
  if (argv.includes("--help")) return { help: true };
  let i = 0;
  let command = "check";
  if (argv[0] !== undefined && !argv[0].startsWith("--")) {
    command = argv[0];
    i = 1;
    if (!KEYS.has(command)) throw usage("неизвестная подкоманда");
  }
  const allowed = KEYS.get(command);
  const opts = new Map();
  for (; i < argv.length; i++) {
    const a = argv[i];
    const name = a.startsWith("--") ? a.slice(2) : null;
    if (name === null || !allowed.includes(name))
      throw usage("неизвестный ключ или лишний аргумент");
    const value = argv[++i];
    if (value === undefined) throw usage(`у ключа --${name} нет значения`);
    if (opts.has(name)) throw usage(`ключ --${name} задан дважды`);
    opts.set(name, value);
  }
  return { command, opts };
}

function runCheck(root) {
  const report = checkRepo({ root, env: process.env, cwd: process.cwd() });
  process.stdout.write(`${formatReport(report).join("\n")}\n`);
  return exitCodeOf(report);
}

function runAdd(root) {
  if (process.stdin.isTTY)
    process.stderr.write(
      "Введите названия, по одному в строке, затем Ctrl-D\n",
    );
  const result = addNames(root, readInput());
  if (result.issues !== undefined) {
    for (const i of result.issues.list)
      process.stderr.write(`traces: ${i.code}: ${i.file}: ${i.message}\n`);
    return 2;
  }
  process.stdout.write(
    `traces: добавлено хешей ${result.added}, уже были ${result.existed}\n`,
  );
  return 0;
}

const HASH_LINE_SKIP = {
  deleted: "нет такого файла",
  unreadable: "файл не читается",
  "not-regular": "это не обычный файл",
  "outside-root": "файл вне корня репозитория",
  "too-large": "файл больше 16 МиБ",
  binary: "файл не текст",
};

function runHashLine(root, opts) {
  const file = opts.get("file");
  const lineText = opts.get("line");
  if (file === undefined || lineText === undefined)
    throw usage("нужны ключи --file и --line");
  if (!/^[1-9]\d{0,8}$/u.test(lineText))
    throw usage("--line — целое число от 1");
  const rel = file.split(path.sep).join("/");
  const segments = rel.split("/");
  if (
    path.isAbsolute(file) ||
    segments.some((s) => s === "" || s === "." || s === "..")
  )
    throw usage("--file — путь от корня репозитория, без .. и /");
  const { hashes } = loadLists(root, process.env, process.cwd());
  if (makeMatcher(hashes)(rel).length > 0)
    throw usage(
      "в пути файла название из списка: такой файл переименовывают, исключение не поможет",
    );
  // The same rules as check: no link out of the root, no file over the limit (2.3, r3).
  const read = readText(root, fs.realpathSync(root), rel);
  if (read.skip !== undefined) throw usage(HASH_LINE_SKIP[read.skip]);
  const lines = read.text.split("\n");
  if (read.text.endsWith("\n")) lines.pop();
  const n = Number(lineText);
  if (n > lines.length) throw usage(`в файле нет строки ${n}`);
  const line = lines[n - 1].endsWith("\r")
    ? lines[n - 1].slice(0, -1)
    : lines[n - 1];
  process.stdout.write(`${sha256(Buffer.from(line, "utf8"))}\n`);
  return 0;
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
    if (parsed.help) {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    const start = path.resolve(process.cwd(), parsed.opts.get("root") ?? ".");
    const root = repoRoot(start);
    if (parsed.command === "add") return runAdd(root);
    if (parsed.command === "hash-line") return runHashLine(root, parsed.opts);
    return runCheck(root);
  } catch (err) {
    if (!(err instanceof TraceError)) throw err;
    process.stderr.write(`traces: ${err.code}: ${err.message}\n`);
    return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
