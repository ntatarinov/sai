// The arguments of the command `handoff` (design REQ-039, 3.2-3.4): the table of keys,
// the rules of the values and the text of the help. Pure functions, no disk, no git.
import { HandoffError } from "./errors.js";

export const RUN_ID = /^[A-Z][A-Z0-9]*(-[0-9]{3,4})?-[0-9]{8}-[0-9]{2}$/u;
const STEP = /^[0-9]{2}[a-z]?$/u;
const WORKFLOW = /^WF-0[1-7]$/u;
const REQUIREMENT = /^REQ-[0-9]{3}$/u;
const QUALIFIER = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
const SUFFIX = /^(r|run|v)[1-9][0-9]{0,3}$/u;
const PRIORITIES = ["HIGH", "NORMAL", "LOW"];
export const STATUSES = ["COMPLETED", "FAILED"];

// key -> { repeat }; a Map, so that a name inherited from Object.prototype is unknown.
const NEW_KEYS = new Map([
  ["run", false],
  ["step", false],
  ["role", false],
  ["workflow", false],
  ["task", false],
  ["criterion", true],
  ["requirement", true],
  ["artifact-in", true],
  ["write-set", true],
  ["route", false],
  ["qualifier", false],
  ["suffix", false],
  ["priority", false],
  ["rework-of", false],
]);
const REQUIRED = ["run", "step", "role", "workflow", "task"];
const CLOSE_KEYS = new Map([["status", false]]);

export const HELP = [
  "Использование:",
  '  npm run handoff -- new --run <RUN-ID> --step <ШАГ> --role <КОД РОЛИ> --workflow <WF-NN> --task "<текст>" [ключи]',
  "  npm run handoff -- close <путь handoff-а от корня> --status COMPLETED|FAILED",
  "  npm run handoff -- --help",
  "Ключи new (повторяемые помечены «…»):",
  "  --run <МЕТКА-ГГГГММДД-NN>   обязателен: метка заглавными буквами и цифрами, дата, номер",
  "  --step <NN или NNx>         обязателен: 00, 01, 05b",
  "  --role <КОД>                обязателен: код из строк name: в .claude/agents/*.md",
  "  --workflow <WF-01…WF-07>    обязателен",
  "  --task <текст>              обязателен: непустой текст задачи",
  "  --criterion <пункт>…        пункт критериев, по порядку ввода",
  "  --requirement <REQ-NNN>…    требование, по порядку ввода",
  "  --artifact-in <текст>…      входной документ или пояснение",
  "  --write-set <текст>…        разрешённые файлы (всегда список)",
  "  --route <текст>             маршрут",
  "  --qualifier <слово>         уточнение имени: строчные буквы, цифры, дефис",
  "  --suffix <rN|runN|vN>       суффикс имени; при rN записывается round",
  "  --priority HIGH|NORMAL|LOW  по умолчанию NORMAL",
  "  --rework-of <путь>          handoff, который дорабатывается (путь от корня)",
  "Ключ close:",
  "  --status COMPLETED|FAILED   обязателен",
  "Коды выхода: 0 — сделано; 1 — отказ по правилам; 2 — ошибка вызова или окружения.",
  "Подробности: tools/README.md, раздел «Команда handoff».",
].join("\n");

const HINT = "; справка: npm run handoff -- --help";

function usage(message) {
  return new HandoffError("E_HO_USAGE", message + HINT, 2);
}

function input(key, rule) {
  return new HandoffError("E_HO_INPUT", `ключ --${key}: ${rule}`, 1);
}

// Keys and positional arguments: { values: Map(name -> string[]), positional: string[] }.
function scan(argv, keys) {
  const values = new Map();
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (!keys.has(name)) throw usage("неизвестный ключ или лишний аргумент");
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--"))
      throw usage(`у ключа --${name} нет значения`);
    i++;
    if (values.has(name)) {
      if (!keys.get(name)) throw usage(`ключ --${name} задан дважды`);
      values.get(name).push(next);
    } else values.set(name, [next]);
  }
  return { values, positional };
}

