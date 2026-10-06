// The commands of Sai Team (design REQ-009, section 10; design REQ-010, section 9):
//
//   npm run team -- projects
//   npm run team -- project <id>
//   npm run team -- events <id> [--after N] [--limit M]
//   npm run team -- say <id> --text "<text>"
//   npm run team -- new --goal "<goal>" --budget <usd> [--executor claude-cli|scripted] [--scenario <file>]
//   npm run team -- add-task <id> --role <code> --text "<text>" --done-when "<criterion>"
//   npm run team -- run-task <id> <task>
//
// Success: one line of JSON on stdout, exit code 0. A refusal: stdout empty, one line
// "<CODE>: <message>" on stderr, exit code 1 (2 for E_USAGE, 3 for a bug of the
// program, E_INTERNAL). Never a stack.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readConfig } from "./config.js";
import {
  EXIT,
  TeamError,
  escapeUnsafe,
  exitCodeFor,
  formatError,
} from "./errors.js";
import { ROLES, roleByCode } from "./roles.js";
import { runTask } from "./runner.js";
import {
  EXECUTORS,
  LIMITS,
  PROJECT_STATUS_TEXT,
  TASK_STATUS_TEXT,
} from "./schema.js";
import {
  createProject,
  listProjects,
  openWriter,
  readEvents,
  readProject,
} from "./store.js";
import { TAIL_TEXT, eventView, projectView } from "./view.js";

// positional: the number of arguments without "--" (the id of the project, the
// task); options: the allowed "--name value" pairs.
const COMMANDS = {
  projects: { positional: 0, options: [] },
  project: { positional: 1, options: [] },
  events: { positional: 1, options: ["--after", "--limit"] },
  say: { positional: 1, options: ["--text"] },
  new: {
    positional: 0,
    options: ["--goal", "--budget", "--executor", "--scenario"],
  },
  "add-task": {
    positional: 1,
    options: ["--role", "--text", "--done-when"],
  },
  "run-task": { positional: 2, options: [] },
};

const UNKNOWN_COMMAND =
  "Неизвестная команда: нужна projects, project, events, say, new, add-task или run-task";
const BUDGET_PATTERN = /^[0-9]+(\.[0-9]{1,6})?$/;
const SCRIPTED_NOTE = "тестовый исполнитель — только для тестов";
// The time a cancelled run-task waits for the executor to stop (section 9.3).
const CANCEL_WAIT_MS = 15_000;

function usage(message) {
  return new TeamError("E_USAGE", message);
}

function defaultIo() {
  return { stdout: process.stdout, stderr: process.stderr };
}

function report(err, io) {
  try {
    io.stderr.write(`${formatError(err)}\n`);
  } catch {
    // Nowhere left to report; the exit code still says it.
  }
  return exitCodeFor(err);
}

function print(value, io) {
  let text;
  try {
    text = `${escapeUnsafe(JSON.stringify(value ?? null))}\n`;
  } catch (err) {
    return report(err, io);
  }
  try {
    io.stdout.write(text);
  } catch {
    return EXIT.INTERNAL;
  }
  return EXIT.OK;
}

