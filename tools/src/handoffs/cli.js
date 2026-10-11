#!/usr/bin/env node
// `cd tools && npm run handoffs-check [-- <keys>]` (design REQ-038, 3; decisions/0037).
// Exit 0: no violation (those covered by the base do not count); 1: a violation; 2: an
// error of the environment or the input. The output is printed only after a complete
// pass, so a failed run prints nothing to stdout. Errors are one stderr line
// `handoffs-check: <code>: <text>`, without a stack trace; a program error is not caught.
import path from "node:path";
import { TraceError } from "../traces/lists.js";
import { checkHandoffs, exitCodeOf, formatReport } from "./check.js";
import { emitRecords } from "./exceptions.js";

const USAGE = [
  "Использование: npm run handoffs-check [-- <ключи>]",
  "  --root <папка>        любая папка внутри репозитория (по умолчанию — текущая)",
  "  --emit-exceptions     напечатать записи базы исключений для нарушений, не снятых базой (ничего не пишет)",
  "  --help                эта справка",
  "Коды выхода: 0 — нарушений нет; 1 — есть нарушение; 2 — ошибка или неполная проверка.",
].join("\n");

// The keys; a Map, so that a name inherited from Object.prototype is simply unknown.
const KEYS = new Map([
  ["root", true],
  ["emit-exceptions", false],
]);

function usage(message) {
  return new TraceError(
    "E_HC_USAGE",
    `${message}; справка: npm run handoffs-check -- --help`,
  );
}

function parseArgs(argv) {
  if (argv.includes("--help")) return { help: true };
  const opts = new Map();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const name = a.startsWith("--") ? a.slice(2) : null;
    if (name === null || !KEYS.has(name))
      throw usage("неизвестный ключ или лишний аргумент");
    if (opts.has(name)) throw usage(`ключ --${name} задан дважды`);
    if (KEYS.get(name)) {
      const value = argv[++i];
      if (value === undefined) throw usage(`у ключа --${name} нет значения`);
      opts.set(name, value);
    } else opts.set(name, true);
  }
  return { opts };
}

function main(argv) {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    const start = path.resolve(process.cwd(), parsed.opts.get("root") ?? ".");
    const report = checkHandoffs({ root: start });
    if (parsed.opts.has("emit-exceptions")) {
      const records = emitRecords(report.violations);
      if (records.length > 0) process.stdout.write(`${records.join("\n")}\n`);
      return 0;
    }
    process.stdout.write(`${formatReport(report).join("\n")}\n`);
    return exitCodeOf(report);
  } catch (err) {
    if (!(err instanceof TraceError)) throw err;
    process.stderr.write(`handoffs-check: ${err.code}: ${err.message}\n`);
    return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