const blank = (v) => v.trim().length === 0;
function hasControl(v) {
  for (let i = 0; i < v.length; i++) {
    const code = v.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

// The path of a handoff written in `--rework-of`.
function reworkOk(v) {
  if (hasControl(v) || v.includes("\\")) return false;
  if (!v.startsWith("handoffs/") || !v.endsWith(".json")) return false;
  return v.split("/").every((p) => p !== "" && p !== "." && p !== "..");
}

// The values of `new` against the table 3.2, in the fixed order; the first failure.
function checkNewValues(o) {
  if (!RUN_ID.test(o.run))
    throw input(
      "run",
      "ожидается <МЕТКА>-<ГГГГММДД>-<NN>, например PROD-20991231-01",
    );
  if (!STEP.test(o.step))
    throw input("step", "две цифры и, если нужно, строчная буква: 00, 01, 05b");
  if (!WORKFLOW.test(o.workflow))
    throw input("workflow", "ожидается WF-01 … WF-07");
  if (o.qualifier !== undefined) {
    if (o.qualifier.length > 40 || !QUALIFIER.test(o.qualifier))
      throw input(
        "qualifier",
        "строчные латинские буквы и цифры через дефис, до 40 знаков",
      );
  }
  if (o.suffix !== undefined && !SUFFIX.test(o.suffix))
    throw input("suffix", "ожидается rN, runN или vN, N от 1");
  if (o.priority !== undefined && !PRIORITIES.includes(o.priority))
    throw input("priority", "ожидается HIGH, NORMAL или LOW");
  for (const r of o.requirement)
    if (!REQUIREMENT.test(r))
      throw input("requirement", "ожидается REQ-NNN, три цифры");
  if (o.reworkOf !== undefined && !reworkOk(o.reworkOf))
    throw input(
      "rework-of",
      "путь от корня: начинается с handoffs/, кончается .json, без .. и пустых частей",
    );
  if (blank(o.task)) throw input("task", "нужен непустой текст");
  const lists = [
    ["criterion", o.criterion],
    ["artifact-in", o.artifactIn],
    ["write-set", o.writeSet],
  ];
  for (const [key, list] of lists)
    if (list.some(blank)) throw input(key, "нужен непустой текст");
  if (o.route !== undefined && blank(o.route))
    throw input("route", "нужен непустой текст");
}

// argv without the program -> { help } | { cmd: "new", opts } | { cmd: "close", opts }.
export function parseArgv(argv) {
  if (argv.includes("--help")) return { help: true };
  const cmd = argv[0];
  if (cmd === undefined || cmd.startsWith("--"))
    throw usage("нет подкоманды (new или close)");
  if (cmd === "new") {
    const { values, positional } = scan(argv.slice(1), NEW_KEYS);
    if (positional.length > 0)
      throw usage("неизвестный ключ или лишний аргумент");
    for (const key of REQUIRED)
      if (!values.has(key)) throw usage(`нет обязательного ключа --${key}`);
    const one = (k) => values.get(k)?.[0];
    const opts = {
      run: one("run"),
      step: one("step"),
      role: one("role"),
      workflow: one("workflow"),
      task: one("task"),
      criterion: values.get("criterion") ?? [],
      requirement: values.get("requirement") ?? [],
      artifactIn: values.get("artifact-in") ?? [],
      writeSet: values.get("write-set") ?? [],
      route: one("route"),
      qualifier: one("qualifier"),
      suffix: one("suffix"),
      priority: one("priority"),
      reworkOf: one("rework-of"),
    };
    checkNewValues(opts);
    return { cmd, opts };
  }
  if (cmd === "close") {
    const { values, positional } = scan(argv.slice(1), CLOSE_KEYS);
    if (positional.length !== 1)
      throw usage("close: нужен ровно один путь handoff-а");
    if (!values.has("status")) throw usage("нет обязательного ключа --status");
    const status = values.get("status")[0];
    if (!STATUSES.includes(status))
      throw usage("ключ --status: допустимы COMPLETED и FAILED");
    return { cmd, opts: { path: positional[0], status } };
  }
  throw usage("неизвестная подкоманда");
}
