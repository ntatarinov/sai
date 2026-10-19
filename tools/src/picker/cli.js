#!/usr/bin/env node
// `cd tools && npm run picker -- <command> [arguments]` (design REQ-054, 5.11 and 7).
// One entry for all the commands of the picker site; today there is one: `check <file>`.
// Exit 0: the file is in order (or the help); 1: errors found, printed to stdout; 2: a
// wrong call or a file that cannot be read, one line `picker: <text>` to stderr. The file
// is only read. A program error is not caught.
import { checkFile, show } from "./check.js";

const HELP = [
  "Использование: npm run picker -- <команда> [аргументы]",
  "Команды:",
  "  check <файл>   проверить файл арендатора; файл только читается",
  "Коды выхода check: 0 — в порядке; 1 — найдены ошибки; 2 — неверный вызов или файл нельзя прочитать.",
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

// name -> handler(arguments) -> { exitCode, stdout, stderr }; a Map, so that a name
// inherited from Object.prototype is simply unknown.
export const COMMANDS = new Map([["check", runCheck]]);

function run(argv) {
  if (argv.includes("--help")) return { exitCode: 0, stdout: HELP, stderr: [] };
  if (argv.length === 0)
    return refusal(`Не указана команда. Доступна: check. ${SEE_HELP}`);
  const handler = COMMANDS.get(argv[0]);
  if (handler === undefined) {
    return refusal(
      `Неизвестная команда ${show(argv[0])}. Доступна: check. ${SEE_HELP}`,
    );
  }
  return handler(argv.slice(1));
}

function emit(stream, lines) {
  if (lines.length > 0) stream.write(`${lines.join("\n")}\n`);
}

const result = run(process.argv.slice(2));
emit(process.stdout, result.stdout);
emit(process.stderr, result.stderr);
process.exitCode = result.exitCode;