// Calls fn and prints its result as one line of JSON; a TeamError becomes one line
// on stderr with its exit code, anything else E_INTERNAL with code 3. When fn
// returns a promise (run-task), the exit code comes as a promise too.
export function runGuarded(fn, io = defaultIo()) {
  let value;
  try {
    value = fn();
  } catch (err) {
    return report(err, io);
  }
  if (value !== null && typeof value?.then === "function") {
    return Promise.resolve(value).then(
      (v) => print(v, io),
      (err) => report(err, io),
    );
  }
  return print(value, io);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command === undefined) throw usage(UNKNOWN_COMMAND);
  const spec = Object.prototype.hasOwnProperty.call(COMMANDS, command)
    ? COMMANDS[command]
    : null;
  if (spec === null) throw usage(UNKNOWN_COMMAND);
  const options = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      if (!spec.options.includes(arg)) {
        throw usage("Неизвестный параметр");
      }
      if (Object.prototype.hasOwnProperty.call(options, arg)) {
        throw usage("Параметр указан дважды");
      }
      if (i + 1 >= rest.length) throw usage("Нужно значение параметра");
      options[arg] = rest[i + 1];
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  if (spec.positional === 0 && positional.length > 0) {
    throw usage("Лишний аргумент");
  }
  if (spec.positional >= 1 && positional.length === 0) {
    throw usage("Нужен id проекта");
  }
  if (spec.positional === 2 && positional.length === 1) {
    throw usage("Нужен id задачи");
  }
  if (positional.length > spec.positional) throw usage("Лишний аргумент");
  const args = { command, id: positional[0] };
  if (command === "events") {
    args.after = 0;
    args.limit = LIMITS.PAGE_DEFAULT;
    if (options["--after"] !== undefined) {
      const v = options["--after"];
      if (!/^[0-9]{1,15}$/.test(v)) throw usage("--after: целое ≥ 0");
      args.after = Number(v);
    }
    if (options["--limit"] !== undefined) {
      const v = options["--limit"];
      const n = /^[0-9]{1,4}$/.test(v) ? Number(v) : NaN;
      if (!(n >= 1 && n <= LIMITS.PAGE_MAX)) {
        throw usage(`--limit: целое от 1 до ${LIMITS.PAGE_MAX}`);
      }
      args.limit = n;
    }
  }
  if (command === "say") {
    if (options["--text"] === undefined) throw usage("Нужен --text");
    args.text = options["--text"];
  }
  if (command === "new") Object.assign(args, parseNew(options));
  if (command === "add-task") Object.assign(args, parseAddTask(options));
  if (command === "run-task") args.task = positional[1];
  return args;
}

// Section 9.1 of REQ-010: every check before any write.
function parseNew(options) {
  const goal = options["--goal"];
  if (goal === undefined || goal.trim() === "") {
    throw usage('Нужна цель: --goal "<текст>"');
  }
  if ([...goal].length > LIMITS.GOAL_MAX) {
    throw usage(`Цель длиннее ${LIMITS.GOAL_MAX} знаков`);
  }
  const rawBudget = options["--budget"];
  const budget =
    typeof rawBudget === "string" &&
    rawBudget.length <= 20 &&
    BUDGET_PATTERN.test(rawBudget)
      ? Number(rawBudget)
      : NaN;
  if (!(budget > 0 && budget <= LIMITS.BUDGET_MAX)) {
    throw usage(
      `--budget: число больше 0 и не больше ${LIMITS.BUDGET_MAX}, до 6 знаков после точки`,
    );
  }
  const executor = options["--executor"] ?? "claude-cli";
  if (!EXECUTORS.includes(executor)) {
    throw usage("--executor: claude-cli или scripted");
  }
  const scenario = options["--scenario"];
  if (executor === "scripted" && scenario === undefined) {
    throw new TeamError(
      "E_SCENARIO",
      "Для тестового исполнителя нужен файл сценария: --scenario <файл>",
    );
  }
  if (executor !== "scripted" && scenario !== undefined) {
    throw usage("--scenario допустим только с --executor scripted");
  }
  return { goal, budget, executor, scenario: scenario ?? null };
}

// Section 9.2 of REQ-010.
function parseAddTask(options) {
  const role = options["--role"];
  if (role === undefined || roleByCode(role) === null) {
    const known = ROLES.map((r) => `${r.title} (${r.code})`).join(", ");
    throw usage(`Неизвестная роль; допустимые: ${known}`);
  }
  if (options["--text"] === undefined) throw usage("Нужен --text");
  if (options["--done-when"] === undefined) throw usage("Нужен --done-when");
  return { role, text: options["--text"], doneWhen: options["--done-when"] };
}

// The bytes of the scenario file, as they are (relative to the current folder).
// The path never goes into a message.
function readScenarioFile(file) {
  try {
    return fs.readFileSync(file);
  } catch {
    throw new TeamError(
      "E_SCENARIO",
      "Файл сценария не найден или не читается",
    );
  }
}

function newProject(args, env) {
  const scenarioBytes =
    args.scenario === null ? null : readScenarioFile(args.scenario);
  const input = {
    goal: args.goal,
    budget_usd: args.budget,
    executor: args.executor,
  };
  if (scenarioBytes !== null) input.scenario_bytes = scenarioBytes;
  const { state, notices } = createProject(input, { env });
  const project = {
    id: state.id,
    goal: state.goal,
    status: state.status,
    status_text: PROJECT_STATUS_TEXT[state.status],
    executor: state.executor,
    budget_usd: state.budget_usd,
  };
  if (state.executor === "scripted") project.executor_note = SCRIPTED_NOTE;
  return { ok: true, project, notices };
}

function addTask(args, env) {
  const writer = openWriter(args.id, { env });
  try {
    const before = writer.state;
    const event = writer.addTask(
      { role: args.role, text: args.text, done_when: args.doneWhen },
      "USER",
    );
    const t = writer.state.tasks.find((x) => x.id === event.task);
    return {
      ok: true,
      task: {
        id: t.id,
        role_title: roleByCode(t.role).title,
        text: t.text,
        done_when: t.done_when,
        status: t.status,
        status_text: TASK_STATUS_TEXT[t.status],
        phrase: eventView(event, before).phrase,
      },
      notices: writer.notices,
    };
  } finally {
    writer.close();
  }
}

// Section 9.3 of REQ-010: the first SIGTERM/SIGINT cancels the task; a second one
// is ignored; if the cancel does not end within 15 s, exit 1 without writing (the
// next writer recovers the project).
async function runTaskCommand(args, env) {
  const config = readConfig(env);
  const writer = openWriter(args.id, { env });
  const controller = new AbortController();
  let forced = null;
  const onSignal = () => {
    if (controller.signal.aborted) return;
    controller.abort();
    forced = setTimeout(() => process.exit(EXIT.REFUSED), CANCEL_WAIT_MS);
    forced.unref();
  };
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
  try {
    const result = await runTask(writer, args.task, {
      env,
      config,
      signal: controller.signal,
    });
    if (result.error !== null) throw result.error;
    return {
      ok: true,
      task: result.task,
      run: result.run,
      spent_usd: result.spent_usd,
      budget_usd: result.budget_usd,
      notices: writer.notices,
    };
  } finally {
    process.removeListener("SIGTERM", onSignal);
    process.removeListener("SIGINT", onSignal);
    if (forced !== null) clearTimeout(forced);
    writer.close();
  }
}

function warn(io, warnings) {
  for (const w of warnings) io.stderr.write(`${escapeUnsafe(w)}\n`);
}

function run(args, env, io) {
  const opts = { env };
  switch (args.command) {
    case "projects": {
      const r = listProjects(opts);
      warn(io, r.warnings);
      return { projects: r.projects, warnings: r.warnings };
    }
    case "project": {
      const r = readProject(args.id, opts);
      warn(io, r.warnings);
      return {
        project: projectView(r.state, r.tail, r.events),
        warnings: r.warnings,
      };
    }
    case "events": {
      const r = readEvents(args.id, {
        ...opts,
        after: args.after,
        limit: args.limit,
      });
      warn(io, r.warnings);
      return {
        events: r.views,
        next_after: r.next_after,
        tail: r.tail === null ? null : { ...r.tail, text: TAIL_TEXT },
        warnings: r.warnings,
      };
    }
    case "say": {
      const writer = openWriter(args.id, opts);
      try {
        const before = writer.state;
        const event = writer.say(args.text);
        return {
          ok: true,
          event: eventView(event, before),
          notices: writer.notices,
        };
      } finally {
        writer.close();
      }
    }
    case "new":
      return newProject(args, env);
    case "add-task":
      return addTask(args, env);
    case "run-task":
      return runTaskCommand(args, env);
    default:
      throw usage(UNKNOWN_COMMAND);
  }
}

export function main(argv, env = process.env, io = defaultIo()) {
  return runGuarded(() => run(parseArgs(argv), env, io), io);
}

function isEntryPoint() {
  if (typeof process.argv[1] !== "string") return false;
  try {
    const self = fs.realpathSync(new URL(import.meta.url));
    return fs.realpathSync(path.resolve(process.argv[1])) === self;
  } catch {
    return (
      pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
    );
  }
}

if (isEntryPoint()) {
  const code = main(process.argv.slice(2), process.env);
  if (typeof code === "number") {
    process.exitCode = code;
  } else {
    code.then((c) => {
      process.exitCode = c;
    });
  }
}
